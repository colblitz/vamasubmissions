"""Post Edit service for business logic."""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from fastapi import HTTPException, status
from typing import List, Optional
from datetime import datetime

from app.models.post import Post
from app.models.post_edit import PostEdit
from app.models.edit_history import EditHistory
from app.models.user import User
from app.schemas.post_edit import (
    PostEditCreate,
    PostEditWithDetails,
    PostEditList,
    EditHistoryEntry,
    EditHistoryList,
)
from app.utils.validation import normalize_text


def get_edit_by_id(db: Session, edit_id: int) -> Optional[PostEdit]:
    """Get edit by ID."""
    return db.query(PostEdit).filter(PostEdit.id == edit_id).first()


def suggest_edit(
    db: Session,
    user_id: int,
    edit_data: PostEditCreate,
) -> PostEdit:
    """
    Suggest an edit to a post.

    Args:
        db: Database session
        user_id: User ID suggesting the edit
        edit_data: Edit suggestion data

    Returns:
        Created edit suggestion
    """
    # Verify post exists
    post = db.query(Post).filter(Post.id == edit_data.post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Validate and normalize the edit
    field_name = edit_data.field_name
    action = edit_data.action
    value = normalize_text(edit_data.value)

    # Reject empty values after normalization
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Value cannot be empty or whitespace only",
        )

    # Get current field value
    current_values = getattr(post, field_name, [])

    if action == "ADD":
        # Check if value already exists (case-insensitive)
        if any(v.lower() == value.lower() for v in current_values):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Value '{value}' already exists in {field_name}",
            )

        # Check if there's already a pending ADD suggestion for this value
        existing_pending = (
            db.query(PostEdit)
            .filter(
                and_(
                    PostEdit.post_id == edit_data.post_id,
                    PostEdit.field_name == field_name,
                    PostEdit.action == "ADD",
                    func.lower(PostEdit.value) == value.lower(),
                    PostEdit.status == "pending",
                )
            )
            .first()
        )

        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"There is already a pending suggestion to add '{value}' to {field_name}",
            )

    elif action == "DELETE":
        # Check if value exists to delete (case-insensitive)
        if not any(v.lower() == value.lower() for v in current_values):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Value '{value}' not found in {field_name}",
            )

        # Check if there's already a pending DELETE suggestion for this value
        existing_pending = (
            db.query(PostEdit)
            .filter(
                and_(
                    PostEdit.post_id == edit_data.post_id,
                    PostEdit.field_name == field_name,
                    PostEdit.action == "DELETE",
                    func.lower(PostEdit.value) == value.lower(),
                    PostEdit.status == "pending",
                )
            )
            .first()
        )

        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"There is already a pending suggestion to remove '{value}' from {field_name}",
            )

    # Create edit suggestion
    edit = PostEdit(
        post_id=edit_data.post_id,
        suggester_id=user_id,
        field_name=field_name,
        action=action,
        value=value,
        status="pending",
    )

    db.add(edit)
    db.commit()
    db.refresh(edit)

    return edit


def approve_edit(
    db: Session,
    edit_id: int,
    approver_id: int,
) -> PostEdit:
    """
    Approve an edit suggestion and apply it to the post.

    Args:
        db: Database session
        edit_id: Edit ID to approve
        approver_id: User ID approving the edit

    Returns:
        Approved edit
    """
    edit = get_edit_by_id(db, edit_id)
    if not edit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edit not found",
        )

    # Check if edit is pending
    if edit.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Edit is already {edit.status}",
        )

    # Check if approver is different from suggester (unless approver is admin)
    if edit.suggester_id == approver_id:
        # Get approver user to check if they're an admin
        approver = db.query(User).filter(User.id == approver_id).first()
        if not approver or approver.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot approve your own edit suggestion",
            )

    # Get the post
    post = db.query(Post).filter(Post.id == edit.post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Apply the edit
    field_name = edit.field_name
    action = edit.action
    value = edit.value

    current_values = list(getattr(post, field_name, []))

    if action == "ADD":
        # Add value if not already present (case-insensitive check)
        if not any(v.lower() == value.lower() for v in current_values):
            current_values.append(value)
    elif action == "DELETE":
        # Remove value (case-insensitive)
        current_values = [v for v in current_values if v.lower() != value.lower()]

    # Update post
    setattr(post, field_name, current_values)
    post.updated_at = datetime.utcnow()

    # Update edit status
    edit.status = "approved"
    edit.approver_id = approver_id
    edit.approved_at = datetime.utcnow()

    # Create history entry
    history = EditHistory(
        post_id=edit.post_id,
        suggester_id=edit.suggester_id,
        approver_id=approver_id,
        field_name=field_name,
        action=action,
        value=value,
        applied_at=datetime.utcnow(),
    )

    db.add(history)
    db.commit()
    db.refresh(edit)

    return edit


def reject_edit(
    db: Session,
    edit_id: int,
    user_id: int,
    is_admin: bool = False,
) -> PostEdit:
    """
    Reject an edit suggestion (admin only).

    Args:
        db: Database session
        edit_id: Edit ID to reject
        user_id: User ID rejecting the edit
        is_admin: Whether user is admin

    Returns:
        Rejected edit
    """
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reject edits",
        )

    edit = get_edit_by_id(db, edit_id)
    if not edit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edit not found",
        )

    if edit.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Edit is already {edit.status}",
        )

    edit.status = "rejected"
    edit.approver_id = user_id
    edit.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(edit)

    return edit


