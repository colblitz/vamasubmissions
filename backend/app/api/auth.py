"""Authentication API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import httpx
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_token
from app.schemas.auth import Token, PatreonUserInfo
from app.services import user_service, session_service
from app.models.user import User

router = APIRouter()


@router.get("/login")
async def login():
    """
    Redirect to Patreon OAuth authorization page.
    """
    patreon_auth_url = (
        f"{settings.patreon_oauth_url}/authorize"
        f"?response_type=code"
        f"&client_id={settings.patreon_client_id}"
        f"&redirect_uri={settings.patreon_redirect_uri}"
        f"&scope=identity identity[email] identity.memberships"
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
        token_response = await client.post(
            f"{settings.patreon_oauth_url}/token",
            data={
                "code": code,
                "grant_type": "authorization_code",
                "client_id": settings.patreon_client_id,
                "client_secret": settings.patreon_client_secret,
                "redirect_uri": settings.patreon_redirect_uri,
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code",
            )
        
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
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
            )
        else:
            # Update user info
            user = user_service.update_user(
                db,
                user.id,
                patreon_username=user_info.username,
                email=user_info.email,
                tier=user_info.tier,
            )
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        # Create JWT token
        jwt_token = create_access_token(
            data={"user_id": user.id, "patreon_id": user.patreon_id}
        )
        
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
                    tier = determine_tier_from_amount(amount_cents)
                    break
        
        return PatreonUserInfo(
            patreon_id=patreon_id,
            username=username,
            email=email,
            tier=tier,
        )


def determine_tier_from_amount(amount_cents: int) -> int:
    """
    Determine tier based on pledge amount.
    
    This is a placeholder - you'll need to configure the actual tier thresholds
    based on your Patreon tier setup.
    
    Args:
        amount_cents: Pledge amount in cents
        
    Returns:
        Tier number (1-4)
    """
    # Example thresholds (adjust based on your actual tiers):
    # Tier 1: $0 (free)
    # Tier 2: $5
    # Tier 3: $10
    # Tier 4: $20
    
    if amount_cents >= 2000:  # $20+
        return 4
    elif amount_cents >= 1000:  # $10+
        return 3
    elif amount_cents >= 500:  # $5+
        return 2
    else:
        return 1


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
