"""Vote schemas."""
from pydantic import BaseModel
from datetime import datetime


class VoteBase(BaseModel):
    """Base vote schema."""
    submission_id: int


class VoteCreate(VoteBase):
    """Schema for creating a vote."""
    pass


class Vote(VoteBase):
    """Schema for vote responses."""
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class VoteAllowance(BaseModel):
    """Schema for user vote allowance."""
    month_year: str
    votes_available: int
    votes_used: int
    votes_remaining: int
    
    class Config:
        from_attributes = True
