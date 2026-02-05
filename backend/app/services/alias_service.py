"""Value Alias service with in-memory caching."""

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from fastapi import HTTPException, status
from typing import Optional, Dict, List
from datetime import datetime, timedelta

from app.models.value_alias import ValueAlias
from app.models.search_analytics import SearchAnalytics
from app.schemas.value_alias import (
    ValueAliasCreate,
    ValueAliasUpdate,
    ValueAliasList,
    ZeroResultSuggestionList,
    ZeroResultSuggestion,
)


class AliasCache:
    """
    In-memory cache for value aliases.
    
    Provides fast O(1) lookups for alias resolution.
    Reloads periodically and on-demand.
    """
    
    _cache: Optional[Dict[str, Dict[str, str]]] = None
    _last_reload: Optional[datetime] = None
    _reload_interval = 300  # 5 minutes
    
    @classmethod
    def resolve_alias(cls, db: Session, field_type: str, value: str) -> str:
        """
        Resolve an alias to its canonical value.
        
        Args:
            db: Database session
            field_type: 'characters', 'series', or 'tags'
            value: Value to resolve (could be alias or canonical)
        
        Returns:
            Canonical value if alias exists, otherwise original value
        """
        # Reload cache if stale or empty
        if cls._cache is None or cls._should_reload():
            cls.reload_cache(db)
        
        # Fast in-memory lookup (case-insensitive)
        value_lower = value.lower()
        return cls._cache.get(field_type, {}).get(value_lower, value)
    
    @classmethod
    def _should_reload(cls) -> bool:
        """Check if cache should be reloaded."""
        if cls._last_reload is None:
            return True
        
        elapsed = (datetime.utcnow() - cls._last_reload).total_seconds()
        return elapsed > cls._reload_interval
    
    @classmethod
    def reload_cache(cls, db: Session):
        """
        Reload the alias cache from database.
        
        Args:
            db: Database session
        """
        # Load all aliases from DB
        aliases = db.query(ValueAlias).all()
        
        # Build cache structure: {field_type: {alias_lower: canonical}}
        cls._cache = {
            'characters': {},
            'series': {},
            'tags': {}
        }
        
        for alias in aliases:
            cls._cache[alias.field_type][alias.alias_value.lower()] = alias.canonical_value
        
        cls._last_reload = datetime.utcnow()
    
    @classmethod
    def force_reload(cls, db: Session):
        """Force immediate cache reload (call after alias changes)."""
        cls.reload_cache(db)


def get_alias_by_id(db: Session, alias_id: int) -> Optional[ValueAlias]:
    """Get alias by ID."""
    return db.query(ValueAlias).filter(ValueAlias.id == alias_id).first()


def create_alias(
    db: Session,
    user_id: int,
    alias_data: ValueAliasCreate,
) -> ValueAlias:
    """
    Create a new value alias.
    
    Args:
        db: Database session
        user_id: User ID creating the alias
        alias_data: Alias creation data
    
    Returns:
        Created alias
    """
    # Check if alias already exists
    existing = db.query(ValueAlias).filter(
        ValueAlias.field_type == alias_data.field_type,
        func.lower(ValueAlias.alias_value) == alias_data.alias_value.lower()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alias '{alias_data.alias_value}' already exists for {alias_data.field_type}"
        )
    
    # Create alias
    alias = ValueAlias(
        field_type=alias_data.field_type,
        canonical_value=alias_data.canonical_value,
        alias_value=alias_data.alias_value,
        created_by=user_id,
    )
    
    db.add(alias)
    db.commit()
    db.refresh(alias)
    
    # Force cache reload
    AliasCache.force_reload(db)
    
    return alias


def update_alias(
    db: Session,
    alias_id: int,
    alias_data: ValueAliasUpdate,
) -> ValueAlias:
    """
    Update a value alias.
    
    Args:
        db: Database session
        alias_id: Alias ID
        alias_data: Alias update data
    
    Returns:
        Updated alias
    """
    alias = get_alias_by_id(db, alias_id)
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alias not found"
        )
    
    # Update fields
    update_data = alias_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alias, field, value)
    
    alias.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(alias)
    
    # Force cache reload
    AliasCache.force_reload(db)
    
    return alias


