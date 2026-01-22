"""Queue schemas."""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class QueueSubmission(BaseModel):
    """Schema for submission in queue view."""

    id: int
    character_name: str
    series: str
    is_public: bool
    queue_position: Optional[int]
    vote_count: int
    submitted_at: datetime
    estimated_completion_date: Optional[datetime]
    is_own_submission: bool = False  # Set by API based on current user

    class Config:
        from_attributes = True


class QueueInfo(BaseModel):
    """Schema for queue information."""

    queue_type: str  # paid or free
    total_submissions: int
    user_position: Optional[int] = None  # User's position in queue (if they have a submission)
    user_submissions: List[QueueSubmission] = []
    visible_submissions: List[QueueSubmission] = []  # Public submissions or user's own


class QueueStats(BaseModel):
    """Schema for queue statistics (admin only)."""

    paid_queue_size: int
    free_queue_size: int
    total_pending: int
    total_in_progress: int
    total_completed: int
    avg_completion_days: Optional[float] = None
    popular_series: List[dict] = []  # [{"series": str, "count": int}]
