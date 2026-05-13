"""AI Tag Suggestions API endpoints.

Routes (all mounted under /api/ai-tags in main.py):

  GET  /{post_id}/suggestions
       Returns all pending AI tag suggestions for a post, sorted by
       confidence desc.

  POST /{post_id}/suggestions/{suggestion_id}/accept
       Adds the tag to posts.tags[], writes an edit_history audit entry,
       and marks the suggestion accepted.

  POST /{post_id}/suggestions/{suggestion_id}/reject
       Marks the suggestion rejected (no tag change).

All endpoints are admin-only.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.edit_history import EditHistory
from app.models.post import Post
from app.models.user import User
from app.services.user_service import get_current_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_suggestion(db: Session, suggestion_id: int, post_id: int) -> dict:
    """Fetch a single suggestion row; raise 404 if not found or wrong post."""
    row = db.execute(
        text(
            "SELECT id, post_id, tag, confidence, source, model_version, "
            "       status, reviewed_by, reviewed_at, created_at "
            "FROM ai_tag_suggestions "
            "WHERE id = :id AND post_id = :post_id"
        ),
        {"id": suggestion_id, "post_id": post_id},
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found",
        )
    return dict(row)


def _suggestion_to_dict(row) -> dict:
    """Serialise a DB row mapping to a JSON-safe dict."""
    d = dict(row)
    # reviewed_at / created_at are datetime objects — convert to ISO strings
    for field in ("reviewed_at", "created_at"):
        if d.get(field) is not None:
            d[field] = d[field].isoformat()
    return d


# ---------------------------------------------------------------------------
# GET /{post_id}/suggestions
# ---------------------------------------------------------------------------


@router.get("/{post_id}/suggestions")
async def get_ai_suggestions(
    post_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Return all pending AI tag suggestions for a post, sorted by confidence desc.

    Args:
        post_id: Post ID (integer primary key)
        current_user: Current admin user
        db: Database session

    Returns:
        List of suggestion objects
    """
    rows = db.execute(
        text(
            "SELECT id, post_id, tag, confidence, source, model_version, "
            "       status, reviewed_by, reviewed_at, created_at "
            "FROM ai_tag_suggestions "
            "WHERE post_id = :post_id AND status = 'pending' "
            "ORDER BY confidence DESC"
        ),
        {"post_id": post_id},
    ).mappings().all()

    return [_suggestion_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# POST /{post_id}/suggestions/{suggestion_id}/accept
# ---------------------------------------------------------------------------


@router.post("/{post_id}/suggestions/{suggestion_id}/accept")
async def accept_ai_suggestion(
    post_id: int,
    suggestion_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Accept an AI tag suggestion.

    - Adds the tag to posts.tags[] (idempotent: no-op if already present).
    - Writes an edit_history entry for audit trail.
    - Marks the suggestion status='accepted'.

    Args:
        post_id: Post ID
        suggestion_id: Suggestion ID
        current_user: Current admin user
        db: Database session

    Returns:
        {"suggestion": ..., "post_tags": [...]}
    """
    suggestion = _get_suggestion(db, suggestion_id, post_id)

    if suggestion["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Suggestion is already {suggestion['status']}",
        )

    # Fetch the post
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    tag = suggestion["tag"]
    now = datetime.utcnow()

    # Add tag to post (case-insensitive dedup)
    current_tags = list(post.tags or [])
    if not any(t.lower() == tag.lower() for t in current_tags):
        current_tags.append(tag)
        post.tags = current_tags
        post.updated_at = now

    # Write audit trail — suggester_id is NULL (AI, not a human)
    history = EditHistory(
        post_id=post_id,
        suggester_id=None,
        approver_id=current_user.id,
        field_name="tags",
        action="ADD",
        value=tag,
        applied_at=now,
    )
    db.add(history)

    # Mark suggestion accepted
    db.execute(
        text(
            "UPDATE ai_tag_suggestions "
            "SET status = 'accepted', reviewed_by = :uid, reviewed_at = :now "
            "WHERE id = :id"
        ),
        {"uid": current_user.id, "now": now, "id": suggestion_id},
    )

    db.commit()
    db.refresh(post)

    logger.info(
        f"[AI-TAG] {current_user.patreon_username} accepted suggestion {suggestion_id}: "
        f"ADD '{tag}' to post {post_id}"
    )

    # Re-fetch to return the updated row (status is no longer 'pending' so we
    # query without the status filter used in _get_suggestion)
    row = db.execute(
        text(
            "SELECT id, post_id, tag, confidence, source, model_version, "
            "       status, reviewed_by, reviewed_at, created_at "
            "FROM ai_tag_suggestions WHERE id = :id"
        ),
        {"id": suggestion_id},
    ).mappings().first()

    return {
        "suggestion": _suggestion_to_dict(row),
        "post_tags": list(post.tags or []),
    }


# ---------------------------------------------------------------------------
# POST /{post_id}/suggestions/{suggestion_id}/reject
# ---------------------------------------------------------------------------


@router.post("/{post_id}/suggestions/{suggestion_id}/reject")
async def reject_ai_suggestion(
    post_id: int,
    suggestion_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Reject an AI tag suggestion (no change to the post).

    Args:
        post_id: Post ID
        suggestion_id: Suggestion ID
        current_user: Current admin user
        db: Database session

    Returns:
        Updated suggestion object
    """
    suggestion = _get_suggestion(db, suggestion_id, post_id)

    if suggestion["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Suggestion is already {suggestion['status']}",
        )

    now = datetime.utcnow()

    db.execute(
        text(
            "UPDATE ai_tag_suggestions "
            "SET status = 'rejected', reviewed_by = :uid, reviewed_at = :now "
            "WHERE id = :id"
        ),
        {"uid": current_user.id, "now": now, "id": suggestion_id},
    )

    db.commit()

    logger.info(
        f"[AI-TAG] {current_user.patreon_username} rejected suggestion {suggestion_id}: "
        f"'{suggestion['tag']}' on post {post_id}"
    )

    row = db.execute(
        text(
            "SELECT id, post_id, tag, confidence, source, model_version, "
            "       status, reviewed_by, reviewed_at, created_at "
            "FROM ai_tag_suggestions WHERE id = :id"
        ),
        {"id": suggestion_id},
    ).mappings().first()

    return _suggestion_to_dict(row)
