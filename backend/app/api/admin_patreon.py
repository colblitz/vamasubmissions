"""Admin Patreon integration endpoints."""

from fastapi import APIRouter

# All OAuth-based endpoints have been removed.
# Tier information is now managed via configuration files.
# Post fetching uses gallery-dl with session_id cookie instead of OAuth.

router = APIRouter()
