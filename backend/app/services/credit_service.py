"""Credit service for managing user credits."""
from sqlalchemy.orm import Session
from typing import Optional

from app.models.credit import CreditTransaction
from app.models.user import User


def add_credits(
    db: Session,
    user_id: int,
    amount: int,
    transaction_type: str,
    description: Optional[str] = None,
    submission_id: Optional[int] = None,
) -> CreditTransaction:
    """
    Add credits to a user's account.
    
    Args:
        db: Database session
        user_id: User ID
        amount: Amount of credits to add (positive number)
        transaction_type: Type of transaction
        description: Optional description
        submission_id: Optional submission ID
        
    Returns:
        Created credit transaction
    """
    transaction = CreditTransaction(
        user_id=user_id,
        amount=amount,
        transaction_type=transaction_type,
        description=description,
        submission_id=submission_id,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


def spend_credits(
    db: Session,
    user_id: int,
    amount: int,
    transaction_type: str,
    description: Optional[str] = None,
    submission_id: Optional[int] = None,
) -> CreditTransaction:
    """
    Spend credits from a user's account.
    
    Args:
        db: Database session
        user_id: User ID
        amount: Amount of credits to spend (positive number, will be stored as negative)
        transaction_type: Type of transaction
        description: Optional description
        submission_id: Optional submission ID
        
    Returns:
        Created credit transaction
    """
    transaction = CreditTransaction(
        user_id=user_id,
        amount=-amount,  # Store as negative
        transaction_type=transaction_type,
        description=description,
        submission_id=submission_id,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


def refund_credits(
    db: Session,
    user_id: int,
    amount: int,
    description: Optional[str] = None,
    submission_id: Optional[int] = None,
) -> CreditTransaction:
    """
    Refund credits to a user's account.
    
    Args:
        db: Database session
        user_id: User ID
        amount: Amount of credits to refund
        description: Optional description
        submission_id: Optional submission ID
        
    Returns:
        Created credit transaction
    """
    return add_credits(
        db,
        user_id=user_id,
        amount=amount,
        transaction_type="refund",
        description=description,
        submission_id=submission_id,
    )


def get_user_credit_history(
    db: Session,
    user_id: int,
    limit: Optional[int] = None,
) -> list[CreditTransaction]:
    """
    Get credit transaction history for a user.
    
    Args:
        db: Database session
        user_id: User ID
        limit: Optional limit on number of transactions
        
    Returns:
        List of credit transactions
    """
    query = db.query(CreditTransaction).filter(
        CreditTransaction.user_id == user_id
    ).order_by(CreditTransaction.created_at.desc())
    
    if limit:
        query = query.limit(limit)
    
    return query.all()
