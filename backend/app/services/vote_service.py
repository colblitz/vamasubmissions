"""Vote service for tier 1 submission voting."""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional
from datetime import datetime

from app.models.vote import Vote, UserVoteAllowance
from app.models.submission import Submission
from app.models.user import User
from app.services.config_service import get_config_value


def get_or_create_vote_allowance(
    db: Session,
    user_id: int,
    month_year: Optional[str] = None,
) -> UserVoteAllowance:
    """
    Get or create vote allowance for a user for a given month.
    
    Args:
        db: Database session
        user_id: User ID
        month_year: Month in YYYY-MM format (defaults to current month)
        
    Returns:
        UserVoteAllowance object
    """
    if not month_year:
        month_year = datetime.utcnow().strftime("%Y-%m")
    
    allowance = db.query(UserVoteAllowance).filter(
        UserVoteAllowance.user_id == user_id,
        UserVoteAllowance.month_year == month_year,
    ).first()
    
    if not allowance:
        # Get votes per month from config
        votes_per_month = int(get_config_value(db, "tier1_votes_per_month", "3"))
        
        allowance = UserVoteAllowance(
            user_id=user_id,
            month_year=month_year,
            votes_available=votes_per_month,
            votes_used=0,
        )
        db.add(allowance)
        db.commit()
        db.refresh(allowance)
    
    return allowance


def cast_vote(
    db: Session,
    user: User,
    submission_id: int,
) -> Vote:
    """
    Cast a vote for a submission.
    
    Args:
        db: Database session
        user: User casting the vote
        submission_id: Submission ID to vote for
        
    Returns:
        Created vote
        
    Raises:
        HTTPException: If vote is invalid
    """
    # Get submission
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    
    # Check if submission is in free queue
    if submission.queue_type != "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only vote on free tier submissions",
        )
    
    # Check if submission is pending
    if submission.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only vote on pending submissions",
        )
    
    # Check if user is trying to vote for their own submission
    if submission.user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot vote for your own submission",
        )
    
    # Check if user already voted for this submission
    existing_vote = db.query(Vote).filter(
        Vote.user_id == user.id,
        Vote.submission_id == submission_id,
    ).first()
    
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already voted for this submission",
        )
    
    # Check vote allowance
    allowance = get_or_create_vote_allowance(db, user.id)
    
    if allowance.votes_remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No votes remaining this month",
        )
    
    # Create vote
    vote = Vote(
        user_id=user.id,
        submission_id=submission_id,
    )
    db.add(vote)
    
    # Update allowance
    allowance.votes_used += 1
    
    # Update submission vote count
    submission.vote_count += 1
    
    db.commit()
    db.refresh(vote)
    
    # Reorder free queue
    from app.services.submission_service import reorder_queue
    reorder_queue(db, "free")
    
    return vote


def remove_vote(
    db: Session,
    user: User,
    submission_id: int,
) -> None:
    """
    Remove a vote from a submission.
    
    Args:
        db: Database session
        user: User removing the vote
        submission_id: Submission ID
        
    Raises:
        HTTPException: If vote doesn't exist
    """
    vote = db.query(Vote).filter(
        Vote.user_id == user.id,
        Vote.submission_id == submission_id,
    ).first()
    
    if not vote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vote not found",
        )
    
    # Get submission
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    
    if submission:
        submission.vote_count = max(0, submission.vote_count - 1)
    
    # Update allowance
    allowance = get_or_create_vote_allowance(db, user.id)
    allowance.votes_used = max(0, allowance.votes_used - 1)
    
    # Delete vote
    db.delete(vote)
    db.commit()
    
    # Reorder free queue
    if submission and submission.queue_type == "free":
        from app.services.submission_service import reorder_queue
        reorder_queue(db, "free")


def get_user_votes(db: Session, user_id: int) -> list[Vote]:
    """
    Get all votes cast by a user.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        List of votes
    """
    return db.query(Vote).filter(Vote.user_id == user_id).all()


def has_voted(db: Session, user_id: int, submission_id: int) -> bool:
    """
    Check if a user has voted for a submission.
    
    Args:
        db: Database session
        user_id: User ID
        submission_id: Submission ID
        
    Returns:
        True if user has voted, False otherwise
    """
    vote = db.query(Vote).filter(
        Vote.user_id == user_id,
        Vote.submission_id == submission_id,
    ).first()
    
    return vote is not None
