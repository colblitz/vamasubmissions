"""Post Edit model for community edit suggestions."""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func, CheckConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class PostEdit(Base):
    """Post edit model for pending edit suggestions."""

    __tablename__ = "post_edits"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suggester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    field_name = Column(String(50), nullable=False)  # 'characters', 'series', 'tags'
    action = Column(String(10), nullable=False)  # 'ADD', 'DELETE'
    value = Column(Text, nullable=False)
    status = Column(
        String(20), nullable=False, default="pending", index=True
    )  # 'pending', 'approved', 'rejected'
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())
    approved_at = Column(DateTime)

    # Constraints
    __table_args__ = (
        CheckConstraint("field_name IN ('characters', 'series', 'tags')", name="valid_field_name"),
        CheckConstraint("action IN ('ADD', 'DELETE')", name="valid_action"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="valid_status"),
    )

    # Relationships
    post = relationship("Post", back_populates="edits")
    suggester = relationship("User", foreign_keys=[suggester_id], backref="suggested_edits")
    approver = relationship("User", foreign_keys=[approver_id], backref="approved_edits")

    def __repr__(self):
        return f"<PostEdit(id={self.id}, post_id={self.post_id}, action={self.action}, field={self.field_name}, status={self.status})>"

    @property
    def is_pending(self) -> bool:
        """Check if edit is still pending approval."""
        return self.status == "pending"

    @property
    def is_approved(self) -> bool:
        """Check if edit has been approved."""
        return self.status == "approved"

    def can_be_approved_by(self, user_id: int) -> bool:
        """Check if a user can approve this edit (must be different from suggester)."""
        return self.suggester_id != user_id and self.is_pending
