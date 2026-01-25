"""Authentication API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import httpx
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import PatreonUserInfo
from app.services import user_service, session_service
from app.models.user import User

router = APIRouter()


@router.get("/login")
async def login(
    username: Optional[str] = None, tier_id: Optional[str] = None, db: Session = Depends(get_db)
):
    """
    Development mode: Mock login for testing.
    Production mode: Redirect to Patreon OAuth authorization page.

    If username is provided, creates/returns a mock user for development.
    tier_id parameter can be used to set the user's tier_id for testing.
    Otherwise, redirects to Patreon OAuth.
    """
    # Development mode: Mock auth
    if username:
        # Check if mock user exists
        user = user_service.get_user_by_patreon_id(db, f"mock_{username}")

        if not user:
            # Use provided tier_id or default to "mock_tier_1" for testing
            if tier_id is None:
                tier_id = "mock_tier_1"

            # Create mock user with active patron status
            user = user_service.create_user(
                db,
                patreon_id=f"mock_{username}",
                patreon_username=username,
                tier_id=tier_id,
                campaign_id=settings.patreon_creator_id,
                patron_status="active_patron",
            )

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        # Check access - block non-active patrons (unless admin)
        if user.patron_status != "active_patron" and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This site is only accessible to VAMA Patreon subscribers. Please subscribe to access.",
            )

        # Create JWT token
        jwt_token = create_access_token(data={"user_id": user.id, "patreon_id": user.patreon_id})

        # Store session
        expires_at = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
        session_service.create_session(
            db,
            user_id=user.id,
            token=jwt_token,
            expires_at=expires_at,
        )

        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "patreon_id": user.patreon_id,
                "patreon_username": user.patreon_username,
                "tier_id": user.tier_id,
                "campaign_id": user.campaign_id,
                "patron_status": user.patron_status,
                "role": user.role,
            },
        }

    # Production mode: Patreon OAuth
    patreon_auth_url = (
        f"{settings.patreon_authorize_url}"
        f"?response_type=code"
        f"&client_id={settings.patreon_client_id}"
        f"&redirect_uri={settings.patreon_redirect_uri}"
        f"&scope=identity identity.memberships"
    )
    return RedirectResponse(url=patreon_auth_url)


@router.get("/callback")
async def callback(code: str, db: Session = Depends(get_db)):
    """
    Handle Patreon OAuth callback and create user session.

    Args:
        code: Authorization code from Patreon
        db: Database session

    Returns:
        JWT access token
    """
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_url = settings.patreon_token_url
        token_data = {
            "code": code,
            "grant_type": "authorization_code",
            "client_id": settings.patreon_client_id,
            "client_secret": settings.patreon_client_secret,
            "redirect_uri": settings.patreon_redirect_uri,
        }

        try:
            token_response = await client.post(
                token_url,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if token_response.status_code != 200:
                error_detail = token_response.text
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to exchange authorization code: {error_detail}",
                )
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"HTTP error during token exchange: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unexpected error during token exchange: {str(e)}",
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 2592000)  # Default 30 days

        # Calculate token expiry
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        # Fetch user info from Patreon
        user_info = await fetch_patreon_user_info(access_token)

        # Create or update user in database
        user = user_service.get_user_by_patreon_id(db, user_info.patreon_id)
        if not user:
            user = user_service.create_user(
                db,
                patreon_id=user_info.patreon_id,
                patreon_username=user_info.username,
                tier_id=user_info.tier_id,
                campaign_id=user_info.campaign_id,
                patron_status=user_info.patron_status,
                patreon_access_token=access_token,
                patreon_refresh_token=refresh_token,
                patreon_token_expires_at=token_expires_at,
            )
        else:
            # Update user info and tokens
            user = user_service.update_user(
                db,
                user.id,
                patreon_username=user_info.username,
                tier_id=user_info.tier_id,
                campaign_id=user_info.campaign_id,
                patron_status=user_info.patron_status,
                patreon_access_token=access_token,
                patreon_refresh_token=refresh_token,
                patreon_token_expires_at=token_expires_at,
            )

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        # Two-step access control (skip for admins)
        if user.role != "admin":
            # Step 1: Check if user is patron of VAMA's campaign
            if user_info.campaign_id != settings.patreon_creator_id:
                error_message = "This site is only accessible to VAMA Patreon subscribers. Please subscribe to access."
                frontend_redirect = f"{settings.frontend_url}/auth/callback?error={error_message}"
                return RedirectResponse(url=frontend_redirect)

            # Step 2: Check if user is active patron
            if user_info.patron_status != "active_patron":
                error_message = "Your subscription is required to access this site. Please renew your VAMA Patreon subscription."
                frontend_redirect = f"{settings.frontend_url}/auth/callback?error={error_message}"
                return RedirectResponse(url=frontend_redirect)

            # Step 3: Check if user's tier is in the allowed whitelist
            allowed_tier_ids = settings.allowed_patreon_tier_ids.split(",")
            if user_info.tier_id not in allowed_tier_ids:
                error_message = "Your subscription tier does not have access to this site. Please upgrade your VAMA Patreon subscription."
                frontend_redirect = f"{settings.frontend_url}/auth/callback?error={error_message}"
                return RedirectResponse(url=frontend_redirect)

        # Create JWT token
        jwt_token = create_access_token(data={"user_id": user.id, "patreon_id": user.patreon_id})

        # Store session in database
        expires_at = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
        session_service.create_session(
            db,
            user_id=user.id,
            token=jwt_token,
            expires_at=expires_at,
        )

        # Redirect to frontend with token
        frontend_redirect = f"{settings.frontend_url}/auth/callback?token={jwt_token}"
        return RedirectResponse(url=frontend_redirect)


@router.post("/logout")
async def logout(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logout current user by invalidating their session.

    Args:
        current_user: Current authenticated user
        db: Database session
    """
    # Note: In a real implementation, we'd need to get the actual token from the request
    # and invalidate it. For now, we'll just return success.
    # TODO: Implement token blacklisting or session invalidation
    return {"message": "Logged out successfully"}


