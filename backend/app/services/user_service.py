"""User service for business logic."""

from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime

from app.models.user import User
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.config import settings

security = HTTPBearer()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_patreon_id(db: Session, patreon_id: str) -> Optional[User]:
    """Get user by Patreon ID."""
    return db.query(User).filter(User.patreon_id == patreon_id).first()


def create_user(
    db: Session,
    patreon_id: str,
    patreon_username: Optional[str] = None,
    tier_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    patron_status: Optional[str] = None,
) -> User:
    """
    Create a new user.

    Args:
        db: Database session
        patreon_id: Patreon user ID
        patreon_username: Patreon username
        tier_id: Patreon tier ID
        campaign_id: Patreon campaign ID
        patron_status: Patreon patron status

    Returns:
        Created user
    """
    # Determine role
    role = "patron"
    if patreon_id == settings.admin_patreon_id:
        role = "admin"

    # Create user
    user = User(
        patreon_id=patreon_id,
        patreon_username=patreon_username,
        tier_id=tier_id,
        campaign_id=campaign_id,
        patron_status=patron_status,
        role=role,
        last_login=datetime.utcnow(),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize credits for active patrons
    if patron_status == "active_patron":
        refresh_user_credits(db, user)

    return user


def update_user(
    db: Session,
    user_id: int,
    patreon_username: Optional[str] = None,
    tier_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    patron_status: Optional[str] = None,
    credits: Optional[int] = None,
) -> User:
    """
    Update user information.

    Args:
        db: Database session
        user_id: User ID
        patreon_username: New username
        tier_id: New tier ID
        campaign_id: New campaign ID
        patron_status: New patron status
        credits: New credit amount

    Returns:
        Updated user
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if patreon_username is not None:
        user.patreon_username = patreon_username
    if tier_id is not None:
        user.tier_id = tier_id
    if campaign_id is not None:
        user.campaign_id = campaign_id
    if patron_status is not None:
        user.patron_status = patron_status
    if credits is not None:
        user.credits = min(credits, user.max_credits)

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return user


def refresh_user_credits(db: Session, user: User) -> User:
    """
    Refresh user credits based on their patron status.
    
    NOTE: This is legacy code from Phase 1. Credit refresh logic has been moved
    to the credit_service and is now triggered by Patreon webhooks.
    This function is kept for backward compatibility but does nothing.

    Args:
        db: Database session
        user: User to refresh credits for

    Returns:
        User (unchanged)
    """
    # Legacy function - credit refresh now handled by webhooks
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Get current authenticated user from JWT token.

    Args:
        credentials: HTTP authorization credentials
        db: Database session

    Returns:
        Current user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials

    # Decode token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from database
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check patron status - block non-active patrons (unless admin)
    if user.patron_status != "active_patron" and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your subscription is required to access this site. Please renew your VAMA Patreon subscription.",
        )

    # Refresh credits if needed
    refresh_user_credits(db, user)

    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current user and verify they are an admin.

    Args:
        current_user: Current authenticated user

    Returns:
        Current admin user

    Raises:
        HTTPException: If user is not an admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


async def get_current_creator_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get current user and verify they are the creator.

    Args:
        current_user: Current authenticated user

    Returns:
        Current creator user

    Raises:
        HTTPException: If user is not the creator
    """
    if not current_user.is_creator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the creator can access this resource",
        )
    return current_user
