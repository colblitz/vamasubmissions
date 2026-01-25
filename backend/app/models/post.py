"""Post model for VAMA's existing Patreon posts."""

from sqlalchemy import Column, Integer, String, DateTime, func, ARRAY, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Post(Base):
    """Post model representing VAMA's Patreon posts."""

    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(String(255), unique=True, nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    patreon_url = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    characters = Column(ARRAY(Text), nullable=False, default=[])
    series = Column(ARRAY(Text), nullable=False, default=[])
    tags = Column(ARRAY(Text), nullable=False, default=[])
    thumbnail_url = Column(Text, nullable=True)
    thumbnail_urls = Column(ARRAY(Text), nullable=False, default=[])

    # Post import status
    status = Column(String(20), nullable=False, default="published", index=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    edits = relationship("PostEdit", back_populates="post", cascade="all, delete-orphan")
    edit_history = relationship("EditHistory", back_populates="post", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Post(id={self.id}, post_id={self.post_id}, title={self.title})>"

    @property
    def character_count(self) -> int:
        """Get number of characters in this post."""
        return len(self.characters) if self.characters else 0

    @property
    def has_multiple_characters(self) -> bool:
        """Check if post has multiple characters (for yuri/lesbian tagging)."""
        return self.character_count >= 2

    @property
    def is_pending(self) -> bool:
        """Check if post is pending review."""
        return self.status == "pending"

    @property
    def is_published(self) -> bool:
        """Check if post is published and visible in search."""
        return self.status == "published"

    @property
    def is_ready_to_publish(self) -> bool:
        """Check if post has required metadata to be published."""
        return bool(self.characters and self.series)
