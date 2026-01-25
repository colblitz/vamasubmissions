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
    tier_id = Column(String(50), nullable=True)
    campaign_id = Column(String(50), nullable=True)
    patron_status = Column(String(50), nullable=True)
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
        return f"<User(id={self.id}, patreon_username={self.patreon_username}, tier_id={self.tier_id})>"

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
        """Get maximum credits based on tier_id.
        
        Note: This method will need to be updated once tier_id mapping is established.
        For now, returns 0 as default.
        """
        # TODO: Map tier_id to credit caps once Patreon tier IDs are known
        return 0

    @property
    def credits_per_month(self) -> int:
        """Get credits earned per month based on tier_id.
        
        Note: This method will need to be updated once tier_id mapping is established.
        For now, returns 0 as default.
        """
        # TODO: Map tier_id to monthly credits once Patreon tier IDs are known
        return 0

    @property
    def can_submit_multiple(self) -> bool:
        """Check if user can have multiple pending submissions.
        
        Note: This method will need to be updated once tier_id mapping is established.
        For now, returns False as default (most restrictive).
        """
        # TODO: Determine which tier_ids allow multiple submissions
        return False
