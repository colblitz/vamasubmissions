"""Value Alias model."""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class ValueAlias(Base):
    """
    Value Alias model - maps alias values to canonical values.
    
    Examples:
    - FGO -> Fate/Grand Order
    - FF7 -> Final Fantasy VII
    - Kafka -> Kafka (Honkai: Star Rail)
    """
    
    __tablename__ = "value_aliases"

    id = Column(Integer, primary_key=True, index=True)
    field_type = Column(String(20), nullable=False, index=True)  # 'characters', 'series', 'tags'
    canonical_value = Column(Text, nullable=False, index=True)
    alias_value = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "field_type IN ('characters', 'series', 'tags')",
            name="check_field_type"
        ),
        UniqueConstraint('field_type', 'alias_value', name='unique_alias_per_field'),
    )

    def __repr__(self):
        return f"<ValueAlias(id={self.id}, {self.field_type}: {self.alias_value} -> {self.canonical_value})>"
