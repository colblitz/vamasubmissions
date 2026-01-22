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
from app.models.admin_settings import AdminSettings

router = APIRouter()


@router.get("/login")
async def login(username: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Development mode: Mock login for testing.
    Production mode: Redirect to Patreon OAuth authorization page.

    If username is provided, creates/returns a mock user for development.
    Otherwise, redirects to Patreon OAuth.
    """
    # Development mode: Mock auth
    if username:
        # Check if mock user exists
        user = user_service.get_user_by_patreon_id(db, f"mock_{username}")

        if not user:
            # Create mock user
            user = user_service.create_user(
                db,
                patreon_id=f"mock_{username}",
                patreon_username=username,
                email=f"{username}@example.com",
                tier=2,  # Default to tier 2 for testing
            )

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

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
                "email": user.email,
                "tier": user.tier,
                "credits": user.credits,
                "max_credits": user.max_credits,
                "credits_per_month": user.credits_per_month,
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

        print(f"DEBUG: Exchanging code for token")
        print(f"DEBUG: Token URL: {token_url}")
        print(f"DEBUG: Redirect URI: {settings.patreon_redirect_uri}")
        print(f"DEBUG: Code: {code[:10]}...")

        try:
            token_response = await client.post(
                token_url,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            print(f"DEBUG: Token response status: {token_response.status_code}")
            print(f"DEBUG: Token response headers: {dict(token_response.headers)}")
            print(f"DEBUG: Token response text: {token_response.text}")

            if token_response.status_code != 200:
                error_detail = token_response.text
                print(f"ERROR: Patreon token exchange failed: {token_response.status_code}")
                print(f"ERROR: Response body: {error_detail}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to exchange authorization code: {error_detail}",
                )
        except httpx.HTTPError as e:
            print(f"ERROR: HTTP error during token exchange: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"HTTP error during token exchange: {str(e)}",
            )
        except Exception as e:
            print(f"ERROR: Unexpected error during token exchange: {str(e)}")
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
                email=user_info.email,
                tier=user_info.tier,
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
                email=user_info.email,
                tier=user_info.tier,
                patreon_access_token=access_token,
                patreon_refresh_token=refresh_token,
                patreon_token_expires_at=token_expires_at,
            )

        # Update last login
        user.last_login = datetime.utcnow()

        # If user is admin, store Patreon tokens in admin_settings
        if user.is_admin:
            admin_settings = (
                db.query(AdminSettings).filter(AdminSettings.user_id == user.id).first()
            )

            if not admin_settings:
                admin_settings = AdminSettings(user_id=user.id)
                db.add(admin_settings)

            admin_settings.patreon_access_token = access_token
            admin_settings.patreon_refresh_token = refresh_token
            admin_settings.patreon_token_expires_at = token_expires_at
            admin_settings.updated_at = datetime.utcnow()

        db.commit()

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
                "include": "memberships.campaign",
                "fields[user]": "email,full_name",
                "fields[member]": "patron_status,currently_entitled_amount_cents,pledge_relationship_start",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if identity_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user info from Patreon",
            )

        data = identity_response.json()
        user_data = data.get("data", {})
        included = data.get("included", [])

        patreon_id = user_data.get("id")
        attributes = user_data.get("attributes", {})
        username = attributes.get("full_name")
        email = attributes.get("email")

        # Determine tier based on membership
        tier = 1  # Default to free tier

        # Find membership to the creator
        for item in included:
            if item.get("type") == "member":
                member_attrs = item.get("attributes", {})
                patron_status = member_attrs.get("patron_status")

                # Check if they're an active patron
                if patron_status == "active_patron":
                    # Get tier based on pledge amount (in cents)
                    amount_cents = member_attrs.get("currently_entitled_amount_cents", 0)
                    print(f"DEBUG: Patron status: {patron_status}")
                    print(f"DEBUG: Amount in cents: {amount_cents}")
                    print(f"DEBUG: Amount in dollars: ${amount_cents / 100}")
                    tier = determine_tier_from_amount(amount_cents)
                    print(f"DEBUG: Calculated tier: {tier}")
                    break

        return PatreonUserInfo(
            patreon_id=patreon_id,
            username=username,
            email=email,
            tier=tier,
        )


def determine_tier_from_amount(amount_cents: int) -> int:
    """
    Determine tier based on VAMA's Patreon pledge amounts.

    VAMA's Tier Structure:
    - Tier 1 (Free): $0
    - Tier 2 (NSFW Art! Tier 1): $5/month
    - Tier 3 (NSFW Art! Tier 2): $15/month
    - Tier 4 (NSFW Art! Tier 3): $30/month
    - Tier 5 (NSFW Art! support): $60/month

    Args:
        amount_cents: Pledge amount in cents

    Returns:
        Tier number (1-5)
    """
    if amount_cents >= 6000:  # $60+
        return 5
    elif amount_cents >= 3000:  # $30+
        return 4
    elif amount_cents >= 1500:  # $15+
        return 3
    elif amount_cents >= 500:  # $5+
        return 2
    else:
        return 1  # Free tier


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
        "email": current_user.email,
        "tier": current_user.tier,
        "credits": current_user.credits,
        "max_credits": current_user.max_credits,
        "credits_per_month": current_user.credits_per_month,
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
        Subscription status including tier and pledge amount
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
                "include": "memberships.campaign",
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

                    is_active = patron_status == "active_patron"
                    tier = determine_tier_from_amount(amount_cents) if is_active else 1

                    # Update user's tier in database if it changed
                    if current_user.tier != tier:
                        current_user.tier = tier
                        db.commit()

                    return {
                        "is_subscribed": is_active,
                        "patron_status": patron_status,
                        "tier": tier,
                        "pledge_amount_cents": amount_cents,
                        "pledge_amount_dollars": amount_cents / 100,
                        "member_since": pledge_start,
                        "campaign_id": campaign_id,
                    }

        # No active membership found
        # Update user to tier 1 if they were previously subscribed
        if current_user.tier > 1:
            current_user.tier = 1
            db.commit()

        return {
            "is_subscribed": False,
            "patron_status": "not_patron",
            "tier": 1,
            "pledge_amount_cents": 0,
            "pledge_amount_dollars": 0,
            "member_since": None,
            "campaign_id": None,
        }
