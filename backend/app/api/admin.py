"""Admin API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.schemas.submission import SubmissionInDB, SubmissionComplete
from app.schemas.queue import QueueStats
from app.schemas.user import UserStats
from app.schemas.post import Post as PostSchema, PostUpdate
from app.services import user_service, submission_service
from app.services.patreon_service import PatreonService, PatreonAPIError
from app.models.user import User
from app.models.submission import Submission
from app.models.post import Post
from app.models.admin_settings import AdminSettings
from app.core.config import settings
from app.utils.validation import normalize_array_field, normalize_text

router = APIRouter()


@router.get("/submissions", response_model=List[SubmissionInDB])
async def list_all_submissions(
    status: Optional[str] = None,
    queue_type: Optional[str] = None,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    List all submissions (admin only).

    Args:
        status: Optional status filter
        queue_type: Optional queue type filter
        current_user: Current admin user
        db: Database session

    Returns:
        List of all submissions
    """
    query = db.query(Submission)

    if status:
        query = query.filter(Submission.status == status)

    if queue_type:
        query = query.filter(Submission.queue_type == queue_type)

    submissions = query.order_by(Submission.submitted_at.desc()).all()

    return submissions


@router.get("/submissions/{submission_id}", response_model=SubmissionInDB)
async def get_submission_admin(
    submission_id: int,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific submission with all details (admin only).

    Args:
        submission_id: Submission ID
        current_user: Current admin user
        db: Database session

    Returns:
        Submission with all details including creator notes
    """
    submission = submission_service.get_submission_by_id(db, submission_id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    return submission


@router.post("/{submission_id}/complete", response_model=SubmissionInDB)
async def complete_submission(
    submission_id: int,
    completion_data: SubmissionComplete,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Mark a submission as complete (admin/creator only).

    Args:
        submission_id: Submission ID
        completion_data: Completion data
        current_user: Current admin user
        db: Database session

    Returns:
        Completed submission
    """
    submission = submission_service.complete_submission(
        db=db,
        submission_id=submission_id,
        patreon_post_link=completion_data.patreon_post_link,
        creator_notes=completion_data.creator_notes,
    )

    return submission


@router.patch("/{submission_id}/notes")
async def update_creator_notes(
    submission_id: int,
    notes: str,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update creator notes for a submission (admin/creator only).

    Args:
        submission_id: Submission ID
        notes: Creator notes
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    submission = submission_service.get_submission_by_id(db, submission_id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    submission.creator_notes = notes
    db.commit()

    return {"message": "Notes updated successfully"}


@router.post("/{submission_id}/start")
async def start_submission(
    submission_id: int,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Mark a submission as in progress (admin/creator only).

    Args:
        submission_id: Submission ID
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    submission = submission_service.get_submission_by_id(db, submission_id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    if submission.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only start pending submissions",
        )

    from datetime import datetime

    submission.status = "in_progress"
    submission.started_at = datetime.utcnow()
    db.commit()

    return {"message": "Submission marked as in progress"}


@router.get("/stats", response_model=QueueStats)
async def get_queue_stats(
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get queue statistics (admin only).

    Args:
        current_user: Current admin user
        db: Database session

    Returns:
        Queue statistics
    """
    # Count submissions by status and queue type
    paid_queue_size = (
        db.query(Submission)
        .filter(Submission.queue_type == "paid", Submission.status == "pending")
        .count()
    )

    free_queue_size = (
        db.query(Submission)
        .filter(Submission.queue_type == "free", Submission.status == "pending")
        .count()
    )

    total_pending = paid_queue_size + free_queue_size

    total_in_progress = db.query(Submission).filter(Submission.status == "in_progress").count()

    total_completed = db.query(Submission).filter(Submission.status == "completed").count()

    # Calculate average completion time
    completed_submissions = (
        db.query(Submission)
        .filter(
            Submission.status == "completed",
            Submission.submitted_at.isnot(None),
            Submission.completed_at.isnot(None),
        )
        .all()
    )

    avg_completion_days = None
    if completed_submissions:
        total_days = sum((s.completed_at - s.submitted_at).days for s in completed_submissions)
        avg_completion_days = total_days / len(completed_submissions)

    # Get popular series
    popular_series = (
        db.query(Submission.series, func.count(Submission.id).label("count"))
        .filter(Submission.status == "completed")
        .group_by(Submission.series)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    popular_series_list = [{"series": series, "count": count} for series, count in popular_series]

    return QueueStats(
        paid_queue_size=paid_queue_size,
        free_queue_size=free_queue_size,
        total_pending=total_pending,
        total_in_progress=total_in_progress,
        total_completed=total_completed,
        avg_completion_days=avg_completion_days,
        popular_series=popular_series_list,
    )


@router.get("/users", response_model=List[UserStats])
async def list_users(
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    List all users with statistics (admin only).

    Args:
        current_user: Current admin user
        db: Database session

    Returns:
        List of users with stats
    """
    # Query user stats view
    users = db.query(User).all()

    user_stats = []
    for user in users:
        pending = (
            db.query(Submission)
            .filter(Submission.user_id == user.id, Submission.status == "pending")
            .count()
        )

        completed = (
            db.query(Submission)
            .filter(Submission.user_id == user.id, Submission.status == "completed")
            .count()
        )

        cancelled = (
            db.query(Submission)
            .filter(Submission.user_id == user.id, Submission.status == "cancelled")
            .count()
        )

        user_stats.append(
            UserStats(
                user_id=user.id,
                patreon_username=user.patreon_username,
                tier=user.tier,
                credits=user.credits,
                pending_submissions=pending,
                completed_submissions=completed,
                cancelled_submissions=cancelled,
            )
        )

    return user_stats


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update a user's role (admin only).

    Args:
        user_id: User ID
        role: New role (patron, creator, admin)
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    if role not in ["patron", "creator", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be patron, creator, or admin",
        )

    user = user_service.get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.role = role
    db.commit()

    return {"message": f"User role updated to {role}"}


@router.post("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: int,
    amount: int,
    reason: str,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Manually adjust a user's credits (admin only).

    Args:
        user_id: User ID
        amount: Amount to adjust (positive or negative)
        reason: Reason for adjustment
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    from app.services import credit_service

    user = user_service.get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Update credits
    new_credits = max(0, min(user.credits + amount, user.max_credits))
    actual_change = new_credits - user.credits

    if actual_change > 0:
        credit_service.add_credits(
            db,
            user_id=user_id,
            amount=actual_change,
            transaction_type="adjustment",
            description=f"Admin adjustment: {reason}",
        )
    elif actual_change < 0:
        credit_service.spend_credits(
            db,
            user_id=user_id,
            amount=-actual_change,
            transaction_type="adjustment",
            description=f"Admin adjustment: {reason}",
        )

    user.credits = new_credits
    db.commit()

    return {
        "message": "Credits adjusted successfully",
        "old_credits": user.credits - actual_change,
        "new_credits": user.credits,
        "change": actual_change,
    }


# ============================================================================
# POST IMPORT ENDPOINTS (Phase 1: Community Features)
# ============================================================================


@router.patch("/settings/session-id")
async def update_session_id(
    session_id: str,
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update admin's Patreon session_id for gallery-dl authentication.
    
    Args:
        session_id: Patreon session_id cookie value
        current_user: Current admin user
        db: Database session
    
    Returns:
        Success message
    """
    # Get or create admin settings
    admin_settings = (
        db.query(AdminSettings).filter(AdminSettings.user_id == current_user.id).first()
    )
    
    if not admin_settings:
        admin_settings = AdminSettings(user_id=current_user.id)
        db.add(admin_settings)
    
    admin_settings.patreon_session_id = session_id
    admin_settings.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Session ID updated successfully"}


@router.get("/settings/session-id")
async def get_session_id_status(
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Check if admin has a session_id configured.
    
    Args:
        current_user: Current admin user
        db: Database session
    
    Returns:
        Status of session_id configuration
    """
    admin_settings = (
        db.query(AdminSettings).filter(AdminSettings.user_id == current_user.id).first()
    )
    
    has_session_id = bool(admin_settings and admin_settings.patreon_session_id)
    
    return {
        "has_session_id": has_session_id,
        "message": "Session ID is configured" if has_session_id else "Session ID not configured"
    }


@router.post("/posts/fetch-new")
async def fetch_new_posts(
    creator_username: str = "vama",
    since_days: int = 2,  # Changed default to 2 days for testing
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Fetch new posts from Patreon using gallery-dl with admin's OAuth token.
    Posts are imported with status='pending' for review.

    Args:
        creator_username: Patreon creator username (default: vama)
        since_days: Look back N days for new posts (default 2, only used if no posts exist yet)
        current_user: Current admin user
        db: Database session

    Returns:
        Import summary with counts

    Note:
        If posts already exist in the database, fetches posts since the most recent post.
        The since_days parameter is only used as a fallback when the database is empty.
    """
    print(f"[FETCH-NEW-POSTS] Starting fetch for user {current_user.patreon_username}")
    print(f"[FETCH-NEW-POSTS] Creator: {creator_username}, Since days: {since_days}")

    # Get admin's Patreon tokens from admin_settings
    admin_settings = (
        db.query(AdminSettings).filter(AdminSettings.user_id == current_user.id).first()
    )

    print(f"[FETCH-NEW-POSTS] Admin settings found: {admin_settings is not None}")

    if not admin_settings or not admin_settings.patreon_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin must be logged in with Patreon. Please log out and log in again to refresh your token.",
        )

    # Check if token is expired and refresh if needed
    if admin_settings.is_token_expired:
        try:
            new_tokens = PatreonService.refresh_access_token(admin_settings.patreon_refresh_token)
            admin_settings.patreon_access_token = new_tokens["access_token"]
            admin_settings.patreon_refresh_token = new_tokens["refresh_token"]
            admin_settings.patreon_token_expires_at = datetime.utcnow() + timedelta(
                seconds=new_tokens["expires_in"]
            )
            admin_settings.updated_at = datetime.utcnow()
            db.commit()
        except PatreonAPIError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to refresh Patreon token: {str(e)}. Please log out and log in again.",
            )

    # Initialize Patreon service with admin's token
    patreon = PatreonService(admin_settings.patreon_access_token)

    # Get the most recent post date from database
    most_recent_post = db.query(Post).order_by(Post.timestamp.desc()).first()

    if most_recent_post:
        # Fetch posts since the most recent one
        since_date = most_recent_post.timestamp
        print(
            f"[FETCH-NEW-POSTS] Using most recent post date: {since_date} (post_id: {most_recent_post.post_id})"
        )
    else:
        # No posts yet, fetch from N days ago
        since_date = datetime.utcnow() - timedelta(days=since_days)
        print(
            f"[FETCH-NEW-POSTS] No existing posts, using fallback: {since_days} days ago = {since_date}"
        )

    # Check if admin has session_id configured
    if not admin_settings.patreon_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patreon session_id not configured. Please add your session_id in admin settings.",
        )

    # Fetch posts using gallery-dl (with session_id cookie for authentication)
    try:
        posts_metadata = patreon.fetch_posts_with_gallery_dl(
            creator_username=creator_username,
            since_date=since_date,
            session_id=admin_settings.patreon_session_id,
        )
    except PatreonAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch posts from Patreon: {str(e)}",
        )

    # Step 1: Extract post IDs from metadata
    print(f"[IMPORT] Processing {len(posts_metadata)} posts from gallery-dl")
    post_ids_to_check = [str(m.get("id")) for m in posts_metadata if m.get("id")]

    # Step 2: Bulk check which post_ids already exist in database
    existing_post_ids = set()
    if post_ids_to_check:
        existing_posts = db.query(Post.post_id).filter(Post.post_id.in_(post_ids_to_check)).all()
        existing_post_ids = {p.post_id for p in existing_posts}
        print(
            f"[IMPORT] Found {len(existing_post_ids)} existing posts, {len(post_ids_to_check) - len(existing_post_ids)} new"
        )

    # Step 3: Process and import only new posts
    imported_count = 0
    skipped_count = 0
    errors = []

    for metadata in posts_metadata:
        try:
            post_data = patreon.extract_post_data_from_gallery_dl(metadata)

            # Skip if already exists (checked in bulk above)
            if post_data["post_id"] in existing_post_ids:
                skipped_count += 1
                continue

            # Create new post with status='pending'
            new_post = Post(
                post_id=post_data["post_id"],
                title=post_data["title"],
                url=post_data["url"],
                timestamp=post_data["timestamp"],
                image_urls=post_data["image_urls"],
                thumbnail_urls=post_data["thumbnail_urls"],
                status="pending",
                characters=[],  # To be filled in by admin
                series=[],  # To be filled in by admin
                tags=[],  # Will be auto-generated on publish
                raw_patreon_json=post_data["raw_patreon_json"],
            )
            db.add(new_post)
            imported_count += 1
            print(f"[IMPORT] Added post {post_data['post_id']}: {post_data['title']}")

        except Exception as e:
            errors.append({"post_id": metadata.get("id", "unknown"), "error": str(e)})
            print(f"[IMPORT] ERROR processing post {metadata.get('id')}: {e}")

    db.commit()
    print(f"[IMPORT] Committed {imported_count} new posts to database")

    return {
        "message": f"Import complete: {imported_count} new posts imported, {skipped_count} skipped",
        "imported": imported_count,
        "skipped": skipped_count,
        "errors": errors,
        "total_processed": len(posts_metadata),
        "since_date": since_date.isoformat() if since_date else None,
    }


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

    # Get pending posts
    posts = (
        db.query(Post)
        .filter(Post.status == "pending")
        .order_by(Post.timestamp.desc())
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
