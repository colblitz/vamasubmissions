"""User model."""

from sqlalchemy import Column, DateTime, Integer, String, func
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
    role = Column(String(50), nullable=False, default="patron")  # patron, creator, admin, owner
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime)

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

    def __repr__(self):
        return f"<User(id={self.id}, patreon_username={self.patreon_username}, tier_id={self.tier_id})>"

    @property
    def is_admin(self) -> bool:
        """Check if user is an admin (includes owner)."""
        return self.role in ("admin", "creator", "owner")

    @property
    def is_creator(self) -> bool:
        """Check if user is the Patreon creator."""
        return self.role == "creator"

    @property
    def is_owner(self) -> bool:
        """Check if user is the site owner."""
        return self.role == "owner"
