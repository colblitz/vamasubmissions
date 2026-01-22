"""
Admin Settings Model

Stores Patreon OAuth tokens for admin users to enable fetching new posts.
Tokens are stored separately from the User model for security and clarity.
"""

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class AdminSettings(Base):
    """Admin-specific settings, primarily for Patreon OAuth tokens"""
    
    __tablename__ = "admin_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Patreon OAuth tokens
    patreon_access_token = Column(Text, nullable=True)
    patreon_refresh_token = Column(Text, nullable=True)
    patreon_token_expires_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    
    # Relationship
    user = relationship("User", back_populates="admin_settings")
    
    def __repr__(self):
        return f"<AdminSettings(user_id={self.user_id})>"
    
    @property
    def is_token_expired(self) -> bool:
        """Check if the Patreon access token has expired"""
        if not self.patreon_token_expires_at:
            return True
        return datetime.now() >= self.patreon_token_expires_at
    
    @property
    def has_valid_token(self) -> bool:
        """Check if admin has a valid Patreon access token"""
        return bool(self.patreon_access_token and not self.is_token_expired)
