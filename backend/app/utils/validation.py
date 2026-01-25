"""
Validation utilities for input normalization and sanitization.
"""

import unicodedata
from typing import List, Optional


def normalize_text(text: Optional[str]) -> Optional[str]:
    """
    Normalize text input:
    - Strip leading/trailing whitespace
    - Normalize unicode to NFC form (canonical composition)
    - Return None if empty after normalization

    Args:
        text: Input string to normalize

    Returns:
        Normalized string or None if empty

    Examples:
        >>> normalize_text("  Hello  ")
        "Hello"
        >>> normalize_text("   ")
        None
        >>> normalize_text(None)
        None
    """
    if not text:
        return None

    # Strip whitespace
    text = text.strip()

    # Return None if empty after stripping
    if not text:
        return None

    # Normalize unicode to NFC form (canonical composition)
    # This ensures consistent representation of accented characters
    text = unicodedata.normalize("NFC", text)

    return text


def normalize_array_field(items: Optional[List[str]]) -> List[str]:
    """
    Normalize array of strings:
    - Apply normalize_text to each item
    - Remove None/empty values
    - Remove case-insensitive duplicates
    - Preserve original case of first occurrence

    Args:
        items: List of strings to normalize

    Returns:
        List of normalized, deduplicated strings

    Examples:
        >>> normalize_array_field(["  Naruto  ", "naruto", "Sasuke"])
        ["Naruto", "Sasuke"]
        >>> normalize_array_field(["", "  ", "Valid"])
        ["Valid"]
        >>> normalize_array_field(None)
        []
    """
    if not items:
        return []

    normalized = []
    seen_lower = set()

    for item in items:
        normalized_item = normalize_text(item)
        if normalized_item:
            # Check case-insensitive duplicates
            lower_item = normalized_item.lower()
            if lower_item not in seen_lower:
                normalized.append(normalized_item)
                seen_lower.add(lower_item)

    return normalized
