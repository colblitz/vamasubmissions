"""SQLAlchemy models."""

from app.models.user import User
from app.models.submission import Submission, SubmissionImage
from app.models.credit import CreditTransaction
from app.models.vote import Vote, UserVoteAllowance
from app.models.session import Session as UserSession
from app.models.system_config import SystemConfig

# Phase 1: Community Features
from app.models.post import Post
from app.models.community_request import CommunityRequest
from app.models.post_edit import PostEdit
from app.models.edit_history import EditHistory

__all__ = [
    # Legacy models
    "User",
    "Submission",
    "SubmissionImage",
    "CreditTransaction",
    "Vote",
    "UserVoteAllowance",
    "UserSession",
    "SystemConfig",
    # Phase 1 models
    "Post",
    "CommunityRequest",
    "PostEdit",
    "EditHistory",
]
