"""
Utility functions for sorting thumbnail URLs by ordinal.
Thumbnail format: [postid]-t-[ordinal]-[uuid].ext
Example: 122097057-t-000-1b73c5f0.png
"""

import re
from typing import List


def extract_ordinal(url: str) -> int:
    """
    Extract ordinal from thumbnail filename.

    Args:
        url: Thumbnail URL or filename

    Returns:
        Ordinal number, or float('inf') if not found (sorts to end)
    """
    if not url:
        return float('inf')

    # Extract filename from URL
    filename = url.split('/')[-1]

    # Match pattern: anything-t-[digits]-anything
    match = re.search(r'-t-(\d+)-', filename)

    if match:
        return int(match.group(1))

    # If pattern doesn't match, return infinity (sorts to end)
    return float('inf')


def sort_thumbnails(thumbnail_urls: List[str]) -> List[str]:
    """
    Sort thumbnail URLs by ordinal.
    Maintains original order if ordinals can't be extracted.

    Args:
        thumbnail_urls: Array of thumbnail URLs

    Returns:
        Sorted array
    """
    if not thumbnail_urls:
        return thumbnail_urls

    # Create list of (url, ordinal, original_index) tuples
    with_ordinals = [
        (url, extract_ordinal(url), idx)
        for idx, url in enumerate(thumbnail_urls)
    ]

    # Sort by ordinal, then by original index (stable sort)
    with_ordinals.sort(key=lambda x: (x[1], x[2]))

    # Return sorted URLs
    return [item[0] for item in with_ordinals]
