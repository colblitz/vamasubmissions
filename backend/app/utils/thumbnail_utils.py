"""
Thumbnail utilities for generating filenames and processing gallery-dl output.
"""

import re
import uuid
from pathlib import Path
from typing import Optional


def generate_thumbnail_filename(post_id: str, ordinal: int, extension: str) -> str:
    """
    Generate a thumbnail filename with UUID for uniqueness.

    Format: [postid]-t-[ordinal]-[uuid].[ext]
    Example: 129090487-t-000-a1b2c3d4.png

    Args:
        post_id: Post ID (e.g., "129090487")
        ordinal: Zero-indexed ordinal (e.g., 0, 1, 2)
        extension: File extension without dot (e.g., "png", "jpg")

    Returns:
        Formatted filename string

    Examples:
        >>> generate_thumbnail_filename("129090487", 0, "png")
        "129090487-t-000-a1b2c3d4.png"  # UUID will vary
        >>> generate_thumbnail_filename("123", 5, "webp")
        "123-t-005-b2c3d4e5.webp"  # UUID will vary
    """
    # Generate short UUID (8 characters)
    short_uuid = uuid.uuid4().hex[:8]

    # Format ordinal as 3-digit zero-padded
    ordinal_str = f"{ordinal:03d}"

    # Remove leading dot from extension if present
    extension = extension.lstrip(".")

    return f"{post_id}-t-{ordinal_str}-{short_uuid}.{extension}"


def get_file_extension(filename: str) -> str:
    """
    Extract file extension from filename (without dot).

    Args:
        filename: Filename to extract extension from

    Returns:
        Extension without dot (e.g., "png", "jpg")

    Examples:
        >>> get_file_extension("image.png")
        "png"
        >>> get_file_extension("photo.JPEG")
        "jpeg"
        >>> get_file_extension("file")
        ""
    """
    ext = Path(filename).suffix.lstrip(".")
    return ext.lower()


def build_thumbnail_url(filename: str, base_url: str = "https://vamarequests.com") -> str:
    """
    Build full thumbnail URL from filename.

    Args:
        filename: Thumbnail filename
        base_url: Base URL (default: production URL)

    Returns:
        Full URL to thumbnail

    Examples:
        >>> build_thumbnail_url("129090487-thumbnail-square-000-a1b2c3d4.png")
        "https://vamarequests.com/static/thumbnails/129090487-thumbnail-square-000-a1b2c3d4.png"
    """
    return f"{base_url}/static/thumbnails/{filename}"


def extract_post_id_from_thumbnail_filename(filename: str) -> Optional[str]:
    """
    Extract post ID from our thumbnail filename format.

    Format: [postid]-t-[ordinal]-[uuid].[ext]

    Args:
        filename: Thumbnail filename

    Returns:
        Post ID string, or None if not found

    Examples:
        >>> extract_post_id_from_thumbnail_filename("129090487-t-000-a1b2c3d4.png")
        "129090487"
        >>> extract_post_id_from_thumbnail_filename("invalid.png")
        None
    """
    # Pattern: [digits]-t-[ordinal]-[uuid].[ext]
    pattern = r"^(\d+)-t-\d{3}-[a-f0-9]{8}\.\w+$"
    match = re.match(pattern, filename)

    if match:
        return match.group(1)

    return None


def extract_ordinal_from_thumbnail_filename(filename: str) -> Optional[int]:
    """
    Extract ordinal from our thumbnail filename format.

    Format: [postid]-t-[ordinal]-[uuid].[ext]

    Args:
        filename: Thumbnail filename

    Returns:
        Ordinal as integer (0-indexed), or None if not found

    Examples:
        >>> extract_ordinal_from_thumbnail_filename("129090487-t-000-a1b2c3d4.png")
        0
        >>> extract_ordinal_from_thumbnail_filename("129090487-t-025-b2c3d4e5.png")
        25
        >>> extract_ordinal_from_thumbnail_filename("invalid.png")
        None
    """
    # Pattern: [postid]-t-[ordinal]-[uuid].[ext]
    pattern = r"^\d+-t-(\d{3})-[a-f0-9]{8}\.\w+$"
    match = re.match(pattern, filename)

    if match:
        return int(match.group(1))

    return None
