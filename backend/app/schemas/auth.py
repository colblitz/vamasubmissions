"""Authentication schemas."""
from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Schema for decoded token data."""
    user_id: Optional[int] = None
    patreon_id: Optional[str] = None


class PatreonCallback(BaseModel):
    """Schema for Patreon OAuth callback."""
    code: str
    state: Optional[str] = None


class PatreonUserInfo(BaseModel):
    """Schema for Patreon user information."""
    patreon_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    tier: int = 1
