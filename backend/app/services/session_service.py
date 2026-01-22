"""Session service for managing user sessions."""

from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from app.models.session import Session as UserSession
from app.core.security import hash_token


def create_session(
    db: Session,
    user_id: int,
    token: str,
    expires_at: datetime,
) -> UserSession:
    """
    Create a new user session.

    Args:
        db: Database session
        user_id: User ID
        token: JWT token
        expires_at: Expiration datetime

    Returns:
        Created session
    """
    session = UserSession(
        user_id=user_id,
        token_hash=hash_token(token),
        expires_at=expires_at,
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


def get_session_by_token(db: Session, token: str) -> Optional[UserSession]:
    """
    Get session by token hash.

    Args:
        db: Database session
        token: JWT token

    Returns:
        Session if found, None otherwise
    """
    token_hash_value = hash_token(token)
    return db.query(UserSession).filter(UserSession.token_hash == token_hash_value).first()


def delete_session(db: Session, session_id: int) -> None:
    """
    Delete a session.

    Args:
        db: Database session
        session_id: Session ID to delete
    """
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if session:
        db.delete(session)
        db.commit()


def delete_expired_sessions(db: Session) -> int:
    """
    Delete all expired sessions.

    Args:
        db: Database session

    Returns:
        Number of sessions deleted
    """
    now = datetime.utcnow()
    result = db.query(UserSession).filter(UserSession.expires_at < now).delete()
    db.commit()
    return result


def update_session_activity(db: Session, session_id: int) -> None:
    """
    Update last activity timestamp for a session.

    Args:
        db: Database session
        session_id: Session ID
    """
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if session:
        session.last_activity = datetime.utcnow()
        db.commit()
