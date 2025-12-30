"""Test mode FastAPI application with in-memory mock data."""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timedelta
import os
import shutil
from pathlib import Path

app = FastAPI(
    title="Patreon Character Submission API (TEST MODE)",
    description="Test mode with in-memory mock data - no database required",
    version="1.0.0-test",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
USERS = {}
SUBMISSIONS = {}
IMAGES = {}
SESSIONS = {}
VOTES = {}
VOTE_ALLOWANCES = {}

# Counters
_user_id = 1
_submission_id = 1
_image_id = 1

# Initialize mock users
def init_mock_users():
    global _user_id
    mock_users = [
        {"patreon_id": "mock_tier1", "username": "Tier1User", "tier": 1, "credits": 0, "role": "patron"},
        {"patreon_id": "mock_tier2", "username": "Tier2User", "tier": 2, "credits": 2, "role": "patron"},
        {"patreon_id": "mock_tier3", "username": "Tier3User", "tier": 3, "credits": 4, "role": "patron"},
        {"patreon_id": "mock_tier4", "username": "Tier4User", "tier": 4, "credits": 8, "role": "patron"},
        {"patreon_id": "mock_admin", "username": "AdminUser", "tier": 4, "credits": 8, "role": "admin"},
        {"patreon_id": "mock_creator", "username": "CreatorUser", "tier": 4, "credits": 8, "role": "creator"},
    ]
    
    for user_data in mock_users:
        user = {
            "id": _user_id,
            "patreon_id": user_data["patreon_id"],
            "patreon_username": user_data["username"],
            "email": f"{user_data['username'].lower()}@example.com",
            "tier": user_data["tier"],
            "credits": user_data["credits"],
            "max_credits": {1: 0, 2: 2, 3: 4, 4: 8}[user_data["tier"]],
            "credits_per_month": {1: 0, 2: 1, 3: 2, 4: 4}[user_data["tier"]],
            "role": user_data["role"],
            "can_submit_multiple": user_data["tier"] > 1,
            "created_at": datetime.utcnow().isoformat(),
            "last_login": datetime.utcnow().isoformat(),
        }
        USERS[_user_id] = user
        _user_id += 1

init_mock_users()

# Helper to get user from token
from fastapi import Header, Depends

def get_current_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    print(f"[DEBUG] Authorization header: {authorization}")
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated - no header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated - invalid format")
    
    token = authorization.split(" ")[1]
    print(f"[DEBUG] Token: {token}")
    
    # Decode mock token (just base64 encoded JSON)
    import json
    import base64
    try:
        payload = json.loads(base64.b64decode(token))
        print(f"[DEBUG] Decoded payload: {payload}")
        user_id = payload.get("user_id")
        user = USERS.get(user_id)
        if not user:
            print(f"[ERROR] User {user_id} not found in USERS")
            raise HTTPException(status_code=401, detail="User not found")
        print(f"[DEBUG] User authenticated: {user['patreon_username']}")
        return user
    except Exception as e:
        print(f"[ERROR] Token decode failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    return user

# Users endpoints
@app.get("/api/users/me")
async def get_user_me(user: dict = Depends(get_current_user)):
    """Get current user."""
    return user

@app.get("/api/users/me/credits/history")
async def get_credit_history(limit: int = 50, user: dict = Depends(get_current_user)):
    """Get credit history (mock - returns empty)."""
    return {"transactions": [], "current_credits": user["credits"]}

# Submissions endpoints
@app.post("/api/submissions/")
async def create_submission(
    character_name: str = Form(...),
    series: str = Form(...),
    description: str = Form(...),
    is_public: bool = Form(False),
    is_large_image_set: bool = Form(False),
    is_double_character: bool = Form(False),
    authorization: str = None,
):
    """Create a submission."""
    global _submission_id
    
    user = get_current_user(authorization)
    
    # Check tier 1 limit
    if user["tier"] == 1:
        pending = [s for s in SUBMISSIONS.values() if s["user_id"] == user["id"] and s["status"] == "pending"]
        if len(pending) >= 1:
            raise HTTPException(status_code=400, detail="Tier 1 users can only have one pending submission")
    
    # Calculate cost
    cost = 1 + (1 if is_large_image_set else 0) + (1 if is_double_character else 0)
    
    # Check credits
    if user["tier"] > 1 and user["credits"] < cost:
        raise HTTPException(status_code=400, detail=f"Not enough credits. Need {cost}, have {user['credits']}")
    
    # Create submission
    submission = {
        "id": _submission_id,
        "user_id": user["id"],
        "character_name": character_name,
        "series": series,
        "description": description,
        "is_public": is_public,
        "is_large_image_set": is_large_image_set,
        "is_double_character": is_double_character,
        "status": "pending",
        "queue_type": "paid" if user["tier"] > 1 else "free",
        "queue_position": len([s for s in SUBMISSIONS.values() if s["status"] == "pending"]) + 1,
        "vote_count": 0,
        "submitted_at": datetime.utcnow().isoformat(),
        "credit_cost": cost,
        "estimated_completion_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "images": [],
    }
    
    SUBMISSIONS[_submission_id] = submission
    _submission_id += 1
    
    # Deduct credits
    if user["tier"] > 1:
        user["credits"] -= cost
    
    return submission

@app.post("/api/submissions/{submission_id}/images")
async def upload_images(
    submission_id: int,
    files: List[UploadFile] = File(...),
    authorization: str = None,
):
    """Upload images for a submission."""
    global _image_id
    
    user = get_current_user(authorization)
    submission = SUBMISSIONS.get(submission_id)
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create upload directory
    upload_dir = Path("./test_uploads") / str(submission_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    images = []
    for idx, file in enumerate(files):
        # Save file
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        image = {
            "id": _image_id,
            "submission_id": submission_id,
            "file_path": f"/uploads/{submission_id}/{file.filename}",
            "file_size": file_path.stat().st_size,
            "mime_type": file.content_type,
            "upload_order": idx,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        
        IMAGES[_image_id] = image
        submission["images"].append(image)
        images.append(image)
        _image_id += 1
    
    return {"message": f"Uploaded {len(images)} images", "images": images}

@app.get("/api/submissions/")
async def list_submissions(authorization: str = None, status: Optional[str] = None):
    """List user's submissions."""
    user = get_current_user(authorization)
    submissions = [s for s in SUBMISSIONS.values() if s["user_id"] == user["id"]]
    
    if status:
        submissions = [s for s in submissions if s["status"] == status]
    
    return submissions

@app.get("/api/submissions/{submission_id}")
async def get_submission(submission_id: int, authorization: str = None):
    """Get a submission."""
    user = get_current_user(authorization)
    submission = SUBMISSIONS.get(submission_id)
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check permissions
    if submission["user_id"] != user["id"] and not submission["is_public"] and user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return submission

@app.get("/api/submissions/search/")
async def search_submissions(q: str, authorization: str = None):
    """Search submissions."""
    user = get_current_user(authorization)
    
    results = []
    for submission in SUBMISSIONS.values():
        if submission["status"] != "completed":
            continue
        
        # Check visibility
        if submission["user_id"] != user["id"] and not submission["is_public"]:
            continue
        
        # Search in name or series
        if q.lower() in submission["character_name"].lower() or q.lower() in submission["series"].lower():
            results.append(submission)
    
    return results

@app.get("/api/submissions/autocomplete/series")
async def autocomplete_series(q: str):
    """Get series autocomplete."""
    series_list = list(set([s["series"] for s in SUBMISSIONS.values() if q.lower() in s["series"].lower()]))
    return {"series": series_list[:10]}

# Queue endpoints
@app.get("/api/queue/paid")
async def get_paid_queue(authorization: str = None):
    """Get paid queue."""
    user = get_current_user(authorization)
    
    paid_submissions = [s for s in SUBMISSIONS.values() if s["queue_type"] == "paid" and s["status"] == "pending"]
    paid_submissions.sort(key=lambda x: x["queue_position"])
    
    user_submissions = [s for s in paid_submissions if s["user_id"] == user["id"]]
    visible = [s for s in paid_submissions if s["is_public"] or s["user_id"] == user["id"]]
    
    return {
        "queue_type": "paid",
        "total_submissions": len(paid_submissions),
        "user_position": user_submissions[0]["queue_position"] if user_submissions else None,
        "user_submissions": user_submissions,
        "visible_submissions": visible,
    }

@app.get("/api/queue/free")
async def get_free_queue(authorization: str = None):
    """Get free queue."""
    user = get_current_user(authorization)
    
    free_submissions = [s for s in SUBMISSIONS.values() if s["queue_type"] == "free" and s["status"] == "pending"]
    free_submissions.sort(key=lambda x: (-x["vote_count"], x["submitted_at"]))
    
    user_submissions = [s for s in free_submissions if s["user_id"] == user["id"]]
    visible = [s for s in free_submissions if s["is_public"] or s["user_id"] == user["id"]]
    
    return {
        "queue_type": "free",
        "total_submissions": len(free_submissions),
        "user_position": user_submissions[0]["queue_position"] if user_submissions else None,
        "user_submissions": user_submissions,
        "visible_submissions": visible,
    }

@app.get("/api/queue/vote/allowance")
async def get_vote_allowance(authorization: str = None):
    """Get vote allowance."""
    user = get_current_user(authorization)
    month_year = datetime.utcnow().strftime("%Y-%m")
    
    key = f"{user['id']}_{month_year}"
    if key not in VOTE_ALLOWANCES:
        VOTE_ALLOWANCES[key] = {
            "month_year": month_year,
            "votes_available": 3,
            "votes_used": 0,
            "votes_remaining": 3,
        }
    
    return VOTE_ALLOWANCES[key]

@app.get("/api/queue/vote/my-votes")
async def get_my_votes(authorization: str = None):
    """Get user's votes."""
    user = get_current_user(authorization)
    votes = [v["submission_id"] for v in VOTES.values() if v["user_id"] == user["id"]]
    return {"submission_ids": votes, "total_votes": len(votes)}

# Admin endpoints
@app.get("/api/admin/stats")
async def get_stats(authorization: str = None):
    """Get queue statistics."""
    user = get_current_user(authorization)
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    paid_queue = len([s for s in SUBMISSIONS.values() if s["queue_type"] == "paid" and s["status"] == "pending"])
    free_queue = len([s for s in SUBMISSIONS.values() if s["queue_type"] == "free" and s["status"] == "pending"])
    in_progress = len([s for s in SUBMISSIONS.values() if s["status"] == "in_progress"])
    completed = len([s for s in SUBMISSIONS.values() if s["status"] == "completed"])
    
    return {
        "paid_queue_size": paid_queue,
        "free_queue_size": free_queue,
        "total_pending": paid_queue + free_queue,
        "total_in_progress": in_progress,
        "total_completed": completed,
        "avg_completion_days": 7.0,
        "popular_series": [],
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Patreon Character Submission API (TEST MODE)",
        "version": "1.0.0-test",
        "docs": "/docs",
        "note": "Running with in-memory mock data - no database required",
    }

@app.get("/health")
async def health():
    """Health check."""
    return {"status": "healthy", "mode": "test"}

print("[SUCCESS] Test mode backend initialized")
print(f"[INFO] Mock users created: {len(USERS)}")
print("[INFO] Ready to accept requests")
