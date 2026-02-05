"""Value Alias API endpoints."""

from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.schemas.value_alias import (
    ValueAlias,
    ValueAliasCreate,
    ValueAliasUpdate,
    ValueAliasList,
    ZeroResultSuggestionList,
)
from app.services import alias_service
from app.services.user_service import get_current_user, get_current_admin_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=ValueAliasList)
async def get_aliases(
    field_type: Optional[str] = Query(None, description="Filter by field type"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get all value aliases (admin only).
    
    Args:
        field_type: Optional field type filter ('characters', 'series', 'tags')
        current_user: Current authenticated admin user
        db: Database session
    
    Returns:
        List of aliases
    """
    return alias_service.get_aliases(db, field_type)


@router.post("/", response_model=ValueAlias)
async def create_alias(
    alias_data: ValueAliasCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Create a new value alias (admin only).
    
    Args:
        alias_data: Alias creation data
        current_user: Current authenticated admin user
        db: Database session
    
    Returns:
        Created alias
    """
    return alias_service.create_alias(db, current_user.id, alias_data)


@router.patch("/{alias_id}", response_model=ValueAlias)
async def update_alias(
    alias_id: int = Path(..., description="Alias ID"),
    alias_data: ValueAliasUpdate = ...,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update a value alias (admin only).
    
    Args:
        alias_id: Alias ID
        alias_data: Alias update data
        current_user: Current authenticated admin user
        db: Database session
    
    Returns:
        Updated alias
    """
    return alias_service.update_alias(db, alias_id, alias_data)


@router.delete("/{alias_id}", status_code=204)
async def delete_alias(
    alias_id: int = Path(..., description="Alias ID"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Delete a value alias (admin only).
    
    Args:
        alias_id: Alias ID
        current_user: Current authenticated admin user
        db: Database session
    """
    alias_service.delete_alias(db, alias_id)
    return None


@router.get("/suggestions", response_model=ZeroResultSuggestionList)
async def get_zero_result_suggestions(
    field_type: Optional[str] = Query(None, description="Filter by field type"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Get zero-result search suggestions for creating aliases (admin only).
    
    Args:
        field_type: Optional field type filter
        limit: Max results
        current_user: Current authenticated admin user
        db: Database session
    
    Returns:
        List of zero-result search suggestions
    """
    return alias_service.get_zero_result_suggestions(db, field_type, limit)


@router.post("/from-suggestion", response_model=ValueAlias)
async def create_alias_from_suggestion(
    field_type: str = Query(..., description="Field type"),
    search_term: str = Query(..., description="Search term to make an alias"),
    canonical_value: str = Query(..., description="Canonical value to map to"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Create an alias from a zero-result suggestion (admin only).
    
    Args:
        field_type: Field type
        search_term: Search term to make an alias
        canonical_value: Canonical value to map to
        current_user: Current authenticated admin user
        db: Database session
    
    Returns:
        Created alias
    """
    return alias_service.create_alias_from_suggestion(
        db, current_user.id, field_type, search_term, canonical_value
    )


@router.delete("/suggestions/{field_type}/{search_term}", status_code=204)
async def delete_search_suggestion(
    field_type: str = Path(..., description="Field type"),
    search_term: str = Path(..., description="Search term to delete"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Delete all search analytics entries for a specific search term (admin only).
    
    Args:
        field_type: Field type
        search_term: Search term to delete
        current_user: Current authenticated admin user
        db: Database session
    """
    alias_service.delete_search_analytics(db, field_type, search_term)
    return None
