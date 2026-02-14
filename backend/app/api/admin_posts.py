"""Admin Post Import and Management API endpoints.

WARNING: This file contains legacy code that references the removed AdminSettings model.
These endpoints are currently BROKEN and need to be refactored to use the new Phase 2 architecture.

TODO (Phase 2 Cleanup):
- Remove all references to AdminSettings model (which was removed in migration)
- Refactor to use User.patreon_tokens relationship instead
- Update token refresh logic to use new PatreonToken model
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.post import Post
from app.models.user import User
from app.schemas.post import Post as PostSchema
from app.schemas.post import PostUpdate
from app.services import user_service
from app.utils.validation import normalize_array_field, normalize_text

router = APIRouter()


# ============================================================================
# POST IMPORT ENDPOINTS (Phase 1: Community Features)
# ============================================================================


@router.get("/posts/pending")
async def get_pending_posts(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get all pending posts for review.

    Args:
        page: Page number (1-indexed)
        limit: Posts per page
        current_user: Current admin user
        db: Database session

    Returns:
        Dict with posts list, pagination info, and latest published post date
    """
    offset = (page - 1) * limit

    # Get pending posts (oldest first for processing order)
    posts = (
        db.query(Post)
        .filter(Post.status == "pending")
        .order_by(Post.timestamp.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Get total count of pending posts
    total_pending = db.query(Post).filter(Post.status == "pending").count()

    # Get latest published post date
    latest_post = (
        db.query(Post.timestamp)
        .filter(Post.status == "published")
        .order_by(Post.timestamp.desc())
        .first()
    )

    latest_post_date = latest_post[0] if latest_post else None

    return {
        "posts": posts,
        "total": total_pending,
        "page": page,
        "limit": limit,
        "latest_published_date": latest_post_date,
    }


@router.patch("/posts/{post_id}", response_model=PostSchema)
async def update_pending_post(
    post_id: int,
    update_data: PostUpdate,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update a pending post (add characters/series/tags).

    Args:
        post_id: Post ID
        update_data: Update data
        current_user: Current admin user
        db: Database session

    Returns:
        Updated post
    """
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Update fields if provided (with normalization)
    if update_data.characters is not None:
        post.characters = normalize_array_field(update_data.characters)
    if update_data.series is not None:
        post.series = normalize_array_field(update_data.series)
    if update_data.tags is not None:
        post.tags = normalize_array_field(update_data.tags)
    if update_data.title is not None:
        post.title = normalize_text(update_data.title)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    return post


@router.post("/posts/{post_id}/publish", response_model=PostSchema)
async def publish_post(
    post_id: int,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Publish a pending post (makes it visible in search).
    Auto-generates tags if not already set.

    Args:
        post_id: Post ID
        current_user: Current admin user
        db: Database session

    Returns:
        Published post
    """
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Post is already published"
        )

    # Validate required fields
    if not post.characters or not post.series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post must have at least one character and series before publishing",
        )

    # Tags are optional - can be empty or set by admin
    # No auto-generation for now

    # Change status to published
    post.status = "published"
    post.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(post)

    return post


@router.post("/posts/bulk-publish")
async def bulk_publish_posts(
    post_ids: List[int],
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Publish multiple posts at once.

    Args:
        post_ids: List of post IDs to publish
        current_user: Current admin user
        db: Database session

    Returns:
        Summary of published/failed posts
    """
    published = []
    failed = []

    for post_id in post_ids:
        post = db.query(Post).filter(Post.id == post_id).first()

        if not post:
            failed.append({"id": post_id, "reason": "Not found"})
            continue

        if post.status == "published":
            failed.append({"id": post_id, "reason": "Already published"})
            continue

        if not post.characters or not post.series:
            failed.append({"id": post_id, "reason": "Missing characters/series"})
            continue

        # Tags are optional - can be empty or set by admin
        # No auto-generation for now

        # Change status to published
        post.status = "published"
        post.updated_at = datetime.utcnow()

        published.append(post_id)

    db.commit()

    return {
        "message": f"Published {len(published)} posts, {len(failed)} failed",
        "published": published,
        "failed": failed,
        "total": len(post_ids),
    }


@router.post("/posts/{post_id}/skip", response_model=PostSchema)
async def skip_post(
    post_id: int,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Mark a post as skipped (for non-character posts like announcements).
    Skipped posts won't appear in search results but will prevent re-import.

    Args:
        post_id: Post ID
        current_user: Current admin user
        db: Database session

    Returns:
        Skipped post
    """
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    # Change status to skipped
    post.status = "skipped"
    post.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(post)

    return post


@router.delete("/posts/{post_id}")
async def delete_pending_post(
    post_id: int,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Delete a pending post (if it was imported by mistake).
    Cannot delete published posts.

    Args:
        post_id: Post ID
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete published posts. Unpublish first if needed.",
        )

    db.delete(post)
    db.commit()

    return {"message": "Post deleted successfully"}


@router.delete("/posts/bulk-delete")
async def bulk_delete_posts(
    post_ids: List[int],
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Delete multiple pending posts at once.

    Args:
        post_ids: List of post IDs to delete
        current_user: Current admin user
        db: Database session

    Returns:
        Summary of deleted/failed posts
    """
    deleted = []
    failed = []

    for post_id in post_ids:
        post = db.query(Post).filter(Post.id == post_id).first()

        if not post:
            failed.append({"id": post_id, "reason": "Not found"})
            continue

        if post.status == "published":
            failed.append({"id": post_id, "reason": "Cannot delete published posts"})
            continue

        db.delete(post)
        deleted.append(post_id)

    db.commit()

    return {
        "message": f"Deleted {len(deleted)} posts, {len(failed)} failed",
        "deleted": deleted,
        "failed": failed,
        "total": len(post_ids),
    }
