"""Log file parser for admin stats.

Parses the rotating backend.log files to extract search and login events.
"""

import glob
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

# Regex patterns for log lines
# Format: "2026-05-10 10:16:19,810 - app.api.posts - INFO - [SEARCH] USERNAME searched [FILTERS] -> N results, page P/T"
SEARCH_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - app\.api\.posts - INFO - "
    r"\[SEARCH\] (.+?) searched \[(.+?)\] -> (\d+) results, page (\d+)/(\d+)$"
)

# Format: "2026-05-10 21:46:25,495 - app.api.auth - INFO - [LOGIN SUCCESS] USERNAME (patreon_id=..., ...)"
# Also: "[LOGIN SUCCESS - NEW USER] ..."
LOGIN_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - app\.api\.auth - INFO - "
    r"\[LOGIN SUCCESS(?:\s*-\s*NEW USER)?\] (.+?) \(patreon_id=(\d+),"
)


def _get_log_files(log_dir: str) -> list[str]:
    """Return all log files sorted oldest-first (log.3, log.2, log.1, log)."""
    pattern = os.path.join(log_dir, "backend.log*")
    files = glob.glob(pattern)
    # Rotated files have numeric suffixes; sort so highest number (oldest) comes first
    def sort_key(path):
        base = os.path.basename(path)
        if base == "backend.log":
            return 0  # newest, process last
        try:
            return -int(base.split(".")[-1])  # .3 -> -3, .2 -> -2 etc (oldest first)
        except ValueError:
            return -999
    return sorted(files, key=sort_key)


def _cutoff_for_period(period: str) -> Optional[datetime]:
    """Return UTC cutoff datetime for the given period, or None for 'all'."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC to match log timestamps
    if period == "day":
        return now - timedelta(days=1)
    elif period == "week":
        return now - timedelta(days=7)
    elif period == "month":
        return now - timedelta(days=30)
    return None  # all time


def parse_stats(log_dir: str, period: str = "all") -> dict:
    """
    Parse all backend log files and return stats for the given period.

    Args:
        log_dir: Path to the directory containing backend.log* files
        period: One of 'day', 'week', 'month', 'all'

    Returns:
        Dict with keys:
            - logins_by_patreon_id: {patreon_id: username} for unique logins
            - searches_by_username: {username: count} (page=1 only, to avoid pagination inflation)
            - all_usernames_searched: set of usernames who searched
            - popular_chars: {term: count}
            - popular_series: {term: count}
            - popular_tags: {term: count}
    """
    cutoff = _cutoff_for_period(period)
    files = _get_log_files(log_dir)

    # Unique logins: patreon_id -> most recent username seen
    logins_by_patreon_id: dict[str, str] = {}
    # Search counts per username (page 1 only)
    searches_by_username: defaultdict[str, int] = defaultdict(int)
    # All usernames who searched (any page)
    all_usernames_searched: set[str] = set()
    # Popular search terms by field type (page 1 only, to avoid counting pagination)
    popular_chars: defaultdict[str, int] = defaultdict(int)
    popular_series: defaultdict[str, int] = defaultdict(int)
    popular_tags: defaultdict[str, int] = defaultdict(int)

    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.rstrip("\n")

                    # Try SEARCH pattern first (more common)
                    m = SEARCH_PATTERN.match(line)
                    if m:
                        ts_str, username, filters, result_count, page_str, total_pages = m.groups()
                        ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
                        if cutoff and ts < cutoff:
                            continue
                        page = int(page_str)
                        all_usernames_searched.add(username)
                        # Only count page=1 as a distinct "search" to avoid pagination inflation
                        if page == 1:
                            searches_by_username[username] += 1
                            # Parse popular search terms from filter string
                            _extract_popular_terms(filters, popular_chars, popular_series, popular_tags)
                        continue

                    # Try LOGIN pattern
                    m = LOGIN_PATTERN.match(line)
                    if m:
                        ts_str, username, patreon_id = m.groups()
                        ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
                        if cutoff and ts < cutoff:
                            continue
                        logins_by_patreon_id[patreon_id] = username.strip()

        except (OSError, IOError):
            continue

    return {
        "logins_by_patreon_id": logins_by_patreon_id,
        "searches_by_username": dict(searches_by_username),
        "all_usernames_searched": all_usernames_searched,
        "popular_chars": dict(popular_chars),
        "popular_series": dict(popular_series),
        "popular_tags": dict(popular_tags),
    }


# Patterns for extracting individual search terms from the filter string
# Filter string examples:
#   "no filters"
#   "chars=['Saber']"
#   "chars=['Saber', 'Rin']"
#   "series=['Fate/Grand Order']"
#   "tags=['ponytail', 'bikini']"
#   "q='tifa'"
#   "chars=['Tifa'], tags=['bikini']"
_CHARS_RE = re.compile(r"chars=\[([^\]]+)\]")
_SERIES_RE = re.compile(r"series=\[([^\]]+)\]")
_TAGS_RE = re.compile(r"tags=\[([^\]]+)\]")
_TERM_RE = re.compile(r"'([^']+)'")


def _extract_popular_terms(
    filters: str,
    popular_chars: defaultdict,
    popular_series: defaultdict,
    popular_tags: defaultdict,
) -> None:
    """Extract search terms from a filter string and increment counters."""
    m = _CHARS_RE.search(filters)
    if m:
        for term in _TERM_RE.findall(m.group(1)):
            popular_chars[term.strip().lower()] += 1

    m = _SERIES_RE.search(filters)
    if m:
        for term in _TERM_RE.findall(m.group(1)):
            popular_series[term.strip().lower()] += 1

    m = _TAGS_RE.search(filters)
    if m:
        for term in _TERM_RE.findall(m.group(1)):
            popular_tags[term.strip().lower()] += 1
