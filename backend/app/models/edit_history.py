"""Edit History model for audit logging."""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func, CheckConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class EditHistory(Base):
    """Edit history model for audit trail of all applied edits."""

    __tablename__ = "edit_history"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suggester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    field_name = Column(String(50), nullable=False)
    action = Column(String(10), nullable=False)
    value = Column(Text, nullable=False)
    applied_at = Column(DateTime, server_default=func.now(), index=True)

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "field_name IN ('characters', 'series', 'tags')", name="valid_history_field"
        ),
        CheckConstraint("action IN ('ADD', 'DELETE')", name="valid_history_action"),
    )

    # Relationships
    post = relationship("Post", back_populates="edit_history")
    suggester = relationship("User", foreign_keys=[suggester_id], backref="edit_history_suggested")
    approver = relationship("User", foreign_keys=[approver_id], backref="edit_history_approved")

    def __repr__(self):
        return f"<EditHistory(id={self.id}, post_id={self.post_id}, action={self.action}, field={self.field_name}, applied_at={self.applied_at})>"