async def fetch_patreon_user_info(access_token: str) -> PatreonUserInfo:
    """
    Fetch user information from Patreon API.

    Args:
        access_token: Patreon access token

    Returns:
        PatreonUserInfo object

    Raises:
        HTTPException: If API request fails
    """
    async with httpx.AsyncClient() as client:
        # Fetch user identity
        identity_response = await client.get(
            f"{settings.patreon_api_url}/identity",
            params={
                "include": "memberships.campaign,memberships.currently_entitled_tiers",
                "fields[user]": "email,full_name",
                "fields[member]": "patron_status,currently_entitled_amount_cents,pledge_relationship_start",
                "fields[tier]": "title,amount_cents",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if identity_response.status_code != 200:
            error_detail = identity_response.text
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch user info from Patreon: {error_detail}",
            )

        data = identity_response.json()
        user_data = data.get("data", {})
        included = data.get("included", [])

        patreon_id = user_data.get("id")
        attributes = user_data.get("attributes", {})
        username = attributes.get("full_name")
        email = attributes.get("email")

        # Extract membership information for VAMA's campaign specifically
        tier_id = None
        campaign_id = None
        patron_status = None

        target_campaign_id = settings.patreon_creator_id

        # Find membership to VAMA's campaign (not just any campaign)
        for item in included:
            if item.get("type") == "member":
                # Get campaign_id from relationships
                campaign_rel = item.get("relationships", {}).get("campaign", {}).get("data", {})
                item_campaign_id = campaign_rel.get("id")

                # Only process if this is VAMA's campaign
                if item_campaign_id == target_campaign_id:
                    member_attrs = item.get("attributes", {})
                    patron_status = member_attrs.get("patron_status")
                    campaign_id = item_campaign_id

                    # Get tier_id from currently_entitled_tiers relationship
                    tiers_rel = (
                        item.get("relationships", {})
                        .get("currently_entitled_tiers", {})
                        .get("data", [])
                    )
                    if tiers_rel and len(tiers_rel) > 0:
                        # Take the first tier ID (users typically have one tier per campaign)
                        tier_id = tiers_rel[0].get("id")

                    break

        return PatreonUserInfo(
            patreon_id=patreon_id,
            username=username,
            email=email,
            tier_id=tier_id,
            campaign_id=campaign_id,
            patron_status=patron_status,
        )


def get_tier_name_from_id(tier_id: Optional[str]) -> str:
    """
    Map Patreon tier ID to display name.

    Args:
        tier_id: Patreon tier ID

    Returns:
        Human-readable tier name
    """
    tier_names = {
        "25126656": "Free",
        "25126680": "NSFW Art! Tier 1",
        "25126688": "NSFW Art! Tier 2",
        "25126693": "NSFW Art! Tier 3",
        "25147402": "NSFW Art! Support",
    }
    return tier_names.get(tier_id, "Unknown Tier")


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(user_service.get_current_user),
):
    """
    Get current user information.

    Args:
        current_user: Current authenticated user

    Returns:
        User information
    """
    return {
        "id": current_user.id,
        "patreon_id": current_user.patreon_id,
        "patreon_username": current_user.patreon_username,
        "tier_id": current_user.tier_id,
        "tier_name": get_tier_name_from_id(current_user.tier_id),
        "campaign_id": current_user.campaign_id,
        "patron_status": current_user.patron_status,
        "role": current_user.role,
        "can_submit_multiple": current_user.can_submit_multiple,
    }


