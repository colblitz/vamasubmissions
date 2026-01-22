"""User schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """Base user schema."""

    patreon_username: Optional[str] = None
    email: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a user."""

    patreon_id: str
    tier: int = Field(default=1, ge=1, le=4)


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    patreon_username: Optional[str] = None
    email: Optional[str] = None
    tier: Optional[int] = Field(None, ge=1, le=4)
    credits: Optional[int] = Field(None, ge=0)


class User(UserBase):
    """Schema for user responses."""

    id: int
    patreon_id: str
    tier: int
    credits: int
    role: str
    max_credits: int
    credits_per_month: int
    can_submit_multiple: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserInDB(User):
    """Schema for user in database (includes sensitive fields)."""

    last_credit_refresh: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class UserStats(BaseModel):
    """Schema for user statistics."""

    user_id: int
    patreon_username: Optional[str]
    tier: int
    credits: int
    pending_submissions: int
    completed_submissions: int
    cancelled_submissions: int

    class Config:
        from_attributes = True
