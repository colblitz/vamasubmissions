"""Search Analytics model."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class SearchAnalytics(Base):
    """
    Search Analytics model - tracks all searches to identify zero-result queries.

    Used to suggest new aliases for common searches that return no results.
    """

    __tablename__ = "search_analytics"

    id = Column(Integer, primary_key=True, index=True)
    field_type = Column(String(20), nullable=False, index=True)  # 'characters', 'series', 'tags'
    search_term = Column(Text, nullable=False)
    result_count = Column(Integer, nullable=False, default=0, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    searched_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    # Constraints
    __table_args__ = (
        CheckConstraint("field_type IN ('characters', 'series', 'tags')", name="check_field_type"),
    )

    def __repr__(self):
        return f"<SearchAnalytics(id={self.id}, {self.field_type}: '{self.search_term}' -> {self.result_count} results)>"
