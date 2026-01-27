"""
Pydantic schemas for global edit suggestions
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.utils.validation import normalize_text


class GlobalEditPreviewRequest(BaseModel):
    """Schema for previewing a global edit (before creating suggestion)
    
    Only requires field_name and pattern to show which posts match.
    """
    field_name: str = Field(..., pattern="^(characters|series|tags)$")
    pattern: str = Field(..., min_length=1, max_length=255)

    @field_validator("pattern")
    @classmethod
    def normalize_pattern(cls, v: str) -> str:
        """Normalize pattern value"""
        normalized = normalize_text(v)
        if not normalized:
            raise ValueError("Pattern cannot be empty or whitespace only")
        return normalized


class GlobalEditSuggestionCreate(BaseModel):
    """Schema for creating a global edit suggestion
    
    Example for ADD action:
        {
            "condition_field": "characters",
            "pattern": "old_character_name",
            "action": "ADD",
            "action_field": "tags",
            "action_value": "new_tag_name"
        }
    
    Example for DELETE action:
        {
            "condition_field": "tags",
            "pattern": "tag_to_delete",
            "action": "DELETE",
            "action_field": "tags"
        }
    """

    condition_field: str = Field(..., pattern="^(characters|series|tags)$")
    pattern: str = Field(..., min_length=1, max_length=255)
    action: str = Field(..., pattern="^(ADD|DELETE)$")
    action_field: str = Field(..., pattern="^(characters|series|tags)$")
    action_value: Optional[str] = Field(None, max_length=255)

    @field_validator("pattern", "action_value")
    @classmethod
    def normalize_values(cls, v: Optional[str]) -> Optional[str]:
        """Normalize text values"""
        if v is None:
            return None
        normalized = normalize_text(v)
        if not normalized:
            raise ValueError("Value cannot be empty or whitespace only")
        return normalized

    @field_validator("action_value")
    @classmethod
    def validate_action_value(cls, v: Optional[str], info) -> Optional[str]:
        """Validate action_value based on action type"""
        action = info.data.get("action")
        
        if action == "DELETE":
            if v is not None:
                raise ValueError("action_value must be None for DELETE action")
        elif action == "ADD":
            if v is None:
                raise ValueError("action_value is required for ADD action")
            pattern = info.data.get("pattern")
            if pattern and v == pattern:
                raise ValueError("action_value must be different from pattern for ADD action")
        
        return v

    @field_validator("action_field")
    @classmethod
    def validate_action_field(cls, v: str, info) -> str:
        """Validate action_field based on action type"""
        action = info.data.get("action")
        condition_field = info.data.get("condition_field")
        
        if action == "DELETE" and condition_field:
            if v != condition_field:
                raise ValueError("action_field must equal condition_field for DELETE action")
        
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
    pattern: str
    action: str
    action_value: Optional[str]
    affected_posts: List[GlobalEditPreviewPost]
    affected_count: int


class GlobalEditSuggestionResponse(BaseModel):
    """Schema for global edit suggestion response"""

    id: int
    suggester_id: Optional[int]
    suggester_username: Optional[str]
    field_name: str
    pattern: str
    action: str
    action_field: str
    action_value: Optional[str]
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
    pattern: str
    action: str
    action_field: str
    action_value: Optional[str]
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
