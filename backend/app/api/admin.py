"""
Admin API endpoints - Main router.

This module serves as the main entry point for all admin endpoints.
It includes sub-routers for different functional areas:
- admin_posts: Post import and management (Phase 1 active)
- admin_patreon: Patreon integration utilities (active)
- admin_legacy: Legacy submission system (Phase 0, currently hidden)
"""

from fastapi import APIRouter

# Import sub-routers
from app.api.admin_posts import router as posts_router
from app.api.admin_patreon import router as patreon_router
from app.api.admin_legacy import router as legacy_router

# Create main admin router
router = APIRouter()

# Include sub-routers with appropriate prefixes and tags
router.include_router(
    posts_router,
    tags=["admin-posts"],
)

router.include_router(
    patreon_router,
    tags=["admin-patreon"],
)

router.include_router(
    legacy_router,
    tags=["admin-legacy"],
)
