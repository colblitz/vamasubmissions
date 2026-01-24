"""Post API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.core.database import get_db
from app.schemas.post import Post, PostSearchResult, PostSearchResultOptimized, PostDetail
from app.services import post_service
from app.services.user_service import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/search", response_model=PostSearchResultOptimized)
async def search_posts(
    q: Optional[str] = Query(
        None, description="Search query (searches title, characters, series, tags)"
    ),
    characters: Optional[str] = Query(
        None, description="Filter by character names (comma-separated)"
    ),
    series: Optional[str] = Query(None, description="Filter by series names (comma-separated)"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    sort_by: str = Query("date", description="Sort field (date)"),
    sort_order: str = Query("desc", description="Sort order (asc or desc)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search posts with filters.

    Args:
        q: Full-text search query
        characters: Filter by character names (comma-separated)
        series: Filter by series names (comma-separated)
        tags: Filter by tags (comma-separated)
        page: Page number (1-indexed)
        limit: Results per page
        current_user: Current authenticated user
        db: Database session

    Returns:
        Search results with pagination
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 80)
    logger.info(f"[API DEBUG] /api/posts/search called")
    logger.info(f"[API DEBUG] Raw query params:")
    logger.info(f"  - q: {q!r}")
    logger.info(f"  - characters: {characters!r}")
    logger.info(f"  - series: {series!r}")
    logger.info(f"  - tags: {tags!r}")
    logger.info(f"  - page: {page}, limit: {limit}")
    logger.info(f"  - user: {current_user.patreon_username if current_user else 'None'} (tier {current_user.tier if current_user else 'N/A'})")
    
    # Parse comma-separated values
    character_list = [c.strip() for c in characters.split(",")] if characters else []
    series_list = [s.strip() for s in series.split(",")] if series else []
    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    
    logger.info(f"[API DEBUG] Parsed lists:")
    logger.info(f"  - character_list: {character_list}")
    logger.info(f"  - series_list: {series_list}")
    logger.info(f"  - tag_list: {tag_list}")

    result = post_service.search_posts(
        db,
        query=q,
        characters=character_list,
        series_list=series_list,
        tags=tag_list,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user_id=current_user.id if current_user else None,
    )
    
    logger.info(f"[API DEBUG] Returning result: total={result.total}, posts={len(result.posts)}")
    logger.info("=" * 80)
    
    return result


@router.get("/{post_id}", response_model=Post)
async def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get post details by ID.

    Args:
        post_id: Post ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        Post details
    """
    post = post_service.get_post_by_id(db, post_id)
    if not post:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    return post


@router.get("/autocomplete/characters", response_model=List[str])
async def autocomplete_characters(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get character name autocomplete suggestions.

    Args:
        q: Search query
        limit: Max results
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of character names
    """
    return post_service.get_autocomplete_characters(db, q, limit)


@router.get("/autocomplete/characters-with-series")
async def autocomplete_characters_with_series(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get character name autocomplete suggestions with their most common series.

    Args:
        q: Search query
        limit: Max results
        current_user: Current authenticated user
        db: Database session

    Returns:
        Dict mapping character names to their most common series
    """
    return post_service.get_character_series_map(db, q, limit)


@router.get("/autocomplete/series", response_model=List[str])
async def autocomplete_series(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get series name autocomplete suggestions.

    Args:
        q: Search query
        limit: Max results
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of series names
    """
    return post_service.get_autocomplete_series(db, q, limit)


@router.get("/autocomplete/tags", response_model=List[str])
async def autocomplete_tags(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=100, description="Max results"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get tag autocomplete suggestions.

    Args:
        q: Search query
        limit: Max results
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of tags
    """
    return post_service.get_autocomplete_tags(db, q, limit)


@router.get("/browse/{field_type}")
async def browse_posts(
    field_type: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Results per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get aggregated browse data for characters, series, or tags.
    
    Args:
        field_type: Type of field to browse ("characters", "series", or "tags")
        page: Page number (1-indexed)
        limit: Results per page
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of items with their post counts and pagination info
    """
    return post_service.get_browse_data(db, field_type, page, limit)
