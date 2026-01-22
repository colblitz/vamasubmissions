"""User API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.user import User
from app.services import user_service, credit_service
from app.models.user import User as UserModel

router = APIRouter()


@router.get("/me", response_model=User)
async def get_current_user(
    current_user: UserModel = Depends(user_service.get_current_user),
):
    """
    Get current user information.

    Args:
        current_user: Current authenticated user

    Returns:
        User information
    """
    return current_user


@router.get("/me/credits/history")
async def get_credit_history(
    limit: int = 50,
    current_user: UserModel = Depends(user_service.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get credit transaction history for current user.

    Args:
        limit: Maximum number of transactions to return
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of credit transactions
    """
    transactions = credit_service.get_user_credit_history(
        db,
        user_id=current_user.id,
        limit=limit,
    )

    return {
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "transaction_type": t.transaction_type,
                "description": t.description,
                "submission_id": t.submission_id,
                "created_at": t.created_at,
            }
            for t in transactions
        ],
        "current_credits": current_user.credits,
    }
