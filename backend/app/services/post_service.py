"""Post service for business logic."""

from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models.post import Post
from app.schemas.post import PostCreate, PostSearchResult, PostUpdate
from app.services import alias_service
from app.utils.thumbnail_sort import sort_thumbnails


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
        patreon_url=post_data.patreon_url,
        title=post_data.title,
        characters=post_data.characters,
        series=post_data.series,
        tags=post_data.tags,
        thumbnail_url=post_data.thumbnail_url,
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
    no_characters: Optional[bool] = None,
    no_series: Optional[bool] = None,
    no_tags: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "date",
    sort_order: str = "desc",
    current_user_id: Optional[int] = None,
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
        no_characters: Filter for posts without any characters (characters = '{}' OR characters IS NULL)
        no_series: Filter for posts without any series (series = '{}' OR series IS NULL)
        no_tags: Filter for posts without any tags (tags = '{}' OR tags IS NULL)
        date_from: Filter posts from this date (YYYY-MM-DD)
        date_to: Filter posts up to this date (YYYY-MM-DD)
        page: Page number (1-indexed)
        limit: Results per page
        current_user_id: Optional current user ID for pending edits

    Returns:
        Search results with pagination
    """
    # Track resolved aliases
    resolved_aliases = {}

    # Resolve aliases for search terms
    if characters:
        resolved_chars = []
        for c in characters:
            resolved = alias_service.AliasCache.resolve_alias(db, "characters", c)
            if resolved.lower() != c.lower():
                if "characters" not in resolved_aliases:
                    resolved_aliases["characters"] = {}
                resolved_aliases["characters"][c] = resolved
            resolved_chars.append(resolved)
        characters = resolved_chars

    if series_list:
        resolved_series = []
        for s in series_list:
            resolved = alias_service.AliasCache.resolve_alias(db, "series", s)
            if resolved.lower() != s.lower():
                if "series" not in resolved_aliases:
                    resolved_aliases["series"] = {}
                resolved_aliases["series"][s] = resolved
            resolved_series.append(resolved)
        series_list = resolved_series

    if tags:
        resolved_tags = []
        for t in tags:
            resolved = alias_service.AliasCache.resolve_alias(db, "tags", t)
            if resolved.lower() != t.lower():
                if "tags" not in resolved_aliases:
                    resolved_aliases["tags"] = {}
                resolved_aliases["tags"][t] = resolved
            resolved_tags.append(resolved)
        tags = resolved_tags

    # Start with base query - ONLY PUBLISHED POSTS
    q = db.query(Post).filter(Post.status == "published")

    # Apply filters
    if query:
        # Full-text search across title, characters, series, tags
        search_term = f"%{query.lower()}%"
        q = q.filter(
            or_(
                func.lower(Post.title).like(search_term),
                text(
                    "EXISTS (SELECT 1 FROM unnest(characters) AS c WHERE LOWER(c) LIKE :search)"
                ).bindparams(search=search_term),
                text(
                    "EXISTS (SELECT 1 FROM unnest(series) AS s WHERE LOWER(s) LIKE :search)"
                ).bindparams(search=search_term),
                text(
                    "EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE LOWER(t) LIKE :search)"
                ).bindparams(search=search_term),
            )
        )

    if characters:
        # Filter by multiple characters (must have ALL specified characters)
        # Use LIKE for partial/substring matching
        for character in characters:
            search_char = f"%{character.lower()}%"
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(characters) AS c WHERE LOWER(c) LIKE :char)")
            ).params(char=search_char)

    if series_list:
        # Filter by multiple series (must have ALL specified series)
        # Use LIKE for partial/substring matching
        for series_name in series_list:
            search_series = f"%{series_name.lower()}%"
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(series) AS s WHERE LOWER(s) LIKE :ser)")
            ).params(ser=search_series)

    if tags:
        # Filter by multiple tags (must have ALL specified tags)
        # Use LIKE for partial/substring matching
        for tag in tags:
            search_tag = f"%{tag.lower()}%"
            q = q.filter(
                text("EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE LOWER(t) LIKE :tag)")
            ).params(tag=search_tag)

    if no_characters:
        # Filter for posts without any characters (empty array or NULL)
        q = q.filter(or_(Post.characters == [], Post.characters is None))

    if no_series:
        # Filter for posts without any series (empty array or NULL)
        q = q.filter(or_(Post.series == [], Post.series is None))

    if no_tags:
        # Filter for posts without any tags (empty array or NULL)
        q = q.filter(or_(Post.tags == [], Post.tags is None))

    # Date range filtering
    if date_from:
        try:
            from datetime import datetime

            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            q = q.filter(Post.timestamp >= from_date)
        except ValueError:
            # Invalid date format, ignore
            pass

    if date_to:
        try:
            from datetime import datetime

            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            # Set to end of day
            to_date = to_date.replace(hour=23, minute=59, second=59)
            q = q.filter(Post.timestamp <= to_date)
        except ValueError:
            # Invalid date format, ignore
            pass

    # Get total count
    total = q.count()

    # Track searches for analytics (only single-value searches)
    if current_user_id:
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            f"[TRACK] Checking tracking: characters={characters}, series={series_list}, tags={tags}, query={query}, total={total}"
        )

        if len(characters) == 1 and not series_list and not tags and not query:
            logger.info(f"[TRACK] Tracking character search: {characters[0]}")
            alias_service.track_search(db, "characters", characters[0], total, current_user_id)
        elif len(series_list) == 1 and not characters and not tags and not query:
            logger.info(f"[TRACK] Tracking series search: {series_list[0]}")
            alias_service.track_search(db, "series", series_list[0], total, current_user_id)
        elif len(tags) == 1 and not characters and not series_list and not query:
            logger.info(f"[TRACK] Tracking tags search: {tags[0]}")
            alias_service.track_search(db, "tags", tags[0], total, current_user_id)

    # Apply sorting
    if sort_by == "date":
        if sort_order == "asc":
            q = q.order_by(Post.timestamp.asc())
        else:
            q = q.order_by(Post.timestamp.desc())

    # Apply pagination
    offset = (page - 1) * limit
    posts = q.offset(offset).limit(limit).all()

    # Sort thumbnail_urls by ordinal for each post (defensive)
    for post in posts:
        if post.thumbnail_urls:
            post.thumbnail_urls = sort_thumbnails(post.thumbnail_urls)

    # Fetch pending edits for all posts in batch if user is authenticated
    if current_user_id and posts:
        from app.services import edit_service

        post_ids = [post.id for post in posts]
        pending_edits_map = edit_service.get_pending_edits_for_posts(db, post_ids, current_user_id)

        # Attach pending edits to each post
        for post in posts:
            post.pending_edits = pending_edits_map.get(post.id, [])
    else:
        # Set empty pending_edits for unauthenticated users
        for post in posts:
            post.pending_edits = []

    # Calculate total pages
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    return PostSearchResult(
        posts=posts,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        resolved_aliases=resolved_aliases,
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
    # Resolve alias first
    resolved_query = alias_service.AliasCache.resolve_alias(db, "characters", query)
    # If resolved to something different, search for that instead
    if resolved_query.lower() != query.lower():
        query = resolved_query

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
    # Resolve alias first
    resolved_query = alias_service.AliasCache.resolve_alias(db, "series", query)
    # If resolved to something different, search for that instead
    if resolved_query.lower() != query.lower():
        query = resolved_query

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
    # Resolve alias first
    resolved_query = alias_service.AliasCache.resolve_alias(db, "tags", query)
    # If resolved to something different, search for that instead
    if resolved_query.lower() != query.lower():
        query = resolved_query

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


def get_browse_data(
    db: Session,
    field_type: str,
    page: int = 1,
    limit: int = 100,
    sort_by: str = "count",
    starts_with: Optional[str] = None,
) -> dict:
    """
    Get aggregated data for browsing (characters, series, or tags).
    Returns items with their post counts.

    Args:
        db: Database session
        field_type: "characters" | "series" | "tags"
        page: Page number (1-indexed)
        limit: Results per page
        sort_by: "count" (default) or "alpha" (alphabetically)
        starts_with: Filter items starting with this letter (only for alpha sort)

    Returns:
        Dict with items list and pagination info
    """
    # Map field type to column name
    field_map = {
        "characters": "characters",
        "series": "series",
        "tags": "tags",
    }

    if field_type not in field_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_type. Must be one of: {', '.join(field_map.keys())}",
        )

    field = field_map[field_type]

    # Determine ORDER BY clause based on sort_by parameter
    if sort_by == "alpha":
        order_clause = "ORDER BY name ASC"
    else:  # count
        order_clause = "ORDER BY count DESC, name ASC"

    # If starts_with is provided (for alpha sort), find the offset to the first matching item
    offset = (page - 1) * limit

    if starts_with and sort_by == "alpha":
        # Find the position of the first item starting with this letter
        letter_upper = starts_with.upper()
        starts_with.lower()

        # Count how many items come before this letter
        offset_result = db.execute(
            text(f"""
            WITH unnested AS (
                SELECT unnest({field}) as name
                FROM posts
                WHERE status = 'published'
            ),
            grouped AS (
                SELECT name, COUNT(*) as count
                FROM unnested
                GROUP BY name
            )
            SELECT COUNT(*)
            FROM grouped
            WHERE UPPER(SUBSTRING(name, 1, 1)) < :letter_upper
            """),
            {"letter_upper": letter_upper},
        ).fetchone()

        offset = offset_result[0] if offset_result else 0
        # Calculate which page this offset corresponds to
        page = (offset // limit) + 1

    # SQL query to unnest array, count occurrences, and paginate
    # Use raw SQL for better performance with array operations
    results = db.execute(
        text(f"""
        WITH unnested AS (
            SELECT unnest({field}) as name
            FROM posts
            WHERE status = 'published'
        )
        SELECT name, COUNT(*) as count
        FROM unnested
        GROUP BY name
        {order_clause}
        LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    ).fetchall()

    # Get total count of unique items
    total_result = db.execute(
        text(f"""
        WITH unnested AS (
            SELECT DISTINCT unnest({field}) as name
            FROM posts
            WHERE status = 'published'
        )
        SELECT COUNT(*) FROM unnested
        """)
    ).fetchone()

    total = total_result[0] if total_result else 0
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    items = [{"name": row[0], "count": row[1]} for row in results]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


