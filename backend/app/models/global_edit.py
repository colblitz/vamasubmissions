"""
Database model for global edit suggestions
"""

from sqlalchemy import Column, Integer, String, DateTime, ARRAY, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class GlobalEditSuggestion(Base):
    """Model for global edit suggestions (bulk rename)"""

    __tablename__ = "global_edit_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    suggester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    field_name = Column(String(50), nullable=False)  # 'characters', 'series', 'tags'
    old_value = Column(Text, nullable=False)
    new_value = Column(Text, nullable=False)
    status = Column(
        String(20), default="pending", nullable=False
    )  # 'pending', 'approved', 'rejected'
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    previous_values = Column(JSONB, nullable=True)  # {post_id: [old_array]}
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    applied_at = Column(DateTime, nullable=True)

    # Relationships
    suggester = relationship("User", foreign_keys=[suggester_id], backref="global_edits_suggested")
    approver = relationship("User", foreign_keys=[approver_id], backref="global_edits_approved")
