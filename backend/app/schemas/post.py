"""Post schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class PostStatus(str, Enum):
    """Post status enum."""

    PENDING = "pending"
    PUBLISHED = "published"
    SKIPPED = "skipped"  # For non-character posts (announcements, etc.)


class PostBase(BaseModel):
    """Base post schema."""

    title: str
    characters: List[str] = Field(default_factory=list)
    series: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    status: PostStatus = PostStatus.PUBLISHED


class PostCreate(PostBase):
    """Schema for creating a post."""

    post_id: str
    timestamp: datetime
    patreon_url: str
    thumbnail_url: Optional[str] = None
    thumbnail_urls: List[str] = Field(default_factory=list)


class PostUpdate(BaseModel):
    """Schema for updating a post."""

    title: Optional[str] = None
    characters: Optional[List[str]] = None
    series: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None
    thumbnail_urls: Optional[List[str]] = None
    status: Optional[PostStatus] = None


class PostImport(BaseModel):
    """Schema for importing a new post from Patreon."""

    post_id: str
    title: str
    patreon_url: str
    timestamp: datetime
    thumbnail_url: Optional[str] = None
    thumbnail_urls: List[str] = Field(default_factory=list)
    # Characters/series left empty for manual input
    characters: List[str] = Field(default_factory=list)
    series: List[str] = Field(default_factory=list)


class Post(PostBase):
    """Schema for post responses."""

    id: int
    post_id: str
    timestamp: datetime
    patreon_url: str
    thumbnail_url: Optional[str] = None
    thumbnail_urls: List[str]
    created_at: datetime
    updated_at: datetime
    character_count: int
    has_multiple_characters: bool
    pending_edits: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PostSearchItem(BaseModel):
    """Optimized schema for individual posts in search results.
    
    Only includes fields needed for search display to reduce payload size.
    Excludes: raw_patreon_json, status, created_at, updated_at.
    """

    id: int
    post_id: str
    title: str
    characters: List[str]
    series: List[str]
    tags: List[str]
    thumbnail_url: Optional[str] = None
    thumbnail_urls: List[str]
    timestamp: datetime
    patreon_url: str
    pending_edits: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PostSearchResult(BaseModel):
    """Schema for post search results."""

    posts: List[Post]
    total: int
    page: int
    limit: int
    total_pages: int


class PostSearchResultOptimized(BaseModel):
    """Optimized schema for post search results with minimal data."""

    posts: List[PostSearchItem]
    total: int
    page: int
    limit: int
    total_pages: int


class PostDetail(Post):
    """Schema for detailed post view (includes edit history count)."""

    edit_count: int = 0

    class Config:
        from_attributes = True