def get_no_items_count(db: Session, field_type: str) -> dict:
    """
    Get count of posts with no items in the specified field.

    Args:
        db: Database session
        field_type: "characters" | "series" | "tags"

    Returns:
        Dict with count of posts with empty array for the field
    """
    # Map field type to column name
    field_map = {
        "characters": "characters",
        "series": "series",
        "tags": "tags",
    }

    if field_type not in field_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid field_type. Must be one of: {', '.join(field_map.keys())}",
        )

    field = field_map[field_type]

    # Count posts where the field is an empty array or NULL
    count_result = db.execute(
        text(f"""
        SELECT COUNT(*)
        FROM posts
        WHERE status = 'published'
          AND (
            {field} = '{{}}' OR
            {field} IS NULL OR
            array_length({field}, 1) IS NULL
          )
        """)
    ).fetchone()

    count = count_result[0] if count_result else 0

    return {"count": count}


def get_browse_by_date(
    db: Session,
    date_type: str,
    page: int = 1,
    limit: int = 50,
) -> dict:
    """
    Get posts grouped by month or day for browsing.
    Returns date periods with their post counts, sorted by date descending.

    Args:
        db: Database session
        date_type: "month" | "day"
        page: Page number (1-indexed)
        limit: Results per page

    Returns:
        Dict with items list and pagination info
    """
    offset = (page - 1) * limit

    if date_type == "month":
        # Group by year-month (e.g., "2024-01")
        date_trunc = "date_trunc('month', timestamp)"
        display_format = "YYYY-MM"
    elif date_type == "day":
        # Group by date (e.g., "2024-01-15")
        date_trunc = "date_trunc('day', timestamp)"
        display_format = "YYYY-MM-DD"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date_type. Must be 'month' or 'day'.",
        )

    # Get paginated results
    results = db.execute(
        text(f"""
        SELECT
            TO_CHAR({date_trunc}, :display_format) as period,
            COUNT(*) as count,
            MIN(timestamp) as start_date,
            MAX(timestamp) as end_date
        FROM posts
        WHERE status = 'published'
        GROUP BY {date_trunc}
        ORDER BY {date_trunc} DESC
        LIMIT :limit OFFSET :offset
        """),
        {"display_format": display_format, "limit": limit, "offset": offset},
    ).fetchall()

    # Get total count of unique periods
    total_result = db.execute(
        text(f"""
        SELECT COUNT(DISTINCT {date_trunc})
        FROM posts
        WHERE status = 'published'
        """)
    ).fetchone()

    total = total_result[0] if total_result else 0
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    items = [
        {
            "name": row[0],
            "count": row[1],
            "start_date": row[2].isoformat() if row[2] else None,
            "end_date": row[3].isoformat() if row[3] else None,
        }
        for row in results
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


def get_post_date_range(db: Session) -> dict:
    """
    Get the date range (min and max timestamps) of all published posts.

    Args:
        db: Database session

    Returns:
        Dict with earliest_date, latest_date, and total_count
    """
    result = (
        db.query(
            func.min(Post.timestamp).label("earliest"),
            func.max(Post.timestamp).label("latest"),
            func.count(Post.id).label("total"),
        )
        .filter(Post.status == "published")
        .first()
    )

    return {
        "earliest_date": result.earliest.isoformat() if result.earliest else None,
        "latest_date": result.latest.isoformat() if result.latest else None,
        "total_count": result.total if result else 0,
    }
