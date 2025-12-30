"""Submission API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.schemas.submission import (
    Submission,
    SubmissionCreate,
    SubmissionUpdate,
    SubmissionWithImages,
    SubmissionCancel,
)
from app.services import user_service, submission_service
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=Submission, status_code=status.HTTP_201_CREATED)
async def create_submission(
    character_name: str = Form(...),
    series: str = Form(...),
    description: str = Form(...),
    is_public: bool = Form(False),
    is_large_image_set: bool = Form(False),
    is_double_character: bool = Form(False),
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new submission.
    
    Args:
        character_name: Character name
        series: Series name
        description: Description
        is_public: Whether submission is public
        is_large_image_set: Whether this is a large image set request
        is_double_character: Whether this is a double character request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Created submission
    """
    submission = submission_service.create_submission(
        db=db,
        user=current_user,
        character_name=character_name,
        series=series,
        description=description,
        is_public=is_public,
        is_large_image_set=is_large_image_set,
        is_double_character=is_double_character,
    )
    
    return submission


@router.post("/{submission_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_submission_images(
    submission_id: int,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload images for a submission.
    
    Args:
        submission_id: Submission ID
        files: List of image files
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of uploaded images
    """
    # Verify submission exists and user owns it
    submission = submission_service.get_submission_by_id(db, submission_id)
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload images for this submission",
        )
    
    images = await submission_service.save_submission_images(db, submission_id, files)
    
    return {"message": f"Uploaded {len(images)} images", "images": images}


@router.get("/", response_model=List[Submission])
async def list_my_submissions(
    status: Optional[str] = None,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    List current user's submissions.
    
    Args:
        status: Optional status filter
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of submissions
    """
    submissions = submission_service.get_user_submissions(
        db,
        user_id=current_user.id,
        status=status,
    )
    
    return submissions


@router.get("/{submission_id}", response_model=SubmissionWithImages)
async def get_submission(
    submission_id: int,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific submission.
    
    Args:
        submission_id: Submission ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Submission with images
    """
    submission = submission_service.get_submission_by_id(db, submission_id)
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    # Check permissions: owner, admin, or public
    if submission.user_id != current_user.id and not current_user.is_admin:
        if not submission.is_public:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this submission",
            )
    
    return submission


@router.patch("/{submission_id}", response_model=Submission)
async def update_submission(
    submission_id: int,
    submission_update: SubmissionUpdate,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a submission (only pending submissions).
    
    Args:
        submission_id: Submission ID
        submission_update: Updated submission data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated submission
    """
    submission = submission_service.update_submission(
        db=db,
        submission_id=submission_id,
        user=current_user,
        character_name=submission_update.character_name,
        series=submission_update.series,
        description=submission_update.description,
        is_public=submission_update.is_public,
        is_large_image_set=submission_update.is_large_image_set,
        is_double_character=submission_update.is_double_character,
    )
    
    return submission


@router.post("/{submission_id}/cancel", response_model=Submission)
async def cancel_submission(
    submission_id: int,
    cancel_data: Optional[SubmissionCancel] = None,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel a submission and refund credits.
    
    Args:
        submission_id: Submission ID
        cancel_data: Optional cancellation data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Cancelled submission
    """
    reason = cancel_data.reason if cancel_data else None
    
    submission = submission_service.cancel_submission(
        db=db,
        submission_id=submission_id,
        user=current_user,
        reason=reason,
    )
    
    return submission


@router.get("/search/", response_model=List[Submission])
async def search_submissions(
    q: str,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search completed submissions by character name or series.
    
    Args:
        q: Search query
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of matching submissions
    """
    submissions = submission_service.search_submissions(
        db=db,
        query=q,
        user=current_user,
        status="completed",
    )
    
    return submissions


@router.get("/autocomplete/series")
async def autocomplete_series(
    q: str,
    db: Session = Depends(get_db),
):
    """
    Get series names for autocomplete.
    
    Args:
        q: Search query
        db: Database session
        
    Returns:
        List of series names
    """
    series_list = submission_service.get_series_autocomplete(db, q)
    
    return {"series": series_list}
