"""Submission schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SubmissionImageBase(BaseModel):
    """Base submission image schema."""

    file_path: str
    file_size: int
    mime_type: Optional[str] = None
    upload_order: int


class SubmissionImage(SubmissionImageBase):
    """Schema for submission image responses."""

    id: int
    submission_id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class SubmissionBase(BaseModel):
    """Base submission schema."""

    character_name: str = Field(..., min_length=1, max_length=255)
    series: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    is_public: bool = False
    is_large_image_set: bool = False
    is_double_character: bool = False


class SubmissionCreate(SubmissionBase):
    """Schema for creating a submission."""

    pass


class SubmissionUpdate(BaseModel):
    """Schema for updating a submission (only pending submissions)."""

    character_name: Optional[str] = Field(None, min_length=1, max_length=255)
    series: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    is_public: Optional[bool] = None
    is_large_image_set: Optional[bool] = None
    is_double_character: Optional[bool] = None


class Submission(SubmissionBase):
    """Schema for submission responses."""

    id: int
    user_id: int
    status: str
    queue_type: str
    queue_position: Optional[int] = None
    vote_count: int
    submitted_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    patreon_post_link: Optional[str] = None
    credit_cost: int
    estimated_completion_date: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class SubmissionWithImages(Submission):
    """Schema for submission with images."""

    images: List[SubmissionImage] = []

    class Config:
        from_attributes = True


class SubmissionInDB(SubmissionWithImages):
    """Schema for submission in database (includes creator notes)."""

    creator_notes: Optional[str] = None

    class Config:
        from_attributes = True


class SubmissionComplete(BaseModel):
    """Schema for marking a submission as complete."""

    patreon_post_link: str = Field(..., min_length=1, max_length=500)
    creator_notes: Optional[str] = None


class SubmissionCancel(BaseModel):
    """Schema for cancelling a submission."""

    reason: Optional[str] = None
