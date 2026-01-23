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
    tier = Column(Integer, nullable=False, default=1, index=True)  # 1=free, 2/3/4/5=paid
    tier_name = Column(String(100), nullable=True)  # Display name for tier
    credits = Column(Integer, nullable=False, default=0)
    role = Column(String(50), nullable=False, default="patron")  # patron, creator, admin
    last_credit_refresh = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime)

    # OAuth tokens
    patreon_access_token = Column(String)
    patreon_refresh_token = Column(String)
    patreon_token_expires_at = Column(DateTime)

    # Relationships
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    credit_transactions = relationship(
        "CreditTransaction", back_populates="user", cascade="all, delete-orphan"
    )
    votes = relationship("Vote", back_populates="user", cascade="all, delete-orphan")
    vote_allowances = relationship(
        "UserVoteAllowance", back_populates="user", cascade="all, delete-orphan"
    )
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    admin_settings = relationship(
        "AdminSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

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
            1: 0,  # Tier 1 (Free) doesn't use credits
            2: 2,  # Tier 2 ($5/month)
            3: 4,  # Tier 3 ($15/month)
            4: 8,  # Tier 4 ($30/month)
            5: 16,  # Tier 5 ($60/month)
        }
        return credit_caps.get(self.tier, 0)

    @property
    def credits_per_month(self) -> int:
        """Get credits earned per month based on tier."""
        monthly_credits = {
            1: 0,  # Tier 1 (Free) doesn't use credits
            2: 1,  # Tier 2 ($5/month)
            3: 2,  # Tier 3 ($15/month)
            4: 4,  # Tier 4 ($30/month)
            5: 8,  # Tier 5 ($60/month)
        }
        return monthly_credits.get(self.tier, 0)

    @property
    def can_submit_multiple(self) -> bool:
        """Check if user can have multiple pending submissions."""
        return self.tier > 1  # Only tier 2+ can have multiple pending
