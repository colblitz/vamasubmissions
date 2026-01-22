"""Queue API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.queue import QueueInfo, QueueSubmission
from app.schemas.vote import VoteCreate, VoteAllowance
from app.services import user_service, vote_service
from app.models.user import User
from app.models.submission import Submission

router = APIRouter()


@router.get("/paid", response_model=QueueInfo)
async def get_paid_queue(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get paid queue information.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        Queue information
    """
    # Get all pending submissions in paid queue
    paid_submissions = (
        db.query(Submission)
        .filter(Submission.queue_type == "paid", Submission.status == "pending")
        .order_by(Submission.queue_position.asc())
        .all()
    )

    # Find user's submissions
    user_submissions = [s for s in paid_submissions if s.user_id == current_user.id]

    # Get visible submissions (public or user's own)
    visible_submissions = [
        s for s in paid_submissions if s.is_public or s.user_id == current_user.id
    ]

    # Convert to response format
    queue_submissions = []
    for submission in visible_submissions:
        queue_sub = QueueSubmission(
            id=submission.id,
            character_name=submission.character_name,
            series=submission.series,
            is_public=submission.is_public,
            queue_position=submission.queue_position,
            vote_count=submission.vote_count,
            submitted_at=submission.submitted_at,
            estimated_completion_date=submission.estimated_completion_date,
            is_own_submission=(submission.user_id == current_user.id),
        )
        queue_submissions.append(queue_sub)

    # Get user's position (first submission in queue)
    user_position = None
    if user_submissions:
        user_position = min(s.queue_position for s in user_submissions if s.queue_position)

    return QueueInfo(
        queue_type="paid",
        total_submissions=len(paid_submissions),
        user_position=user_position,
        user_submissions=[
            QueueSubmission(
                id=s.id,
                character_name=s.character_name,
                series=s.series,
                is_public=s.is_public,
                queue_position=s.queue_position,
                vote_count=s.vote_count,
                submitted_at=s.submitted_at,
                estimated_completion_date=s.estimated_completion_date,
                is_own_submission=True,
            )
            for s in user_submissions
        ],
        visible_submissions=queue_submissions,
    )


@router.get("/free", response_model=QueueInfo)
async def get_free_queue(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get free queue information (ordered by votes).

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        Queue information
    """
    # Get all pending submissions in free queue, ordered by votes
    free_submissions = (
        db.query(Submission)
        .filter(Submission.queue_type == "free", Submission.status == "pending")
        .order_by(Submission.vote_count.desc(), Submission.submitted_at.asc())
        .all()
    )

    # Find user's submissions
    user_submissions = [s for s in free_submissions if s.user_id == current_user.id]

    # Get visible submissions (public or user's own)
    visible_submissions = [
        s for s in free_submissions if s.is_public or s.user_id == current_user.id
    ]

    # Convert to response format
    queue_submissions = []
    for submission in visible_submissions:
        queue_sub = QueueSubmission(
            id=submission.id,
            character_name=submission.character_name,
            series=submission.series,
            is_public=submission.is_public,
            queue_position=submission.queue_position,
            vote_count=submission.vote_count,
            submitted_at=submission.submitted_at,
            estimated_completion_date=submission.estimated_completion_date,
            is_own_submission=(submission.user_id == current_user.id),
        )
        queue_submissions.append(queue_sub)

    # Get user's position (first submission in queue)
    user_position = None
    if user_submissions:
        user_position = min(s.queue_position for s in user_submissions if s.queue_position)

    return QueueInfo(
        queue_type="free",
        total_submissions=len(free_submissions),
        user_position=user_position,
        user_submissions=[
            QueueSubmission(
                id=s.id,
                character_name=s.character_name,
                series=s.series,
                is_public=s.is_public,
                queue_position=s.queue_position,
                vote_count=s.vote_count,
                submitted_at=s.submitted_at,
                estimated_completion_date=s.estimated_completion_date,
                is_own_submission=True,
            )
            for s in user_submissions
        ],
        visible_submissions=queue_submissions,
    )


@router.post("/vote")
async def vote_for_submission(
    vote_data: VoteCreate,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Vote for a free tier submission.

    Args:
        vote_data: Vote data
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success message
    """
    vote = vote_service.cast_vote(
        db=db,
        user=current_user,
        submission_id=vote_data.submission_id,
    )

    return {"message": "Vote cast successfully", "vote_id": vote.id}


@router.delete("/vote/{submission_id}")
async def remove_vote_from_submission(
    submission_id: int,
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove vote from a submission.

    Args:
        submission_id: Submission ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success message
    """
    vote_service.remove_vote(
        db=db,
        user=current_user,
        submission_id=submission_id,
    )

    return {"message": "Vote removed successfully"}


@router.get("/vote/allowance", response_model=VoteAllowance)
async def get_vote_allowance(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current user's vote allowance for this month.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        Vote allowance information
    """
    allowance = vote_service.get_or_create_vote_allowance(db, current_user.id)

    return VoteAllowance(
        month_year=allowance.month_year,
        votes_available=allowance.votes_available,
        votes_used=allowance.votes_used,
        votes_remaining=allowance.votes_remaining,
    )


@router.get("/vote/my-votes")
async def get_my_votes(
    current_user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all votes cast by current user.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of submission IDs voted for
    """
    votes = vote_service.get_user_votes(db, current_user.id)

    return {
        "submission_ids": [vote.submission_id for vote in votes],
        "total_votes": len(votes),
    }
