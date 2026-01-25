"""Admin Post Import and Management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.schemas.post import Post as PostSchema, PostUpdate
from app.services import user_service
from app.services.patreon_service import PatreonService, PatreonAPIError
from app.models.user import User
from app.models.post import Post
from app.models.admin_settings import AdminSettings
from app.utils.validation import normalize_array_field, normalize_text

router = APIRouter()


# ============================================================================
# POST IMPORT ENDPOINTS (Phase 1: Community Features)
# ============================================================================


@router.get("/patreon/tiers")
async def get_vama_tier_ids(
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Fetch VAMA's Patreon tier IDs and details.

    This endpoint queries the Patreon API to get all tier information for VAMA's campaign.
    Use this to find the tier IDs that should be allowed access to the site.

    Args:
        current_user: Current admin user
        db: Database session

    Returns:
        List of tiers with IDs, titles, and amounts
    """
    import httpx

    # Get admin's Patreon token
    admin_settings = (
        db.query(AdminSettings).filter(AdminSettings.user_id == current_user.id).first()
    )

    if not admin_settings or not admin_settings.patreon_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin must be logged in with Patreon to fetch tier information.",
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
                detail=f"Failed to refresh Patreon token: {str(e)}",
            )

    # Fetch campaign tiers
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.patreon.com/api/oauth2/v2/campaigns/{settings.patreon_creator_id}",
            params={
                "include": "tiers",
                "fields[tier]": "title,amount_cents,description,patron_count,published",
            },
            headers={"Authorization": f"Bearer {admin_settings.patreon_access_token}"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch tiers from Patreon: {response.text}",
            )

        data = response.json()

        # Extract tier information
        tiers = []
        for item in data.get("included", []):
            if item.get("type") == "tier":
                tier_attrs = item.get("attributes", {})
                tiers.append(
                    {
                        "id": item.get("id"),
                        "title": tier_attrs.get("title"),
                        "amount_cents": tier_attrs.get("amount_cents"),
                        "amount_dollars": tier_attrs.get("amount_cents", 0) / 100,
                        "description": tier_attrs.get("description"),
                        "patron_count": tier_attrs.get("patron_count"),
                        "published": tier_attrs.get("published"),
                    }
                )

        # Sort by amount
        tiers.sort(key=lambda t: t["amount_cents"])

        return {
            "campaign_id": settings.patreon_creator_id,
            "tiers": tiers,
            "total_tiers": len(tiers),
        }


@router.post("/posts/fetch-new")
async def fetch_new_posts(
    session_id: str,
    creator_username: str = "vama",
    since_days: int = 2,  # Changed default to 2 days for testing
    current_user: User = Depends(user_service.get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Fetch new posts from Patreon using gallery-dl with admin's OAuth token.
    Posts are imported with status='pending' for review.

    Args:
        session_id: Patreon session_id cookie value for gallery-dl authentication
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

    # Get admin's Patreon tokens from admin_settings (for OAuth API calls)
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

    # Fetch posts using gallery-dl (with session_id cookie for authentication)
    try:
        posts_metadata = patreon.fetch_posts_with_gallery_dl(
            creator_username=creator_username,
            since_date=since_date,
            session_id=session_id,
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
                patreon_url=post_data["url"],
                timestamp=post_data["timestamp"],
                thumbnail_url=post_data.get("thumbnail_url"),
                thumbnail_urls=post_data.get("thumbnail_urls", []),
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
