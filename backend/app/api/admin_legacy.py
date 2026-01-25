# Legacy endpoints for Phase 0 submission system (currently hidden)

"""Admin API endpoints for legacy submission system."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.schemas.submission import SubmissionInDB, SubmissionComplete
from app.schemas.queue import QueueStats
from app.schemas.user import UserStats
from app.services import user_service, submission_service, credit_service
from app.models.user import User
from app.models.submission import Submission

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
                tier=user.tier_id,
                credits=user.credits,
                pending_submissions=pending,
                completed_submissions=completed,
                cancelled_submissions=cancelled,
            )
        )

    return user_stats


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
