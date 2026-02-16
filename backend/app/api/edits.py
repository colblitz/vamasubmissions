"""Post Edit API endpoints."""

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.post_edit import (
    EditHistoryList,
    EditRejectRequest,
    PostEdit,
    PostEditCreate,
    PostEditList,
)
from app.services import edit_service
from app.services.user_service import get_current_admin_user, get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/suggest", response_model=PostEdit, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def suggest_edit(
    request: Request,
    edit_data: PostEditCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Suggest an edit to a post.
    Rate limited to 10 requests per minute.

    If the user is an admin, the edit is automatically approved.

    Args:
        request: FastAPI request object
        edit_data: Edit suggestion data
        current_user: Current authenticated user
        db: Database session

    Returns:
        Created edit suggestion (auto-approved if admin)
    """
    # Create the edit suggestion
    edit = edit_service.suggest_edit(db, current_user.id, edit_data)

    # Log edit submission
    import logging

    logger = logging.getLogger(__name__)
    action_type = "AUTO-APPROVED" if current_user.role == "admin" else "SUBMITTED"
    logger.info(
        f"[EDIT] {current_user.patreon_username} {action_type} edit {edit.id}: {edit.action} {edit.value} to {edit.field_name} on post {edit.post_id}"
    )

    # If user is admin, auto-approve the edit immediately
    if current_user.role == "admin":
        edit = edit_service.approve_edit(db, edit.id, current_user.id)

    return edit


@router.get("/pending", response_model=PostEditList)
async def get_pending_edits(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all pending edit suggestions.

    Args:
        page: Page number (1-indexed)
        limit: Results per page
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of pending edits with details
    """
    return edit_service.get_pending_edits(db, page=page, limit=limit)


@router.get("/pending-for-post/{post_id}")
async def get_pending_edits_for_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get pending edit suggestions for a specific post.

    Args:
        post_id: Post ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of pending edits for the post
    """
    return edit_service.get_pending_edits_for_post(db, post_id, current_user.id)


@router.get("/pending-for-posts")
async def get_pending_edits_for_posts(
    post_ids: str = Query(..., description="Comma-separated post IDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get pending edit suggestions for multiple posts (batch query).

    This endpoint solves the N+1 query problem by fetching pending edits
    for multiple posts in a single database query.

    Args:
        post_ids: Comma-separated list of post IDs (e.g., "1,2,3,4,5")
        current_user: Current authenticated user
        db: Database session

    Returns:
        Dict mapping post_id to list of pending edits
        Example: {"1": [...], "2": [...], "3": [...]}
    """
    # Parse post IDs
    try:
        ids = [int(id.strip()) for id in post_ids.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid post_ids format. Expected comma-separated integers.",
        )

    if len(ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 100 post IDs per request"
        )

    return edit_service.get_pending_edits_for_posts(db, ids, current_user.id)


@router.post("/{edit_id}/approve", response_model=PostEdit)
async def approve_edit(
    edit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Approve an edit suggestion and apply it to the post.
    Cannot approve your own suggestions.

    Args:
        edit_id: Edit ID to approve
        current_user: Current authenticated user
        db: Database session

    Returns:
        Approved edit
    """
    edit = edit_service.approve_edit(db, edit_id, current_user.id)

    # Log approval
    import logging

    logger = logging.getLogger(__name__)
    logger.info(
        f"[APPROVE] {current_user.patreon_username} approved edit {edit_id}: {edit.action} {edit.value} to {edit.field_name} on post {edit.post_id}"
    )

    return edit


@router.post("/{edit_id}/reject", response_model=PostEdit)
async def reject_edit(
    edit_id: int,
    reject_data: EditRejectRequest = Body(default=None),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Reject an edit suggestion (admin only).

    Args:
        edit_id: Edit ID to reject
        reject_data: Optional rejection data including reason
        current_user: Current admin user
        db: Database session

    Returns:
        Rejected edit
    """
    reason = reject_data.reason if reject_data else None
    edit = edit_service.reject_edit(db, edit_id, current_user.id, is_admin=True, reason=reason)

    # Log rejection
    import logging

    logger = logging.getLogger(__name__)
    logger.info(
        f"[REJECT] {current_user.patreon_username} rejected edit {edit_id}: {edit.action} {edit.value} from {edit.field_name} on post {edit.post_id}"
    )

    return edit


@router.get("/history", response_model=EditHistoryList)
async def get_edit_history(
    post_id: int = Query(None, description="Filter by post ID"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get edit history (audit log).

    Args:
        post_id: Optional post ID to filter by
        page: Page number (1-indexed)
        limit: Results per page
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of edit history entries
    """
    return edit_service.get_edit_history(
        db,
        post_id=post_id,
        page=page,
        limit=limit,
    )


@router.post("/history/{history_id}/undo", status_code=status.HTTP_200_OK)
async def undo_edit(
    history_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Undo an edit from history (admin only).

    Args:
        history_id: History entry ID
        current_user: Current admin user
        db: Database session

    Returns:
        Success message
    """
    edit_service.undo_edit(db, history_id, current_user.id, is_admin=True)
    return {"message": "Edit undone successfully"}
