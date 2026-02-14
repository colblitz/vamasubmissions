"""Pydantic schemas for request/response validation."""

from app.schemas.auth import PatreonCallback, Token, TokenData
from app.schemas.community_request import (
    CommunityRequest,
    CommunityRequestCreate,
    CommunityRequestFulfill,
    CommunityRequestList,
    CommunityRequestPublic,
    CommunityRequestUpdate,
)

# Phase 1: Community Features
from app.schemas.post import (
    Post,
    PostCreate,
    PostDetail,
    PostSearchResult,
    PostUpdate,
)
from app.schemas.post_edit import (
    EditHistoryEntry,
    EditHistoryList,
    PostEdit,
    PostEditApprove,
    PostEditCreate,
    PostEditList,
    PostEditUpdate,
    PostEditWithDetails,
)
from app.schemas.queue import QueueInfo, QueueSubmission
from app.schemas.submission import (
    Submission,
    SubmissionCreate,
    SubmissionImage,
    SubmissionInDB,
    SubmissionUpdate,
    SubmissionWithImages,
)
from app.schemas.user import User, UserCreate, UserInDB, UserUpdate
from app.schemas.vote import Vote, VoteCreate

__all__ = [
    # Legacy schemas
    "User",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "Submission",
    "SubmissionCreate",
    "SubmissionUpdate",
    "SubmissionInDB",
    "SubmissionImage",
    "SubmissionWithImages",
    "Token",
    "TokenData",
    "PatreonCallback",
    "QueueInfo",
    "QueueSubmission",
    "Vote",
    "VoteCreate",
    # Phase 1 schemas
    "Post",
    "PostCreate",
    "PostUpdate",
    "PostSearchResult",
    "PostDetail",
    "CommunityRequest",
    "CommunityRequestCreate",
    "CommunityRequestUpdate",
    "CommunityRequestPublic",
    "CommunityRequestList",
    "CommunityRequestFulfill",
    "PostEdit",
    "PostEditCreate",
    "PostEditUpdate",
    "PostEditWithDetails",
    "PostEditApprove",
    "PostEditList",
    "EditHistoryEntry",
    "EditHistoryList",
]