@router.get("/check-subscription")
async def check_subscription(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check if current user is subscribed to VAMA's Patreon.

    This endpoint verifies the user's subscription status by checking their
    stored OAuth token and membership data.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        Subscription status including tier_id and patron status
    """
    # Check if we have a valid access token
    if not current_user.patreon_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No Patreon access token found. Please log in again.",
        )

    # Check if token is expired
    if (
        current_user.patreon_token_expires_at
        and current_user.patreon_token_expires_at < datetime.utcnow()
    ):
        # TODO: Implement token refresh logic
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Patreon access token expired. Please log in again.",
        )

    # Fetch fresh membership data from Patreon
    async with httpx.AsyncClient() as client:
        identity_response = await client.get(
            f"{settings.patreon_api_url}/identity",
            params={
                "include": "memberships.campaign,memberships.currently_entitled_tiers",
                "fields[user]": "email,full_name",
                "fields[member]": "patron_status,currently_entitled_amount_cents,pledge_relationship_start",
                "fields[campaign]": "creation_name,vanity",
            },
            headers={"Authorization": f"Bearer {current_user.patreon_access_token}"},
        )

        if identity_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch membership info from Patreon",
            )

        data = identity_response.json()
        included = data.get("included", [])

        # Look for membership to VAMA's campaign
        target_campaign_id = settings.patreon_creator_id

        for item in included:
            if item.get("type") == "member":
                # Get the campaign this membership belongs to
                campaign_rel = item.get("relationships", {}).get("campaign", {}).get("data", {})
                campaign_id = campaign_rel.get("id")

                if campaign_id == target_campaign_id:
                    member_attrs = item.get("attributes", {})
                    patron_status = member_attrs.get("patron_status")
                    amount_cents = member_attrs.get("currently_entitled_amount_cents", 0)
                    pledge_start = member_attrs.get("pledge_relationship_start")

                    # Get tier_id from currently_entitled_tiers relationship
                    tier_id = None
                    tiers_rel = (
                        item.get("relationships", {})
                        .get("currently_entitled_tiers", {})
                        .get("data", [])
                    )
                    if tiers_rel and len(tiers_rel) > 0:
                        tier_id = tiers_rel[0].get("id")

                    is_active = patron_status == "active_patron"

                    # Update user's info in database if it changed
                    if (
                        current_user.tier_id != tier_id
                        or current_user.patron_status != patron_status
                    ):
                        current_user.tier_id = tier_id
                        current_user.patron_status = patron_status
                        current_user.campaign_id = campaign_id
                        db.commit()

                    return {
                        "is_subscribed": is_active,
                        "patron_status": patron_status,
                        "tier_id": tier_id,
                        "pledge_amount_cents": amount_cents,
                        "pledge_amount_dollars": amount_cents / 100,
                        "member_since": pledge_start,
                        "campaign_id": campaign_id,
                    }

        # No active membership found
        # Update user status if they were previously subscribed
        if current_user.patron_status == "active_patron":
            current_user.patron_status = "not_patron"
            current_user.tier_id = None
            db.commit()

        return {
            "is_subscribed": False,
            "patron_status": "not_patron",
            "tier_id": None,
            "pledge_amount_cents": 0,
            "pledge_amount_dollars": 0,
            "member_since": None,
            "campaign_id": None,
        }
