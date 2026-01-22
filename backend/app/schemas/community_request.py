"""Community Request schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CommunityRequestBase(BaseModel):
    """Base community request schema."""
    characters: List[str] = Field(..., min_length=1, description="List of character names")
    series: List[str] = Field(..., min_length=1, description="List of series names")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow, description="When request was made")
    description: Optional[str] = None
    is_private: bool = False


class CommunityRequestCreate(CommunityRequestBase):
    """Schema for creating a community request."""
    pass


class CommunityRequestUpdate(BaseModel):
    """Schema for updating a community request."""
    characters: Optional[List[str]] = Field(None, min_length=1)
    series: Optional[List[str]] = Field(None, min_length=1)
    timestamp: Optional[datetime] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None


class CommunityRequest(CommunityRequestBase):
    """Schema for community request responses."""
    id: int
    user_id: int
    fulfilled: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CommunityRequestPublic(BaseModel):
    """Schema for public community request view (obscures private requests)."""
    id: int
    characters: List[str]
    series: List[str]
    timestamp: datetime
    description: Optional[str] = None
    is_private: bool
    fulfilled: bool
    is_own_request: bool = False  # Set by service layer
    queue_position: Optional[int] = None  # Set by service layer
    
    class Config:
        from_attributes = True


class CommunityRequestList(BaseModel):
    """Schema for list of community requests."""
    requests: List[CommunityRequestPublic]
    total: int
    page: int
    limit: int
    user_positions: List[int] = Field(default_factory=list)  # Positions of user's own requests


class CommunityRequestFulfill(BaseModel):
    """Schema for marking a request as fulfilled."""
    fulfilled: bool = True
