"""System configuration model."""

from sqlalchemy import Column, String, Text, DateTime, func

from app.core.database import Base


class SystemConfig(Base):
    """System configuration model for admin settings."""

    __tablename__ = "system_config"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SystemConfig(key={self.key}, value={self.value})>"
