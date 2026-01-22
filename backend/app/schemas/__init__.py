"""Pydantic schemas for request/response validation."""
from app.schemas.user import User, UserCreate, UserUpdate, UserInDB
from app.schemas.submission import (
    Submission,
    SubmissionCreate,
    SubmissionUpdate,
    SubmissionInDB,
    SubmissionImage,
    SubmissionWithImages,
)
from app.schemas.auth import Token, TokenData, PatreonCallback
from app.schemas.queue import QueueInfo, QueueSubmission
from app.schemas.vote import Vote, VoteCreate

# Phase 1: Community Features
from app.schemas.post import (
    Post,
    PostCreate,
    PostUpdate,
    PostSearchResult,
    PostDetail,
)
from app.schemas.community_request import (
    CommunityRequest,
    CommunityRequestCreate,
    CommunityRequestUpdate,
    CommunityRequestPublic,
    CommunityRequestList,
    CommunityRequestFulfill,
)
from app.schemas.post_edit import (
    PostEdit,
    PostEditCreate,
    PostEditUpdate,
    PostEditWithDetails,
    PostEditApprove,
    PostEditList,
    EditHistoryEntry,
    EditHistoryList,
)

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
