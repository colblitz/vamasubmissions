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
    email: Optional[str] = None,
    tier: int = 1,
) -> User:
    """
    Create a new user.
    
    Args:
        db: Database session
        patreon_id: Patreon user ID
        patreon_username: Patreon username
        email: User email
        tier: User tier (1-4)
        
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
        email=email,
        tier=tier,
        role=role,
        credits=0,
        last_login=datetime.utcnow(),
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Initialize credits for paid tiers
    if tier > 1:
        refresh_user_credits(db, user)
    
    return user


def update_user(
    db: Session,
    user_id: int,
    patreon_username: Optional[str] = None,
    email: Optional[str] = None,
    tier: Optional[int] = None,
    credits: Optional[int] = None,
) -> User:
    """
    Update user information.
    
    Args:
        db: Database session
        user_id: User ID
        patreon_username: New username
        email: New email
        tier: New tier
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
    if email is not None:
        user.email = email
    if tier is not None:
        old_tier = user.tier
        user.tier = tier
        # If tier changed, adjust credits
        if old_tier != tier:
            user.credits = min(user.credits, user.max_credits)
    if credits is not None:
        user.credits = min(credits, user.max_credits)
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return user


def refresh_user_credits(db: Session, user: User) -> User:
    """
    Refresh user credits based on their tier.
    
    Args:
        db: Database session
        user: User to refresh credits for
        
    Returns:
        Updated user
    """
    from app.services.credit_service import add_credits
    
    # Only refresh for paid tiers
    if user.tier <= 1:
        return user
    
    now = datetime.utcnow()
    
    # Check if we need to refresh (monthly)
    if user.last_credit_refresh:
        # Check if it's been a month
        days_since_refresh = (now - user.last_credit_refresh).days
        if days_since_refresh < 30:
            return user
    
    # Add monthly credits
    credits_to_add = user.credits_per_month
    new_credits = min(user.credits + credits_to_add, user.max_credits)
    
    if new_credits > user.credits:
        add_credits(
            db,
            user_id=user.id,
            amount=new_credits - user.credits,
            transaction_type="monthly_refresh",
            description=f"Monthly credit refresh for tier {user.tier}",
        )
        user.credits = new_credits
        user.last_credit_refresh = now
        db.commit()
        db.refresh(user)
    
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
