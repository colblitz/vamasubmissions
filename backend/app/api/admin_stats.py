"""Admin Stats API endpoints.

Provides site usage statistics for admins, sourced from backend log files.
"""

import os
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.user_service import get_current_owner_user
from app.utils.log_parser import parse_stats

router = APIRouter()

# Resolve log directory relative to this file: backend/app/api/ -> backend/logs/
_LOG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs"
)


@router.get("/site-stats")
async def get_stats(
    period: Literal["day", "week", "month", "all"] = Query(
        "all", description="Time window: day, week, month, or all"
    ),
    current_user: User = Depends(get_current_owner_user),
    db: Session = Depends(get_db),
):
    """
    Return site usage statistics for the given time period.

    Sourced from backend log files (search and login events).

    Returns:
        - unique_visitors_by_login: distinct users who authenticated
        - unique_visitors_by_search: distinct users who performed a search
        - visitor_names_by_login: list of usernames who logged in
        - visitor_names_by_search: list of usernames who searched
        - searches_per_user: list of {username, count} sorted by count desc
        - most_popular_chars: top searched character terms
        - most_popular_series: top searched series terms
        - most_popular_tags: top searched tag terms
    """
    stats = parse_stats(_LOG_DIR, period=period)

    # Unique visitors
    logins = stats["logins_by_patreon_id"]  # {patreon_id: username}
    searchers = stats["all_usernames_searched"]  # set of usernames

    # Searches per user — sorted descending
    searches_per_user = sorted(
        [{"username": u, "count": c} for u, c in stats["searches_by_username"].items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # Most popular searches — top 50 each, sorted descending
    def top_terms(term_dict: dict, limit: int = 50) -> list[dict]:
        return sorted(
            [{"term": t, "count": c} for t, c in term_dict.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:limit]

    return {
        "period": period,
        "unique_visitors_by_login": len(logins),
        "unique_visitors_by_search": len(searchers),
        "visitor_names_by_login": sorted(logins.values()),
        "visitor_names_by_search": sorted(searchers),
        "searches_per_user": searches_per_user,
        "most_popular_chars": top_terms(stats["popular_chars"]),
        "most_popular_series": top_terms(stats["popular_series"]),
        "most_popular_tags": top_terms(stats["popular_tags"]),
    }
