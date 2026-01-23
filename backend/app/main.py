"""Main FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
    ]
)

from app.core.config import settings
from app.core.database import engine, Base

# Import all models to ensure they're registered with SQLAlchemy
from app.models import (
    User,
    Submission,
    SubmissionImage,
    CreditTransaction,
    Vote,
    UserVoteAllowance,
    UserSession,
    SystemConfig,
    Post,
    CommunityRequest,
    PostEdit,
    EditHistory,
)
from app.api import auth, submissions, queue, admin, users

# Phase 1: Community Features
from app.api import posts, community_requests, edits

# Create database tables
Base.metadata.create_all(bind=engine)

# Create upload directory if it doesn't exist
os.makedirs(settings.upload_dir, exist_ok=True)

# Initialize FastAPI app
app = FastAPI(
    title="Patreon Character Submission API",
    description="API for managing character commission requests from Patreon supporters",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url] if settings.environment == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Mount static files for test thumbnails
thumbnails_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "test_thumbnails"
)
if os.path.exists(thumbnails_dir):
    app.mount("/static/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
app.include_router(queue.router, prefix="/api/queue", tags=["Queue"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Phase 1: Community Features
app.include_router(posts.router, prefix="/api/posts", tags=["Posts"])
app.include_router(community_requests.router, prefix="/api/requests", tags=["Community Requests"])
app.include_router(edits.router, prefix="/api/edits", tags=["Post Edits"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Patreon Character Submission API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
