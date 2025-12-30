"""Submission service for managing character requests."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status, UploadFile
from typing import Optional, List
from datetime import datetime, timedelta
import os
import uuid
from pathlib import Path

from app.models.submission import Submission, SubmissionImage
from app.models.user import User
from app.core.config import settings
from app.services import credit_service


def get_submission_by_id(db: Session, submission_id: int) -> Optional[Submission]:
    """Get submission by ID."""
    return db.query(Submission).filter(Submission.id == submission_id).first()


def get_user_submissions(
    db: Session,
    user_id: int,
    status: Optional[str] = None,
) -> List[Submission]:
    """
    Get all submissions for a user.
    
    Args:
        db: Database session
        user_id: User ID
        status: Optional status filter
        
    Returns:
        List of submissions
    """
    query = db.query(Submission).filter(Submission.user_id == user_id)
    
    if status:
        query = query.filter(Submission.status == status)
    
    return query.order_by(Submission.submitted_at.desc()).all()


def get_pending_submissions_count(db: Session, user_id: int) -> int:
    """
    Get count of pending submissions for a user.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        Count of pending submissions
    """
    return db.query(Submission).filter(
        Submission.user_id == user_id,
        Submission.status == "pending"
    ).count()


def create_submission(
    db: Session,
    user: User,
    character_name: str,
    series: str,
    description: str,
    is_public: bool = False,
    is_large_image_set: bool = False,
    is_double_character: bool = False,
) -> Submission:
    """
    Create a new submission.
    
    Args:
        db: Database session
        user: User creating the submission
        character_name: Character name
        series: Series name
        description: Description
        is_public: Whether submission is public
        is_large_image_set: Whether this is a large image set request
        is_double_character: Whether this is a double character request
        
    Returns:
        Created submission
        
    Raises:
        HTTPException: If user doesn't have enough credits or permissions
    """
    # Check if tier 1 user already has a pending submission
    if user.tier == 1:
        pending_count = get_pending_submissions_count(db, user.id)
        if pending_count >= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tier 1 users can only have one pending submission at a time",
            )
    
    # Calculate credit cost
    credit_cost = 1
    if is_large_image_set:
        credit_cost += 1
    if is_double_character:
        credit_cost += 1
    
    # Check if user has enough credits (tier 2+)
    if user.tier > 1:
        if user.credits < credit_cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough credits. Need {credit_cost}, have {user.credits}",
            )
    
    # Determine queue type
    queue_type = "paid" if user.tier > 1 else "free"
    
    # Get next queue position
    queue_position = get_next_queue_position(db, queue_type)
    
    # Calculate estimated completion date
    estimated_completion = calculate_estimated_completion(db, queue_type, queue_position)
    
    # Create submission
    submission = Submission(
        user_id=user.id,
        character_name=character_name,
        series=series,
        description=description,
        is_public=is_public,
        is_large_image_set=is_large_image_set,
        is_double_character=is_double_character,
        status="pending",
        queue_type=queue_type,
        queue_position=queue_position,
        credit_cost=credit_cost,
        estimated_completion_date=estimated_completion,
    )
    
    db.add(submission)
    db.flush()  # Get submission ID
    
    # Deduct credits for paid tiers
    if user.tier > 1:
        user.credits -= credit_cost
        credit_service.spend_credits(
            db,
            user_id=user.id,
            amount=credit_cost,
            transaction_type="submission_cost",
            description=f"Submission: {character_name} from {series}",
            submission_id=submission.id,
        )
    
    db.commit()
    db.refresh(submission)
    
    return submission


def update_submission(
    db: Session,
    submission_id: int,
    user: User,
    character_name: Optional[str] = None,
    series: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None,
    is_large_image_set: Optional[bool] = None,
    is_double_character: Optional[bool] = None,
) -> Submission:
    """
    Update a submission (only if pending).
    
    Args:
        db: Database session
        submission_id: Submission ID
        user: User updating the submission
        character_name: New character name
        series: New series
        description: New description
        is_public: New public flag
        is_large_image_set: New large image set flag
        is_double_character: New double character flag
        
    Returns:
        Updated submission
        
    Raises:
        HTTPException: If submission not found, not owned by user, or not editable
    """
    submission = get_submission_by_id(db, submission_id)
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    if submission.user_id != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this submission",
        )
    
    if not submission.can_edit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit submission that is not pending",
        )
    
    # Calculate new credit cost if modifiers changed
    old_cost = submission.credit_cost
    new_cost = 1
    
    if is_large_image_set is not None:
        submission.is_large_image_set = is_large_image_set
    if is_double_character is not None:
        submission.is_double_character = is_double_character
    
    if submission.is_large_image_set:
        new_cost += 1
    if submission.is_double_character:
        new_cost += 1
    
    # Handle credit difference for paid tiers
    if user.tier > 1 and new_cost != old_cost:
        credit_diff = new_cost - old_cost
        
        if credit_diff > 0:  # Need more credits
            if user.credits < credit_diff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Not enough credits for modifiers. Need {credit_diff} more",
                )
            user.credits -= credit_diff
            credit_service.spend_credits(
                db,
                user_id=user.id,
                amount=credit_diff,
                transaction_type="submission_cost",
                description=f"Additional credits for submission #{submission_id}",
                submission_id=submission.id,
            )
        else:  # Refund credits
            user.credits = min(user.credits - credit_diff, user.max_credits)
            credit_service.refund_credits(
                db,
                user_id=user.id,
                amount=-credit_diff,
                description=f"Refund from submission #{submission_id} modification",
                submission_id=submission.id,
            )
        
        submission.credit_cost = new_cost
    
    # Update other fields
    if character_name is not None:
        submission.character_name = character_name
    if series is not None:
        submission.series = series
    if description is not None:
        submission.description = description
    if is_public is not None:
        submission.is_public = is_public
    
    submission.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(submission)
    
    return submission


def cancel_submission(
    db: Session,
    submission_id: int,
    user: User,
    reason: Optional[str] = None,
) -> Submission:
    """
    Cancel a submission and refund credits.
    
    Args:
        db: Database session
        submission_id: Submission ID
        user: User cancelling the submission
        reason: Optional cancellation reason
        
    Returns:
        Cancelled submission
        
    Raises:
        HTTPException: If submission not found, not owned by user, or not cancellable
    """
    submission = get_submission_by_id(db, submission_id)
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    if submission.user_id != user.id and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this submission",
        )
    
    if not submission.can_cancel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel submission that is completed or already cancelled",
        )
    
    # Refund credits for paid tiers
    if user.tier > 1:
        user.credits = min(user.credits + submission.credit_cost, user.max_credits)
        credit_service.refund_credits(
            db,
            user_id=user.id,
            amount=submission.credit_cost,
            description=f"Refund from cancelled submission #{submission_id}: {reason or 'No reason provided'}",
            submission_id=submission.id,
        )
    
    # Update submission status
    submission.status = "cancelled"
    submission.queue_position = None
    submission.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Reorder queue
    reorder_queue(db, submission.queue_type)
    
    db.refresh(submission)
    return submission


def complete_submission(
    db: Session,
    submission_id: int,
    patreon_post_link: str,
    creator_notes: Optional[str] = None,
) -> Submission:
    """
    Mark a submission as complete (admin/creator only).
    
    Args:
        db: Database session
        submission_id: Submission ID
        patreon_post_link: Link to Patreon post
        creator_notes: Optional internal notes
        
    Returns:
        Completed submission
        
    Raises:
        HTTPException: If submission not found
    """
    submission = get_submission_by_id(db, submission_id)
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    submission.status = "completed"
    submission.completed_at = datetime.utcnow()
    submission.patreon_post_link = patreon_post_link
    submission.queue_position = None
    
    if creator_notes:
        submission.creator_notes = creator_notes
    
    submission.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Reorder queue
    reorder_queue(db, submission.queue_type)
    
    db.refresh(submission)
    return submission


def get_next_queue_position(db: Session, queue_type: str) -> int:
    """
    Get the next available queue position.
    
    Args:
        db: Database session
        queue_type: Queue type (paid or free)
        
    Returns:
        Next queue position
    """
    max_position = db.query(func.max(Submission.queue_position)).filter(
        Submission.queue_type == queue_type,
        Submission.status == "pending"
    ).scalar()
    
    return (max_position or 0) + 1


def reorder_queue(db: Session, queue_type: str) -> None:
    """
    Reorder queue positions after a submission is removed.
    
    Args:
        db: Database session
        queue_type: Queue type (paid or free)
    """
    if queue_type == "paid":
        # Paid queue: strict FIFO by submission time
        submissions = db.query(Submission).filter(
            Submission.queue_type == queue_type,
            Submission.status == "pending"
        ).order_by(Submission.submitted_at.asc()).all()
    else:
        # Free queue: ordered by votes, then submission time
        submissions = db.query(Submission).filter(
            Submission.queue_type == queue_type,
            Submission.status == "pending"
        ).order_by(
            Submission.vote_count.desc(),
            Submission.submitted_at.asc()
        ).all()
    
    for idx, submission in enumerate(submissions, start=1):
        submission.queue_position = idx
        submission.estimated_completion_date = calculate_estimated_completion(
            db, queue_type, idx
        )
    
    db.commit()


def calculate_estimated_completion(
    db: Session,
    queue_type: str,
    queue_position: int,
) -> datetime:
    """
    Calculate estimated completion date based on queue position.
    
    Args:
        db: Database session
        queue_type: Queue type
        queue_position: Position in queue
        
    Returns:
        Estimated completion datetime
    """
    from app.services.config_service import get_config_value
    
    # Get average completion days from config
    avg_days = int(get_config_value(db, "avg_completion_days", "7"))
    
    # Estimate: position * avg_days
    days_until_completion = queue_position * avg_days
    
    return datetime.utcnow() + timedelta(days=days_until_completion)


async def save_submission_images(
    db: Session,
    submission_id: int,
    files: List[UploadFile],
) -> List[SubmissionImage]:
    """
    Save uploaded images for a submission.
    
    Args:
        db: Database session
        submission_id: Submission ID
        files: List of uploaded files
        
    Returns:
        List of created SubmissionImage objects
        
    Raises:
        HTTPException: If file validation fails
    """
    if len(files) > settings.max_images_per_submission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.max_images_per_submission} images allowed",
        )
    
    submission = get_submission_by_id(db, submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    # Create submission directory
    submission_dir = Path(settings.upload_dir) / str(submission_id)
    submission_dir.mkdir(parents=True, exist_ok=True)
    
    saved_images = []
    
    for idx, file in enumerate(files):
        # Validate file size
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > settings.max_image_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds maximum size of {settings.max_image_size_mb}MB",
            )
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = submission_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Create database record
        image = SubmissionImage(
            submission_id=submission_id,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=file.content_type,
            upload_order=idx,
        )
        
        db.add(image)
        saved_images.append(image)
    
    db.commit()
    
    return saved_images


def delete_submission_images(db: Session, submission_id: int) -> None:
    """
    Delete all images for a submission (from disk and database).
    
    Args:
        db: Database session
        submission_id: Submission ID
    """
    images = db.query(SubmissionImage).filter(
        SubmissionImage.submission_id == submission_id
    ).all()
    
    for image in images:
        # Delete file from disk
        try:
            os.remove(image.file_path)
        except OSError:
            pass  # File might already be deleted
        
        # Delete from database
        db.delete(image)
    
    # Delete directory if empty
    submission_dir = Path(settings.upload_dir) / str(submission_id)
    try:
        submission_dir.rmdir()
    except OSError:
        pass  # Directory not empty or doesn't exist
    
    db.commit()


def search_submissions(
    db: Session,
    query: str,
    user: Optional[User] = None,
    status: str = "completed",
) -> List[Submission]:
    """
    Search submissions by character name or series.
    
    Args:
        db: Database session
        query: Search query
        user: Optional user (to include their private submissions)
        status: Status filter (default: completed)
        
    Returns:
        List of matching submissions
    """
    search_query = db.query(Submission).filter(
        Submission.status == status
    )
    
    # Search in character name or series
    search_pattern = f"%{query}%"
    search_query = search_query.filter(
        (Submission.character_name.ilike(search_pattern)) |
        (Submission.series.ilike(search_pattern))
    )
    
    # Filter by visibility
    if user:
        # Show public submissions OR user's own submissions
        search_query = search_query.filter(
            (Submission.is_public == True) |
            (Submission.user_id == user.id)
        )
    else:
        # Only show public submissions
        search_query = search_query.filter(Submission.is_public == True)
    
    return search_query.order_by(Submission.completed_at.desc()).all()


def get_series_autocomplete(db: Session, query: str, limit: int = 10) -> List[str]:
    """
    Get series names for autocomplete.
    
    Args:
        db: Database session
        query: Search query
        limit: Maximum number of results
        
    Returns:
        List of series names
    """
    search_pattern = f"%{query}%"
    
    results = db.query(Submission.series).filter(
        Submission.series.ilike(search_pattern)
    ).distinct().limit(limit).all()
    
    return [r[0] for r in results]