def get_pending_edits_for_post(
    db: Session,
    post_id: int,
    current_user_id: int,
) -> List[dict]:
    """
    Get pending edit suggestions for a specific post.

    Args:
        db: Database session
        post_id: Post ID
        current_user_id: Current user ID (to mark own suggestions)

    Returns:
        List of pending edits for the post
    """
    # Query pending edits for this post
    edits = (
        db.query(PostEdit)
        .filter(PostEdit.post_id == post_id, PostEdit.status == "pending")
        .order_by(PostEdit.created_at.asc())
        .all()
    )

    # Build response with user info
    result = []
    for edit in edits:
        suggester = (
            db.query(User).filter(User.id == edit.suggester_id).first()
            if edit.suggester_id
            else None
        )

        edit_dict = {
            "id": edit.id,
            "post_id": edit.post_id,
            "suggester_id": edit.suggester_id,
            "field_name": edit.field_name,
            "action": edit.action,
            "value": edit.value,
            "status": edit.status,
            "created_at": edit.created_at,
            "suggester_username": suggester.patreon_username if suggester else "Unknown",
            "is_own_suggestion": edit.suggester_id == current_user_id,
        }
        result.append(edit_dict)

    return result


def get_pending_edits_for_posts(
    db: Session,
    post_ids: List[int],
    current_user_id: int,
) -> dict:
    """
    Get pending edit suggestions for multiple posts (batch query).

    This function solves the N+1 query problem by fetching pending edits
    for multiple posts in a single database query.

    Args:
        db: Database session
        post_ids: List of post IDs
        current_user_id: Current user ID (to mark own suggestions)

    Returns:
        Dict mapping post_id to list of pending edits
        Example: {1: [...], 2: [...], 3: [...]}
    """
    if not post_ids:
        return {}

    # Query all pending edits for these posts in one query
    edits = (
        db.query(PostEdit)
        .filter(PostEdit.post_id.in_(post_ids), PostEdit.status == "pending")
        .order_by(PostEdit.post_id.asc(), PostEdit.created_at.asc())
        .all()
    )

    # Get all unique suggester IDs
    suggester_ids = list(set(edit.suggester_id for edit in edits if edit.suggester_id))

    # Batch fetch all suggesters
    suggesters = {}
    if suggester_ids:
        suggester_list = db.query(User).filter(User.id.in_(suggester_ids)).all()
        suggesters = {user.id: user for user in suggester_list}

    # Group edits by post_id
    result = {post_id: [] for post_id in post_ids}

    for edit in edits:
        suggester = suggesters.get(edit.suggester_id)

        edit_dict = {
            "id": edit.id,
            "post_id": edit.post_id,
            "suggester_id": edit.suggester_id,
            "field_name": edit.field_name,
            "action": edit.action,
            "value": edit.value,
            "status": edit.status,
            "created_at": edit.created_at,
            "suggester_username": suggester.patreon_username if suggester else "Unknown",
            "is_own_suggestion": edit.suggester_id == current_user_id,
        }
        result[edit.post_id].append(edit_dict)

    return result