def delete_alias(db: Session, alias_id: int):
    """
    Delete a value alias.
    
    Args:
        db: Database session
        alias_id: Alias ID
    """
    alias = get_alias_by_id(db, alias_id)
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alias not found"
        )
    
    db.delete(alias)
    db.commit()
    
    # Force cache reload
    AliasCache.force_reload(db)


def get_aliases(
    db: Session,
    field_type: Optional[str] = None,
) -> ValueAliasList:
    """
    Get all value aliases, optionally filtered by field type.
    
    Args:
        db: Database session
        field_type: Optional field type filter
    
    Returns:
        List of aliases
    """
    q = db.query(ValueAlias)
    
    if field_type:
        q = q.filter(ValueAlias.field_type == field_type)
    
    aliases = q.order_by(ValueAlias.canonical_value.asc(), ValueAlias.alias_value.asc()).all()
    
    return ValueAliasList(
        aliases=aliases,
        total=len(aliases)
    )


def track_search(
    db: Session,
    field_type: str,
    search_term: str,
    result_count: int,
    user_id: Optional[int] = None,
):
    """
    Track a search query for analytics.
    
    Args:
        db: Database session
        field_type: 'characters', 'series', or 'tags'
        search_term: The search term used
        result_count: Number of results returned
        user_id: Optional user ID
    """
    # Only track if search term is meaningful (not empty, not too short)
    if not search_term or len(search_term.strip()) < 2:
        return
    
    analytics = SearchAnalytics(
        field_type=field_type,
        search_term=search_term.strip(),
        result_count=result_count,
        user_id=user_id,
    )
    
    db.add(analytics)
    db.commit()


def get_zero_result_suggestions(
    db: Session,
    field_type: Optional[str] = None,
    limit: int = 50,
) -> ZeroResultSuggestionList:
    """
    Get zero-result search suggestions for creating aliases.
    
    Args:
        db: Database session
        field_type: Optional field type filter
        limit: Max results
    
    Returns:
        List of zero-result search suggestions
    """
    # Refresh materialized view (could be done periodically instead)
    db.execute(text("REFRESH MATERIALIZED VIEW zero_result_search_suggestions"))
    
    # Query materialized view
    query = """
        SELECT field_type, search_term, search_count, last_searched
        FROM zero_result_search_suggestions
    """
    
    params = {}
    if field_type:
        query += " WHERE field_type = :field_type"
        params['field_type'] = field_type
    
    query += " ORDER BY search_count DESC, last_searched DESC LIMIT :limit"
    params['limit'] = limit
    
    results = db.execute(text(query), params).fetchall()
    
    suggestions = [
        ZeroResultSuggestion(
            field_type=row[0],
            search_term=row[1],
            search_count=row[2],
            last_searched=row[3]
        )
        for row in results
    ]
    
    return ZeroResultSuggestionList(
        suggestions=suggestions,
        total=len(suggestions)
    )


def create_alias_from_suggestion(
    db: Session,
    user_id: int,
    field_type: str,
    search_term: str,
    canonical_value: str,
) -> ValueAlias:
    """
    Create an alias from a zero-result suggestion.
    
    Args:
        db: Database session
        user_id: User ID creating the alias
        field_type: Field type
        search_term: The search term to make an alias
        canonical_value: The canonical value to map to
    
    Returns:
        Created alias
    """
    alias_data = ValueAliasCreate(
        field_type=field_type,
        canonical_value=canonical_value,
        alias_value=search_term,
    )
    
    return create_alias(db, user_id, alias_data)


def delete_search_analytics(
    db: Session,
    field_type: str,
    search_term: str,
):
    """
    Delete all search analytics entries for a specific search term.
    
    Args:
        db: Database session
        field_type: Field type
        search_term: Search term to delete
    """
    db.query(SearchAnalytics).filter(
        SearchAnalytics.field_type == field_type,
        func.lower(SearchAnalytics.search_term) == search_term.lower()
    ).delete()
    
    db.commit()
