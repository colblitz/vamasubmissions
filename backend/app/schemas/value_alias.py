"""Value Alias schemas."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ValueAliasBase(BaseModel):
    """Base value alias schema."""

    field_type: Literal["characters", "series", "tags"]
    canonical_value: str = Field(..., min_length=1)
    alias_value: str = Field(..., min_length=1)


class ValueAliasCreate(ValueAliasBase):
    """Schema for creating a value alias."""

    @field_validator("canonical_value", "alias_value")
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        """Validate value is not empty or whitespace."""
        if not v or not v.strip():
            raise ValueError("Value cannot be empty or whitespace")
        return v.strip()


class ValueAliasUpdate(BaseModel):
    """Schema for updating a value alias."""

    canonical_value: Optional[str] = None
    alias_value: Optional[str] = None


class ValueAlias(ValueAliasBase):
    """Schema for value alias responses."""

    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ValueAliasList(BaseModel):
    """Schema for list of value aliases."""

    aliases: List[ValueAlias]
    total: int


class ZeroResultSuggestion(BaseModel):
    """Schema for zero-result search suggestion."""

    field_type: str
    search_term: str
    search_count: int
    last_searched: datetime

    class Config:
        from_attributes = True


class ZeroResultSuggestionList(BaseModel):
    """Schema for list of zero-result suggestions."""

    suggestions: List[ZeroResultSuggestion]
    total: int