def get_pending_edits(
    db: Session,
    page: int = 1,
    limit: int = 50,
) -> PostEditList:
    """
    Get all pending edit suggestions.

    Args:
        db: Database session
        page: Page number (1-indexed)
        limit: Results per page

    Returns:
        List of pending edits with details
    """
    # Query pending edits with post and user info
    q = db.query(PostEdit).filter(PostEdit.status == "pending")

    # Get total count
    total = q.count()

    # Apply pagination
    offset = (page - 1) * limit
    edits = q.order_by(PostEdit.created_at.asc()).offset(offset).limit(limit).all()

    # Build detailed response
    edits_with_details = []
    for edit in edits:
        post = db.query(Post).filter(Post.id == edit.post_id).first()
        suggester = (
            db.query(User).filter(User.id == edit.suggester_id).first()
            if edit.suggester_id
            else None
        )

        # Get thumbnail URL if available
        post_thumbnail = None
        if post and post.thumbnail_urls:
            post_thumbnail = post.thumbnail_urls[0] if post.thumbnail_urls else None

        edit_detail = PostEditWithDetails(
            id=edit.id,
            post_id=edit.post_id,
            suggester_id=edit.suggester_id,
            field_name=edit.field_name,
            action=edit.action,
            value=edit.value,
            status=edit.status,
            approver_id=edit.approver_id,
            created_at=edit.created_at,
            approved_at=edit.approved_at,
            post_title=post.title if post else "Unknown",
            post_thumbnail=post_thumbnail,
            suggester_username=suggester.patreon_username if suggester else "Unknown",
            approver_username=None,
        )
        edits_with_details.append(edit_detail)

    return PostEditList(
        edits=edits_with_details,
        total=total,
        page=page,
        limit=limit,
    )


def get_edit_history(
    db: Session,
    post_id: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
) -> EditHistoryList:
    """
    Get edit history (audit log).

    Args:
        db: Database session
        post_id: Optional post ID to filter by
        page: Page number (1-indexed)
        limit: Results per page

    Returns:
        List of edit history entries
    """
    q = db.query(EditHistory)

    if post_id:
        q = q.filter(EditHistory.post_id == post_id)

    # Get total count
    total = q.count()

    # Apply pagination
    offset = (page - 1) * limit
    history_entries = q.order_by(EditHistory.applied_at.desc()).offset(offset).limit(limit).all()

    # Build detailed response
    history_with_details = []
    for entry in history_entries:
        post = db.query(Post).filter(Post.id == entry.post_id).first()
        suggester = (
            db.query(User).filter(User.id == entry.suggester_id).first()
            if entry.suggester_id
            else None
        )
        approver = (
            db.query(User).filter(User.id == entry.approver_id).first()
            if entry.approver_id
            else None
        )

        # Get thumbnail URL if available
        post_thumbnail = None
        if post and post.thumbnail_urls:
            post_thumbnail = post.thumbnail_urls[0] if post.thumbnail_urls else None

        history_detail = EditHistoryEntry(
            id=entry.id,
            post_id=entry.post_id,
            suggester_id=entry.suggester_id,
            approver_id=entry.approver_id,
            field_name=entry.field_name,
            action=entry.action,
            value=entry.value,
            applied_at=entry.applied_at,
            post_title=post.title if post else "Unknown",
            post_thumbnail=post_thumbnail,
            suggester_username=suggester.patreon_username if suggester else "Unknown",
            approver_username=approver.patreon_username if approver else "Unknown",
        )
        history_with_details.append(history_detail)

    return EditHistoryList(
        history=history_with_details,
        total=total,
        page=page,
        limit=limit,
    )


def undo_edit(
    db: Session,
    history_id: int,
    user_id: int,
    is_admin: bool = False,
) -> EditHistory:
    """
    Undo an edit from history (admin only).

    Args:
        db: Database session
        history_id: History entry ID
        user_id: User ID performing the undo
        is_admin: Whether user is admin

    Returns:
        History entry
    """
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can undo edits",
        )

    history = db.query(EditHistory).filter(EditHistory.id == history_id).first()
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found",
        )

    # Get the post
    post = db.query(Post).filter(Post.id == history.post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Reverse the edit
    field_name = history.field_name
    action = history.action
    value = history.value

    current_values = list(getattr(post, field_name, []))

    # Reverse the action
    if action == "ADD":
        # Remove the value that was added
        current_values = [v for v in current_values if v.lower() != value.lower()]
    elif action == "DELETE":
        # Add back the value that was deleted
        if not any(v.lower() == value.lower() for v in current_values):
            current_values.append(value)

    # Update post
    setattr(post, field_name, current_values)
    post.updated_at = datetime.utcnow()

    db.commit()

    return history
