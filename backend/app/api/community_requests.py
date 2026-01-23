"""Community Request API endpoints."""

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.schemas.community_request import (
    CommunityRequest,
    CommunityRequestCreate,
    CommunityRequestUpdate,
    CommunityRequestList,
    CommunityRequestFulfill,
)
from app.services import request_service
from app.services.user_service import get_current_user, get_current_admin_user
from app.models.user import User

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=CommunityRequest, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: CommunityRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new community request.

    Args:
        request_data: Request creation data
        current_user: Current authenticated user
        db: Database session

    Returns:
        Created request
    """
    return request_service.create_request(db, current_user.id, request_data)


@router.get("/", response_model=CommunityRequestList)
async def get_all_requests(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    include_fulfilled: bool = Query(False, description="Include fulfilled requests"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all community requests (sorted by timestamp, oldest first).
    Private requests are obscured for other users.

    Args:
        page: Page number (1-indexed)
        limit: Results per page
        include_fulfilled: Whether to include fulfilled requests
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of requests with pagination and user positions
    """
    return request_service.get_all_requests(
        db,
        current_user_id=current_user.id,
        page=page,
        limit=limit,
        include_fulfilled=include_fulfilled,
    )


@router.get("/my")
async def get_my_requests(
    include_fulfilled: bool = Query(False, description="Include fulfilled requests"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current user's requests with queue positions.

    Args:
        include_fulfilled: Whether to include fulfilled requests
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of user's requests with queue positions
    """
    return request_service.get_user_requests(
        db,
        user_id=current_user.id,
        include_fulfilled=include_fulfilled,
    )


@router.patch("/{request_id}", response_model=CommunityRequest)
async def update_request(
    request_id: int,
    request_data: CommunityRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a community request (own requests only, unless admin).

    Args:
        request_id: Request ID
        request_data: Request update data
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated request
    """
    return request_service.update_request(
        db,
        request_id=request_id,
        user_id=current_user.id,
        request_data=request_data,
        is_admin=current_user.is_admin,
    )


@router.patch("/{request_id}/fulfill", response_model=CommunityRequest)
async def mark_request_fulfilled(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a request as fulfilled (own requests only, unless admin).

    Args:
        request_id: Request ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated request
    """
    return request_service.mark_request_fulfilled(
        db,
        request_id=request_id,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
    )


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a community request (own requests only, unless admin).

    Args:
        request_id: Request ID
        current_user: Current authenticated user
        db: Database session
    """
    request_service.delete_request(
        db,
        request_id=request_id,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
    )
    return None
