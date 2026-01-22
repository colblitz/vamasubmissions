"""Post schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class PostStatus(str, Enum):
    """Post status enum."""

    PENDING = "pending"
    PUBLISHED = "published"


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
    url: str
    image_urls: List[str] = Field(default_factory=list)
    thumbnail_urls: List[str] = Field(default_factory=list)


class PostUpdate(BaseModel):
    """Schema for updating a post."""

    title: Optional[str] = None
    characters: Optional[List[str]] = None
    series: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    image_urls: Optional[List[str]] = None
    thumbnail_urls: Optional[List[str]] = None
    status: Optional[PostStatus] = None


class PostImport(BaseModel):
    """Schema for importing a new post from Patreon."""

    post_id: str
    title: str
    url: str
    timestamp: datetime
    image_urls: List[str] = Field(default_factory=list)
    thumbnail_urls: List[str] = Field(default_factory=list)
    raw_patreon_json: Optional[Dict[str, Any]] = None
    # Characters/series left empty for manual input
    characters: List[str] = Field(default_factory=list)
    series: List[str] = Field(default_factory=list)


class Post(PostBase):
    """Schema for post responses."""

    id: int
    post_id: str
    timestamp: datetime
    url: str
    image_urls: List[str]
    thumbnail_urls: List[str]
    created_at: datetime
    updated_at: datetime
    character_count: int
    has_multiple_characters: bool

    class Config:
        from_attributes = True


class PostSearchResult(BaseModel):
    """Schema for post search results."""

    posts: List[Post]
    total: int
    page: int
    limit: int
    total_pages: int


class PostDetail(Post):
    """Schema for detailed post view (includes edit history count)."""

    edit_count: int = 0

    class Config:
        from_attributes = True
