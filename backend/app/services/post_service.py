"""Post service for business logic."""

from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_, text
from fastapi import HTTPException, status
from typing import List, Optional, Tuple
from datetime import datetime

from app.models.post import Post
from app.schemas.post import PostCreate, PostUpdate, PostSearchResult


def get_post_by_id(db: Session, post_id: int) -> Optional[Post]:
    """Get post by ID."""
    return db.query(Post).filter(Post.id == post_id).first()


def get_post_by_post_id(db: Session, post_id: str) -> Optional[Post]:
    """Get post by Patreon post ID."""
    return db.query(Post).filter(Post.post_id == post_id).first()


def create_post(db: Session, post_data: PostCreate) -> Post:
    """
    Create a new post.

    Args:
        db: Database session
        post_data: Post creation data

    Returns:
        Created post
    """
    post = Post(
        post_id=post_data.post_id,
        timestamp=post_data.timestamp,
        url=post_data.url,
        title=post_data.title,
        characters=post_data.characters,
        series=post_data.series,
        tags=post_data.tags,
        image_urls=post_data.image_urls,
        thumbnail_urls=post_data.thumbnail_urls,
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    return post


def update_post(db: Session, post_id: int, post_data: PostUpdate) -> Post:
    """
    Update a post.

    Args:
        db: Database session
        post_id: Post ID
        post_data: Post update data

    Returns:
        Updated post
    """
    post = get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    update_data = post_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(post, field, value)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    return post


def search_posts(
    db: Session,
    query: Optional[str] = None,
    characters: Optional[List[str]] = None,
    series_list: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    page: int = 1,
    limit: int = 20,
) -> PostSearchResult:
    """
    Search posts with filters.
    Only returns published posts (status='published').

    Args:
        db: Database session
        query: Full-text search query (searches title, characters, series, tags)
        characters: Filter by character names (must match ALL)
        series_list: Filter by series names (must match ALL)
        tags: Filter by tags (must match ALL)
        page: Page number (1-indexed)
        limit: Results per page

    Returns:
        Search results with pagination
    """
    # Start with base query - ONLY PUBLISHED POSTS
    q = db.query(Post).filter(Post.status == "published")

    # Apply filters
    if query:
        # Full-text search across title, characters, series, tags
        search_term = f"%{query.lower()}%"
        q = q.filter(
            or_(
                func.lower(Post.title).like(search_term),
                Post.characters.any(func.lower(search_term)),
                Post.series.any(func.lower(search_term)),
                Post.tags.any(func.lower(search_term)),
            )
        )

    if characters:
        # Filter by multiple characters (must have ALL specified characters)
        # Use raw SQL for array comparison since SQLAlchemy's array operations are limited
        for character in characters:
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(characters) AS c WHERE LOWER(c) = :char)")
            ).params(char=character.lower())

    if series_list:
        # Filter by multiple series (must have ALL specified series)
        for series_name in series_list:
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(series) AS s WHERE LOWER(s) = :ser)")
            ).params(ser=series_name.lower())

    if tags:
        # Filter by multiple tags (must have ALL specified tags)
        for tag in tags:
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE LOWER(t) = :tag)")
            ).params(tag=tag.lower())

    # Get total count
    total = q.count()

    # Apply pagination
    offset = (page - 1) * limit
    posts = q.order_by(Post.timestamp.desc()).offset(offset).limit(limit).all()

    # Calculate total pages
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    return PostSearchResult(
        posts=posts,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


def get_autocomplete_characters(
    db: Session,
    query: str,
    limit: int = 10,
) -> List[str]:
    """
    Get character name autocomplete suggestions.
    Only includes characters from published posts.

    Args:
        db: Database session
        query: Search query
        limit: Max results

    Returns:
        List of character names
    """
    # Use unnest in a subquery to expand arrays and get distinct values
    search_term = f"%{query.lower()}%"

    results = db.execute(
        text("""
        SELECT DISTINCT character
        FROM (
            SELECT unnest(characters) as character
            FROM posts
            WHERE status = 'published'
        ) AS chars
        WHERE LOWER(character) LIKE :search_term
        ORDER BY character
        LIMIT :limit
        """),
        {"search_term": search_term, "limit": limit},
    ).fetchall()

    return [row[0] for row in results]


def get_autocomplete_series(
    db: Session,
    query: str,
    limit: int = 10,
) -> List[str]:
    """
    Get series name autocomplete suggestions.
    Only includes series from published posts.

    Args:
        db: Database session
        query: Search query
        limit: Max results

    Returns:
        List of series names
    """
    search_term = f"%{query.lower()}%"

    results = db.execute(
        text("""
        SELECT DISTINCT series_name
        FROM (
            SELECT unnest(series) as series_name
            FROM posts
            WHERE status = 'published'
        ) AS ser
        WHERE LOWER(series_name) LIKE :search_term
        ORDER BY series_name
        LIMIT :limit
        """),
        {"search_term": search_term, "limit": limit},
    ).fetchall()

    return [row[0] for row in results]


def get_autocomplete_tags(
    db: Session,
    query: str,
    limit: int = 10,
) -> List[str]:
    """
    Get tag autocomplete suggestions.
    Only includes tags from published posts.

    Args:
        db: Database session
        query: Search query
        limit: Max results

    Returns:
        List of tags
    """
    search_term = f"%{query.lower()}%"

    results = db.execute(
        text("""
        SELECT DISTINCT tag
        FROM (
            SELECT unnest(tags) as tag
            FROM posts
            WHERE status = 'published'
        ) AS tag_list
        WHERE LOWER(tag) LIKE :search_term
        ORDER BY tag
        LIMIT :limit
        """),
        {"search_term": search_term, "limit": limit},
    ).fetchall()

    return [row[0] for row in results]


def get_character_series_map(
    db: Session,
    query: str,
    limit: int = 10,
) -> List[dict]:
    """
    Get character name autocomplete suggestions with their most common series.
    Only includes characters from published posts.

    Args:
        db: Database session
        query: Search query
        limit: Max results

    Returns:
        List of dicts with 'character' and 'series' keys
    """
    search_term = f"%{query.lower()}%"

    results = db.execute(
        text("""
        WITH character_series AS (
            SELECT 
                unnest(characters) as character,
                unnest(series) as series
            FROM posts
            WHERE status = 'published'
        ),
        ranked_series AS (
            SELECT 
                character,
                series,
                COUNT(*) as frequency,
                ROW_NUMBER() OVER (PARTITION BY character ORDER BY COUNT(*) DESC) as rn
            FROM character_series
            GROUP BY character, series
        )
        SELECT DISTINCT character, series
        FROM ranked_series
        WHERE LOWER(character) LIKE :search_term
          AND rn = 1
        ORDER BY character
        LIMIT :limit
        """),
        {"search_term": search_term, "limit": limit},
    ).fetchall()

    return [{"character": row[0], "series": row[1]} for row in results]


def get_post_with_edit_count(db: Session, post_id: int) -> Optional[Tuple[Post, int]]:
    """
    Get post with count of edits in history.

    Args:
        db: Database session
        post_id: Post ID

    Returns:
        Tuple of (post, edit_count) or None if not found
    """
    post = get_post_by_id(db, post_id)
    if not post:
        return None

    edit_count = db.query(func.count()).filter(Post.id == post_id).scalar() or 0

    return post, edit_count
