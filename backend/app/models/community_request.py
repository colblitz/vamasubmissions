"""Community Request model for unofficial queue tracking."""
from sqlalchemy import Column, Integer, DateTime, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base


class CommunityRequest(Base):
    """Community request model for tracking user requests (unofficial)."""
    
    __tablename__ = "community_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    characters = Column(ARRAY(Text), nullable=False, default=[])
    series = Column(ARRAY(Text), nullable=False, default=[])
    timestamp = Column(DateTime, nullable=False, index=True)  # When user made the request to VAMA
    description = Column(Text)
    is_private = Column(Boolean, nullable=False, default=False)
    fulfilled = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="community_requests")
    
    def __repr__(self):
        return f"<CommunityRequest(id={self.id}, characters={self.characters}, series={self.series}, fulfilled={self.fulfilled})>"
    
    @property
    def is_visible_to_others(self) -> bool:
        """Check if this request should be visible to other users."""
        return not self.is_private
    
    def to_public_dict(self):
        """Return a public representation (obscures private requests)."""
        if self.is_private:
            return {
                "id": self.id,
                "characters": ["[Private Request]"],
                "series": ["[Private]"],
                "timestamp": self.timestamp,
                "is_private": True,
                "fulfilled": self.fulfilled,
            }
        return {
            "id": self.id,
            "characters": self.characters,
            "series": self.series,
            "timestamp": self.timestamp,
            "description": self.description,
            "is_private": False,
            "fulfilled": self.fulfilled,
        }
