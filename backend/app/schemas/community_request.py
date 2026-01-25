"""Community Request schemas."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.utils.validation import normalize_text, normalize_array_field


class CommunityRequestBase(BaseModel):
    """Base community request schema."""

    characters: List[str] = Field(..., min_length=1, description="List of character names")
    series: List[str] = Field(..., min_length=1, description="List of series names")
    requested_timestamp: Optional[datetime] = Field(
        default_factory=datetime.utcnow, description="When request was made"
    )
    description: Optional[str] = None
    is_private: bool = False


class CommunityRequestCreate(CommunityRequestBase):
    """Schema for creating a community request."""

    @field_validator("characters", "series")
    @classmethod
    def normalize_arrays(cls, v: List[str]) -> List[str]:
        """Normalize array fields."""
        normalized = normalize_array_field(v)
        if not normalized:
            raise ValueError("List cannot be empty after normalization")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, v: Optional[str]) -> Optional[str]:
        """Normalize description field."""
        return normalize_text(v)


class CommunityRequestUpdate(BaseModel):
    """Schema for updating a community request."""

    characters: Optional[List[str]] = Field(None, min_length=1)
    series: Optional[List[str]] = Field(None, min_length=1)
    requested_timestamp: Optional[datetime] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None

    @field_validator("characters", "series")
    @classmethod
    def normalize_arrays(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Normalize array fields."""
        if v is None:
            return None
        normalized = normalize_array_field(v)
        if not normalized:
            raise ValueError("List cannot be empty after normalization")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, v: Optional[str]) -> Optional[str]:
        """Normalize description field."""
        return normalize_text(v)


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
    requested_timestamp: datetime
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
