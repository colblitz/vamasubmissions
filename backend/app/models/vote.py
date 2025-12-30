"""Vote models."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Vote(Base):
    """Vote model for tier 1 submission voting."""
    
    __tablename__ = "votes"
    __table_args__ = (
        UniqueConstraint('user_id', 'submission_id', name='unique_user_submission_vote'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="votes")
    submission = relationship("Submission", back_populates="votes")
    
    def __repr__(self):
        return f"<Vote(id={self.id}, user_id={self.user_id}, submission_id={self.submission_id})>"


class UserVoteAllowance(Base):
    """Track monthly vote allowances for users."""
    
    __tablename__ = "user_vote_allowance"
    __table_args__ = (
        UniqueConstraint('user_id', 'month_year', name='unique_user_month_allowance'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    month_year = Column(String(7), nullable=False)  # format: YYYY-MM
    votes_available = Column(Integer, nullable=False, default=0)
    votes_used = Column(Integer, nullable=False, default=0)
    
    # Relationships
    user = relationship("User", back_populates="vote_allowances")
    
    def __repr__(self):
        return f"<UserVoteAllowance(user_id={self.user_id}, month={self.month_year}, available={self.votes_available}, used={self.votes_used})>"
    
    @property
    def votes_remaining(self) -> int:
        """Calculate remaining votes."""
        return max(0, self.votes_available - self.votes_used)
