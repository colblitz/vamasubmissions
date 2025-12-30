"""User model."""
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """User model representing Patreon patrons."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    patreon_id = Column(String(255), unique=True, nullable=False, index=True)
    patreon_username = Column(String(255))
    email = Column(String(255))
    tier = Column(Integer, nullable=False, default=1, index=True)  # 1=free, 2/3/4=paid
    credits = Column(Integer, nullable=False, default=0)
    role = Column(String(50), nullable=False, default="patron")  # patron, creator, admin
    last_credit_refresh = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime)
    
    # Relationships
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    credit_transactions = relationship("CreditTransaction", back_populates="user", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="user", cascade="all, delete-orphan")
    vote_allowances = relationship("UserVoteAllowance", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, patreon_username={self.patreon_username}, tier={self.tier})>"
    
    @property
    def is_admin(self) -> bool:
        """Check if user is an admin."""
        return self.role in ("admin", "creator")
    
    @property
    def is_creator(self) -> bool:
        """Check if user is the creator."""
        return self.role == "creator"
    
    @property
    def max_credits(self) -> int:
        """Get maximum credits based on tier."""
        credit_caps = {
            1: 0,  # Tier 1 doesn't use credits
            2: 2,
            3: 4,
            4: 8,
        }
        return credit_caps.get(self.tier, 0)
    
    @property
    def credits_per_month(self) -> int:
        """Get credits earned per month based on tier."""
        monthly_credits = {
            1: 0,  # Tier 1 doesn't use credits
            2: 1,
            3: 2,
            4: 4,
        }
        return monthly_credits.get(self.tier, 0)
    
    @property
    def can_submit_multiple(self) -> bool:
        """Check if user can have multiple pending submissions."""
        return self.tier > 1  # Only tier 2+ can have multiple pending
