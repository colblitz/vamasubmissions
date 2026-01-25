"""
Pydantic schemas for global edit suggestions
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.utils.validation import normalize_text


class GlobalEditSuggestionCreate(BaseModel):
    """Schema for creating a global edit suggestion"""
    field_name: str = Field(..., pattern="^(characters|series|tags)$")
    old_value: str = Field(..., min_length=1, max_length=255)
    new_value: str = Field(..., min_length=1, max_length=255)

    @field_validator('old_value', 'new_value')
    @classmethod
    def normalize_values(cls, v: str) -> str:
        """Normalize text values"""
        normalized = normalize_text(v)
        if not normalized:
            raise ValueError("Value cannot be empty or whitespace only")
        return normalized

    @field_validator('new_value')
    @classmethod
    def check_different(cls, v: str, info) -> str:
        """Ensure old_value and new_value are different"""
        if 'old_value' in info.data and v == info.data['old_value']:
            raise ValueError("New value must be different from old value")
        return v


class GlobalEditPreviewPost(BaseModel):
    """Schema for a post in the preview"""
    id: int
    post_id: str
    title: str
    url: str
    current_values: List[str]  # Current array values for the field
    
    class Config:
        from_attributes = True


class GlobalEditPreview(BaseModel):
    """Schema for preview response"""
    field_name: str
    old_value: str
    new_value: str
    affected_posts: List[GlobalEditPreviewPost]


class GlobalEditSuggestionResponse(BaseModel):
    """Schema for global edit suggestion response"""
    id: int
    suggester_id: Optional[int]
    suggester_username: Optional[str]
    field_name: str
    old_value: str
    new_value: str
    status: str
    approver_id: Optional[int]
    approver_username: Optional[str]
    created_at: datetime
    approved_at: Optional[datetime]
    applied_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class GlobalEditHistoryResponse(BaseModel):
    """Schema for global edit history (applied edits)"""
    id: int
    suggester_id: Optional[int]
    suggester_username: Optional[str]
    approver_id: Optional[int]
    approver_username: Optional[str]
    field_name: str
    old_value: str
    new_value: str
    applied_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class GlobalEditApproveRequest(BaseModel):
    """Schema for approving a global edit"""
    pass  # No additional data needed, just the ID in the URL


class GlobalEditRejectRequest(BaseModel):
    """Schema for rejecting a global edit"""
    pass  # No additional data needed


class GlobalEditUndoRequest(BaseModel):
    """Schema for undoing a global edit (admin only)"""
    pass  # No additional data needed
