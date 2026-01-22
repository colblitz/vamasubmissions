"""Post Edit schemas."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime


class PostEditBase(BaseModel):
    """Base post edit schema."""

    field_name: Literal["characters", "series", "tags"]
    action: Literal["ADD", "DELETE"]
    value: str = Field(..., min_length=1)


class PostEditCreate(PostEditBase):
    """Schema for creating a post edit suggestion."""

    post_id: int

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        """Validate that value is not empty after stripping."""
        v = v.strip()
        if not v:
            raise ValueError("Value cannot be empty")
        return v


class PostEditUpdate(BaseModel):
    """Schema for updating a post edit (admin only)."""

    status: Optional[Literal["pending", "approved", "rejected"]] = None


class PostEdit(PostEditBase):
    """Schema for post edit responses."""

    id: int
    post_id: int
    suggester_id: Optional[int]
    status: str
    approver_id: Optional[int] = None
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PostEditWithDetails(PostEdit):
    """Schema for post edit with additional details."""

    post_title: str
    post_thumbnail: Optional[str] = None
    suggester_username: Optional[str] = None
    approver_username: Optional[str] = None

    class Config:
        from_attributes = True


class PostEditApprove(BaseModel):
    """Schema for approving a post edit."""

    pass  # No additional fields needed, approval is implicit


class PostEditList(BaseModel):
    """Schema for list of post edits."""

    edits: List[PostEditWithDetails]
    total: int
    page: int = 1
    limit: int = 50


class EditHistoryEntry(BaseModel):
    """Schema for edit history entry."""

    id: int
    post_id: int
    suggester_id: Optional[int]
    approver_id: Optional[int]
    field_name: str
    action: str
    value: str
    applied_at: datetime
    post_title: Optional[str] = None
    post_thumbnail: Optional[str] = None
    suggester_username: Optional[str] = None
    approver_username: Optional[str] = None

    class Config:
        from_attributes = True


class EditHistoryList(BaseModel):
    """Schema for edit history list."""

    history: List[EditHistoryEntry]
    total: int
    page: int = 1
    limit: int = 50
