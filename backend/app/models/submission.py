"""Submission models."""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Submission(Base):
    """Submission model representing character requests."""
    
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Character details
    character_name = Column(String(255), nullable=False, index=True)
    series = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    is_public = Column(Boolean, default=False)
    
    # Request modifiers
    is_large_image_set = Column(Boolean, default=False)
    is_double_character = Column(Boolean, default=False)
    
    # Queue management
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, in_progress, completed, cancelled
    queue_type = Column(String(50), nullable=False, index=True)  # paid, free
    queue_position = Column(Integer, index=True)  # null if completed/cancelled
    vote_count = Column(Integer, default=0)  # for tier 1 submissions
    
    # Timestamps
    submitted_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Completion details
    patreon_post_link = Column(String(500))
    creator_notes = Column(Text)
    
    # Metadata
    credit_cost = Column(Integer, nullable=False, default=1)
    estimated_completion_date = Column(DateTime)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="submissions")
    images = relationship("SubmissionImage", back_populates="submission", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="submission", cascade="all, delete-orphan")
    credit_transaction = relationship("CreditTransaction", back_populates="submission", uselist=False)
    
    def __repr__(self):
        return f"<Submission(id={self.id}, character={self.character_name}, status={self.status})>"
    
    @property
    def total_cost(self) -> int:
        """Calculate total credit cost including modifiers."""
        cost = 1  # Base cost
        if self.is_large_image_set:
            cost += 1
        if self.is_double_character:
            cost += 1
        return cost
    
    @property
    def is_pending(self) -> bool:
        """Check if submission is pending."""
        return self.status == "pending"
    
    @property
    def is_completed(self) -> bool:
        """Check if submission is completed."""
        return self.status == "completed"
    
    @property
    def can_edit(self) -> bool:
        """Check if submission can be edited."""
        return self.status == "pending"
    
    @property
    def can_cancel(self) -> bool:
        """Check if submission can be cancelled."""
        return self.status in ("pending", "in_progress")


class SubmissionImage(Base):
    """Image associated with a submission."""
    
    __tablename__ = "submission_images"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    mime_type = Column(String(100))
    upload_order = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    submission = relationship("Submission", back_populates="images")
    
    def __repr__(self):
        return f"<SubmissionImage(id={self.id}, submission_id={self.submission_id}, order={self.upload_order})>"
