"""
API routes for global edit suggestions (bulk rename)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.services.user_service import get_current_user
from app.services.global_edit_service import GlobalEditService
from app.schemas.global_edit import (
    GlobalEditPreviewRequest,
    GlobalEditSuggestionCreate,
    GlobalEditSuggestionResponse,
    GlobalEditPreview,
    GlobalEditHistoryResponse,
    GlobalEditApproveRequest,
    GlobalEditRejectRequest,
    GlobalEditUndoRequest,
)

router = APIRouter(prefix="/api/global-edits", tags=["global-edits"])


@router.post("/preview", response_model=GlobalEditPreview)
def preview_global_edit(
    data: GlobalEditPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Preview which posts would be affected by a global edit

    This endpoint shows a preview before creating the suggestion.
    Only requires field_name and pattern - action and action_value are not needed for preview.
    
    Args:
        data: The preview request (field_name and pattern only)
    """
    try:
        preview = GlobalEditService.preview_global_edit(db, data.field_name, data.pattern)
        return preview
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/suggest", response_model=GlobalEditSuggestionResponse)
def create_global_edit_suggestion(
    data: GlobalEditSuggestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new global edit suggestion

    This will find all posts matching the pattern and create a suggestion
    to perform the specified action (replace with action_value or remove) 
    across all affected posts.
    """
    try:
        suggestion = GlobalEditService.create_suggestion(db, data, current_user.id)

        # Build response with usernames
        response = GlobalEditSuggestionResponse(
            id=suggestion.id,
            suggester_id=suggestion.suggester_id,
            suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
            field_name=suggestion.field_name,
            pattern=suggestion.pattern,
            action=suggestion.action,
            action_value=suggestion.action_value,
            status=suggestion.status,
            approver_id=suggestion.approver_id,
            approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
            created_at=suggestion.created_at,
            approved_at=suggestion.approved_at,
            applied_at=suggestion.applied_at,
        )

        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending", response_model=List[GlobalEditSuggestionResponse])
def get_pending_global_edits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all pending global edit suggestions
    """
    suggestions = GlobalEditService.get_pending_suggestions(db)

    # Build responses with usernames
    responses = []
    for suggestion in suggestions:
        responses.append(
            GlobalEditSuggestionResponse(
                id=suggestion.id,
                suggester_id=suggestion.suggester_id,
                suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
                field_name=suggestion.field_name,
                pattern=suggestion.pattern,
                action=suggestion.action,
                action_value=suggestion.action_value,
                status=suggestion.status,
                approver_id=suggestion.approver_id,
                approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
                created_at=suggestion.created_at,
                approved_at=suggestion.approved_at,
                applied_at=suggestion.applied_at,
            )
        )

    return responses


@router.get("/{suggestion_id}/preview", response_model=GlobalEditPreview)
def get_global_edit_preview(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get preview of affected posts for a specific global edit suggestion
    
    This retrieves a fresh preview based on the current state of posts,
    using the pattern from the stored suggestion.
    """
    suggestion = GlobalEditService.get_suggestion_by_id(db, suggestion_id)

    if not suggestion:
        raise HTTPException(status_code=404, detail="Global edit suggestion not found")

    # Get fresh preview (in case posts have changed since suggestion was created)
    preview = GlobalEditService.preview_global_edit(
        db, 
        suggestion.field_name, 
        suggestion.pattern
    )

    return preview


@router.post("/{suggestion_id}/approve", response_model=GlobalEditSuggestionResponse)
def approve_global_edit(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve and apply a global edit suggestion

    This will perform a bulk update across all affected posts.
    Cannot approve your own suggestion.
    """
    try:
        suggestion = GlobalEditService.approve_suggestion(db, suggestion_id, current_user.id)

        # Build response with usernames
        response = GlobalEditSuggestionResponse(
            id=suggestion.id,
            suggester_id=suggestion.suggester_id,
            suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
            field_name=suggestion.field_name,
            pattern=suggestion.pattern,
            action=suggestion.action,
            action_value=suggestion.action_value,
            status=suggestion.status,
            approver_id=suggestion.approver_id,
            approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
            created_at=suggestion.created_at,
            approved_at=suggestion.approved_at,
            applied_at=suggestion.applied_at,
        )

        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{suggestion_id}/reject", response_model=GlobalEditSuggestionResponse)
def reject_global_edit(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a global edit suggestion
    """
    try:
        suggestion = GlobalEditService.reject_suggestion(db, suggestion_id)

        # Build response with usernames
        response = GlobalEditSuggestionResponse(
            id=suggestion.id,
            suggester_id=suggestion.suggester_id,
            suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
            field_name=suggestion.field_name,
            pattern=suggestion.pattern,
            action=suggestion.action,
            action_value=suggestion.action_value,
            status=suggestion.status,
            approver_id=suggestion.approver_id,
            approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
            created_at=suggestion.created_at,
            approved_at=suggestion.approved_at,
            applied_at=suggestion.applied_at,
        )

        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=List[GlobalEditHistoryResponse])
def get_global_edit_history(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get history of applied global edit suggestions
    """
    suggestions = GlobalEditService.get_history(db, limit)

    # Build responses with usernames
    responses = []
    for suggestion in suggestions:
        responses.append(
            GlobalEditHistoryResponse(
                id=suggestion.id,
                suggester_id=suggestion.suggester_id,
                suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
                approver_id=suggestion.approver_id,
                approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
                field_name=suggestion.field_name,
                pattern=suggestion.pattern,
                action=suggestion.action,
                action_value=suggestion.action_value,
                applied_at=suggestion.applied_at,
            )
        )

    return responses


@router.post("/{suggestion_id}/undo", response_model=GlobalEditSuggestionResponse)
def undo_global_edit(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Undo a previously applied global edit suggestion (admin only)

    This restores the previous values for all affected posts.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        suggestion = GlobalEditService.undo_suggestion(db, suggestion_id, current_user.id)

        # Build response with usernames
        response = GlobalEditSuggestionResponse(
            id=suggestion.id,
            suggester_id=suggestion.suggester_id,
            suggester_username=suggestion.suggester.patreon_username if suggestion.suggester else None,
            field_name=suggestion.field_name,
            pattern=suggestion.pattern,
            action=suggestion.action,
            action_value=suggestion.action_value,
            status=suggestion.status,
            approver_id=suggestion.approver_id,
            approver_username=suggestion.approver.patreon_username if suggestion.approver else None,
            created_at=suggestion.created_at,
            approved_at=suggestion.approved_at,
            applied_at=suggestion.applied_at,
        )

        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
