"""System configuration service."""

from sqlalchemy.orm import Session
from typing import Optional

from app.models.system_config import SystemConfig


def get_config_value(db: Session, key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get a configuration value.

    Args:
        db: Database session
        key: Configuration key
        default: Default value if not found

    Returns:
        Configuration value or default
    """
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return config.value if config else default


def set_config_value(
    db: Session,
    key: str,
    value: str,
    description: Optional[str] = None,
) -> SystemConfig:
    """
    Set a configuration value.

    Args:
        db: Database session
        key: Configuration key
        value: Configuration value
        description: Optional description

    Returns:
        SystemConfig object
    """
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()

    if config:
        config.value = value
        if description:
            config.description = description
    else:
        config = SystemConfig(
            key=key,
            value=value,
            description=description,
        )
        db.add(config)

    db.commit()
    db.refresh(config)

    return config


def get_all_config(db: Session) -> dict:
    """
    Get all configuration values.

    Args:
        db: Database session

    Returns:
        Dictionary of all config values
    """
    configs = db.query(SystemConfig).all()
    return {config.key: config.value for config in configs}
