"""Community Request service for business logic."""

from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from typing import List, Optional, Dict
from datetime import datetime

from app.models.community_request import CommunityRequest
from app.models.user import User
from app.schemas.community_request import (
    CommunityRequestCreate,
    CommunityRequestUpdate,
    CommunityRequestPublic,
    CommunityRequestList,
)
from app.utils.validation import normalize_text, normalize_array_field


def get_request_by_id(db: Session, request_id: int) -> Optional[CommunityRequest]:
    """Get request by ID."""
    return db.query(CommunityRequest).filter(CommunityRequest.id == request_id).first()


def create_request(
    db: Session,
    user_id: int,
    request_data: CommunityRequestCreate,
) -> CommunityRequest:
    """
    Create a new community request.

    Args:
        db: Database session
        user_id: User ID creating the request
        request_data: Request creation data

    Returns:
        Created request
    """
    # Normalize input data
    normalized_characters = normalize_array_field(request_data.characters)
    normalized_series = normalize_array_field(request_data.series)
    normalized_description = normalize_text(request_data.description)

    # Validate required fields
    if not normalized_characters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one character is required",
        )
    if not normalized_series:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one series is required",
        )

    request = CommunityRequest(
        user_id=user_id,
        characters=normalized_characters,
        series=normalized_series,
        requested_timestamp=request_data.requested_timestamp,
        description=normalized_description,
        is_private=request_data.is_private,
        fulfilled=False,
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request


def update_request(
    db: Session,
    request_id: int,
    user_id: int,
    request_data: CommunityRequestUpdate,
    is_admin: bool = False,
) -> CommunityRequest:
    """
    Update a community request.

    Args:
        db: Database session
        request_id: Request ID
        user_id: User ID making the update
        request_data: Request update data
        is_admin: Whether user is admin (can update any request)

    Returns:
        Updated request
    """
    request = get_request_by_id(db, request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    # Check permissions
    if not is_admin and request.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this request",
        )

    update_data = request_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)

    request.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(request)

    return request


def mark_request_fulfilled(
    db: Session,
    request_id: int,
    user_id: int,
    is_admin: bool = False,
) -> CommunityRequest:
    """
    Mark a request as fulfilled.

    Args:
        db: Database session
        request_id: Request ID
        user_id: User ID marking as fulfilled
        is_admin: Whether user is admin (can mark any request)

    Returns:
        Updated request
    """
    request = get_request_by_id(db, request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    # Check permissions
    if not is_admin and request.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this request",
        )

    request.fulfilled = True
    request.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(request)

    return request


def delete_request(
    db: Session,
    request_id: int,
    user_id: int,
    is_admin: bool = False,
) -> None:
    """
    Delete a community request.

    Args:
        db: Database session
        request_id: Request ID
        user_id: User ID deleting the request
        is_admin: Whether user is admin (can delete any request)
    """
    request = get_request_by_id(db, request_id)
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    # Check permissions
    if not is_admin and request.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this request",
        )

    db.delete(request)
    db.commit()


def get_all_requests(
    db: Session,
    current_user_id: int,
    page: int = 1,
    limit: int = 50,
    include_fulfilled: bool = False,
) -> CommunityRequestList:
    """
    Get all community requests (sorted by timestamp, oldest first).

    Args:
        db: Database session
        current_user_id: Current user ID (for marking own requests)
        page: Page number (1-indexed)
        limit: Results per page
        include_fulfilled: Whether to include fulfilled requests

    Returns:
        List of requests with pagination and user positions
    """
    # Base query
    q = db.query(CommunityRequest)

    # Filter out fulfilled if requested
    if not include_fulfilled:
        q = q.filter(CommunityRequest.fulfilled == False)

    # Order by requested_timestamp (oldest first - FIFO queue)
    q = q.order_by(CommunityRequest.requested_timestamp.asc())

    # Get total count
    total = q.count()

    # Apply pagination
    offset = (page - 1) * limit
    requests = q.offset(offset).limit(limit).all()

    # Convert to public format and mark user's own requests
    public_requests = []
    user_positions = []

    for i, request in enumerate(requests, start=offset + 1):
        is_own = request.user_id == current_user_id

        # Create public representation
        if request.is_private and not is_own:
            public_req = CommunityRequestPublic(
                id=request.id,
                characters=["[Private Request]"],
                series=["[Private]"],
                requested_timestamp=request.requested_timestamp,
                description=None,
                is_private=True,
                fulfilled=request.fulfilled,
                is_own_request=False,
                queue_position=i,
            )
        else:
            public_req = CommunityRequestPublic(
                id=request.id,
                characters=request.characters,
                series=request.series,
                requested_timestamp=request.requested_timestamp,
                description=request.description,
                is_private=request.is_private,
                fulfilled=request.fulfilled,
                is_own_request=is_own,
                queue_position=i,
            )

        public_requests.append(public_req)

        # Track user's positions
        if is_own:
            user_positions.append(i)

    return CommunityRequestList(
        requests=public_requests,
        total=total,
        page=page,
        limit=limit,
        user_positions=user_positions,
    )


def get_user_requests(
    db: Session,
    user_id: int,
    include_fulfilled: bool = False,
) -> List[Dict]:
    """
    Get all requests for a specific user with queue positions.

    Args:
        db: Database session
        user_id: User ID
        include_fulfilled: Whether to include fulfilled requests

    Returns:
        List of user's requests with queue positions
    """
    q = db.query(CommunityRequest).filter(CommunityRequest.user_id == user_id)

    if not include_fulfilled:
        q = q.filter(CommunityRequest.fulfilled == False)

    requests = q.order_by(CommunityRequest.requested_timestamp.asc()).all()

    # Add queue positions to each request
    result = []
    for request in requests:
        request_dict = {
            "id": request.id,
            "user_id": request.user_id,
            "characters": request.characters,
            "series": request.series,
            "requested_timestamp": request.requested_timestamp,
            "description": request.description,
            "is_private": request.is_private,
            "fulfilled": request.fulfilled,
            "created_at": request.created_at,
            "updated_at": request.updated_at,
            "queue_position": get_queue_position(db, request.id) if not request.fulfilled else None,
            "status": "fulfilled" if request.fulfilled else "pending",
        }
        result.append(request_dict)

    return result


def get_queue_position(db: Session, request_id: int) -> Optional[int]:
    """
    Get the position of a request in the queue.

    Args:
        db: Database session
        request_id: Request ID

    Returns:
        Queue position (1-indexed) or None if not found
    """
    request = get_request_by_id(db, request_id)
    if not request or request.fulfilled:
        return None

    # Count how many unfulfilled requests have earlier timestamps
    position = (
        db.query(func.count(CommunityRequest.id))
        .filter(
            CommunityRequest.fulfilled == False,
            CommunityRequest.requested_timestamp <= request.requested_timestamp,
            CommunityRequest.id <= request.id,  # Break ties by ID
        )
        .scalar()
    )

    return position
