"""Simplified test mode backend v2 - Major refactor with voting system."""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from datetime import datetime, timedelta
import os
import shutil
from pathlib import Path
import json
import base64

app = FastAPI(title="Test Mode API v2", version="2.0.0-test")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for test images
app.mount("/test_images", StaticFiles(directory="./test_uploads/test_images"), name="test_images")

# In-memory storage
USERS = {}
SUBMISSIONS = {}
VOTE_SESSIONS = {}  # New: separate voting system
_user_id = 1
_submission_id = 1
_vote_session_id = 1

# Tier rules
TIER_RULES = {
    1: {
        "name": "NSFW Art! Tier 1",
        "max_pending": 1,
        "credits_per_month": 0,
        "max_credits": 0,
        "credit_expiry_months": 0,
        "can_vote": True,
        "votes_per_month": 3,
    },
    2: {
        "name": "NSFW Art! Tier 2",
        "max_pending": None,
        "credits_per_month": 1,
        "max_credits": 2,
        "credit_expiry_months": 2,
        "can_vote": True,
        "votes_per_month": 3,
    },
    3: {
        "name": "NSFW Art! Tier 3",
        "max_pending": None,
        "credits_per_month": 2,
        "max_credits": 4,
        "credit_expiry_months": 2,
        "can_vote": True,
        "votes_per_month": 3,
    },
    4: {
        "name": "NSFW Art! support ^^",
        "max_pending": None,
        "credits_per_month": 4,
        "max_credits": 8,
        "credit_expiry_months": 2,
        "can_vote": True,
        "votes_per_month": 3,
    },
}

# Initialize mock users
def init_users():
    global _user_id
    for patreon_id, tier, role in [
        ("mock_tier1", 1, "patron"),
        ("mock_tier2", 2, "patron"),
        ("mock_tier3", 3, "patron"),
        ("mock_tier4", 4, "patron"),
        ("mock_admin", 4, "admin"),
        ("mock_creator", 4, "creator"),
    ]:
        tier_rules = TIER_RULES[tier]
        USERS[_user_id] = {
            "id": _user_id,
            "patreon_id": patreon_id,
            "patreon_username": tier_rules["name"] if tier <= 4 else f"User{_user_id}",
            "email": f"user{_user_id}@example.com",
            "tier": tier,
            "credits": tier_rules["max_credits"],
            "max_credits": tier_rules["max_credits"],
            "credits_per_month": tier_rules["credits_per_month"],
            "role": role,
            "votes_remaining": tier_rules["votes_per_month"],
            "created_at": datetime.utcnow().isoformat(),
            "last_login": datetime.utcnow().isoformat(),
        }
        _user_id += 1

# Initialize test submissions (removed in_progress status)
def init_test_submissions():
    global _submission_id
    now = datetime.utcnow()
    
    # Helper to create submission
    def create_sub(user_id, char, series, desc, status, tier, large=False, double=False, days_ago=0, patreon_url=None):
        global _submission_id
        created = now - timedelta(days=days_ago)
        queue_type = "requests" if tier > 1 else "free"
        
        sub = {
            "id": _submission_id,
            "user_id": user_id,
            "character_name": char,
            "series": series,
            "description": desc,
            "is_large_image_set": large,
            "is_double_character": double,
            "status": status,
            "queue_type": queue_type,
            "queue_position": _submission_id if status == "pending" else None,
            "submitted_at": created.isoformat(),
            "credit_cost": 1 + (1 if large else 0) + (1 if double else 0),
            "estimated_completion_date": (created + timedelta(days=7)).isoformat() if status == "pending" else None,
            "updated_at": created.isoformat(),
            "completed_at": (created + timedelta(days=5)).isoformat() if status == "completed" else None,
            "patreon_post_url": patreon_url,
            "images": [],
        }
        
        SUBMISSIONS[_submission_id] = sub
        _submission_id += 1
        return sub
    
    # Completed submissions (for search) - with Patreon links ONLY (no images)
    create_sub(2, "Asuna", "Sword Art Online", "Main heroine from SAO, skilled swordswoman and vice-commander of the Knights of the Blood guild", "completed", 2, False, False, 30, "https://patreon.com/posts/asuna-sao-1")
    create_sub(3, "Rem", "Re:Zero", "Blue-haired twin maid demon who serves Roswaal L Mathers, known for her loyalty and combat prowess with her morning star flail", "completed", 3, True, False, 25, "https://patreon.com/posts/rem-rezero-2")
    create_sub(4, "Zero Two", "Darling in the FranXX", "Pink-haired hybrid pilot with red horns, partner of Hiro in Strelizia, known for her wild personality and tragic past", "completed", 4, False, True, 20, "https://patreon.com/posts/zero-two-3")
    create_sub(2, "Megumin", "KonoSuba", "Crimson Demon arch wizard obsessed with explosion magic, despite being able to only cast it once per day before collapsing from exhaustion", "completed", 2, False, False, 15, "https://patreon.com/posts/megumin-4")
    create_sub(3, "Mai Sakurajima", "Bunny Girl Senpai", "Famous actress and model who became invisible to most people due to Adolescence Syndrome, known for her sharp wit and bunny girl outfit", "completed", 3, False, False, 10, "https://patreon.com/posts/mai-5")
    create_sub(4, "Makise Kurisu", "Steins;Gate", "Genius neuroscience researcher at 18, member of the Future Gadget Lab, tsundere personality with a love for science and Dr. Pepper", "completed", 4, True, False, 8, "https://patreon.com/posts/kurisu-6")
    
    # Requests queue (Tier 2+) - pending WITH 2-3 IMAGES EACH
    sub7 = create_sub(2, "Mikasa Ackerman", "Attack on Titan", "Elite soldier of the Scout Regiment, adopted sister of Eren Yeager, known for her exceptional combat skills and signature red scarf. One of humanity's strongest fighters with unmatched blade work and tactical prowess.", "pending", 2, False, False, 2)
    sub7["images"] = [
        {"id": 1, "submission_id": sub7["id"], "file_path": "/test_images/asuna_1.jpg", "file_size": 8628, "mime_type": "image/jpeg", "upload_order": 0},
        {"id": 2, "submission_id": sub7["id"], "file_path": "/test_images/rem_1.jpg", "file_size": 23230, "mime_type": "image/jpeg", "upload_order": 1},
    ]
    
    sub8 = create_sub(3, "Makima", "Chainsaw Man", "Control Devil and high-ranking Public Safety Devil Hunter, possesses mysterious and overwhelming powers. Calm, collected, and manipulative with golden ringed eyes. Has the ability to control anyone she believes is beneath her.", "pending", 3, True, False, 1)
    sub8["images"] = [
        {"id": 1, "submission_id": sub8["id"], "file_path": "/test_images/zerotwo_1.jpg", "file_size": 48423, "mime_type": "image/jpeg", "upload_order": 0},
        {"id": 2, "submission_id": sub8["id"], "file_path": "/test_images/megumin_1.jpg", "file_size": 24502, "mime_type": "image/jpeg", "upload_order": 1},
        {"id": 3, "submission_id": sub8["id"], "file_path": "/test_images/mai_1.jpg", "file_size": 52625, "mime_type": "image/jpeg", "upload_order": 2},
    ]
    
    sub9 = create_sub(4, "Power", "Chainsaw Man", "Blood Fiend and Public Safety Devil Hunter, partner of Denji. Brash, childish, and selfish with a superiority complex. Can manipulate blood to create weapons and has incredible regeneration. Despite her attitude, deeply cares for her cat Meowy and her friends.", "pending", 4, False, True, 1)
    sub9["images"] = [
        {"id": 1, "submission_id": sub9["id"], "file_path": "/test_images/kurisu_1.jpg", "file_size": 29895, "mime_type": "image/jpeg", "upload_order": 0},
        {"id": 2, "submission_id": sub9["id"], "file_path": "/test_images/asuna_1.jpg", "file_size": 8628, "mime_type": "image/jpeg", "upload_order": 1},
    ]
    
    sub10 = create_sub(2, "Hinata Hyuga", "Naruto", "Member of the Hyuga clan and heiress to the main branch, possesses the Byakugan kekkei genkai. Shy and kind-hearted kunoichi who admires and loves Naruto. Masters the Gentle Fist fighting style and becomes a powerful ninja in her own right.", "pending", 2, False, False, 0)
    sub10["images"] = [
        {"id": 1, "submission_id": sub10["id"], "file_path": "/test_images/rem_1.jpg", "file_size": 23230, "mime_type": "image/jpeg", "upload_order": 0},
        {"id": 2, "submission_id": sub10["id"], "file_path": "/test_images/zerotwo_1.jpg", "file_size": 48423, "mime_type": "image/jpeg", "upload_order": 1},
        {"id": 3, "submission_id": sub10["id"], "file_path": "/test_images/megumin_1.jpg", "file_size": 24502, "mime_type": "image/jpeg", "upload_order": 2},
    ]
    
    sub11 = create_sub(3, "Violet Evergarden", "Violet Evergarden", "Former child soldier turned Auto Memory Doll (ghostwriter), learning to understand emotions and the meaning of 'I love you' told to her by Major Gilbert. Beautiful with long blonde hair and striking blue eyes, wears prosthetic arms after the war.", "pending", 3, False, False, 0)
    sub11["images"] = [
        {"id": 1, "submission_id": sub11["id"], "file_path": "/test_images/mai_1.jpg", "file_size": 52625, "mime_type": "image/jpeg", "upload_order": 0},
        {"id": 2, "submission_id": sub11["id"], "file_path": "/test_images/kurisu_1.jpg", "file_size": 29895, "mime_type": "image/jpeg", "upload_order": 1},
    ]
    
    print(f"[INFO] Created {len(SUBMISSIONS)} test submissions")

# Initialize vote sessions
def init_vote_sessions():
    global _vote_session_id
    now = datetime.utcnow()
    
    # Active vote session with submissions (some test votes - one per person)
    session = {
        "id": _vote_session_id,
        "title": "January 2025 Community Vote",
        "description": "Vote for your favorite character to be drawn next!",
        "status": "open",
        "created_at": (now - timedelta(days=3)).isoformat(),
        "opened_at": (now - timedelta(days=3)).isoformat(),
        "closes_at": (now + timedelta(days=4)).isoformat(),
        "closed_at": None,
        "submissions": [
            {
                "id": 101,
                "character_name": "Hatsune Miku",
                "series": "Vocaloid",
                "description": "Virtual idol with twin tails",
                "submitted_by": 1,
                "vote_count": 3,
                "voters": [3, 4, 5],  # tier3, tier4, admin
            },
            {
                "id": 102,
                "character_name": "Raphtalia",
                "series": "Shield Hero",
                "description": "Raccoon demi-human",
                "submitted_by": 1,
                "vote_count": 1,
                "voters": [6],  # creator
            },
            {
                "id": 103,
                "character_name": "Aqua",
                "series": "KonoSuba",
                "description": "Useless goddess",
                "submitted_by": 1,
                "vote_count": 1,
                "voters": [1],  # tier1
            },
        ],
    }
    VOTE_SESSIONS[_vote_session_id] = session
    _vote_session_id += 1
    
    print(f"[INFO] Created {len(VOTE_SESSIONS)} vote sessions")

init_users()
init_test_submissions()
init_vote_sessions()

# Auth dependency
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    try:
        payload = json.loads(base64.b64decode(token))
        user_id = payload.get("user_id")
        user = USERS.get(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Endpoints
@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@app.get("/api/users/me")
async def get_user_me(user: dict = Depends(get_current_user)):
    return user

@app.get("/api/users/me/tier-rules")
async def get_tier_rules(user: dict = Depends(get_current_user)):
    """Get tier-specific rules for the current user."""
    return TIER_RULES[user["tier"]]

@app.post("/api/submissions/")
async def create_submission(
    character_name: str = Form(...),
    series: str = Form(...),
    description: str = Form(...),
    is_large_image_set: bool = Form(False),
    is_double_character: bool = Form(False),
    user: dict = Depends(get_current_user),
):
    global _submission_id
    
    cost = 1 + (1 if is_large_image_set else 0) + (1 if is_double_character else 0)
    
    # Check tier 1 max pending
    if user["tier"] == 1:
        pending_count = len([s for s in SUBMISSIONS.values() 
                           if s["user_id"] == user["id"] and s["status"] == "pending"])
        if pending_count >= 1:
            raise HTTPException(status_code=400, detail="Tier 1 users can only have 1 pending request")
    
    # Check credits for tier 2+
    if user["tier"] > 1 and user["credits"] < cost:
        raise HTTPException(status_code=400, detail=f"Not enough credits")
    
    submission = {
        "id": _submission_id,
        "user_id": user["id"],
        "character_name": character_name,
        "series": series,
        "description": description,
        "is_large_image_set": is_large_image_set,
        "is_double_character": is_double_character,
        "status": "pending",
        "queue_type": "requests" if user["tier"] > 1 else "free",
        "queue_position": len([s for s in SUBMISSIONS.values() if s["status"] == "pending"]) + 1,
        "submitted_at": datetime.utcnow().isoformat(),
        "credit_cost": cost,
        "estimated_completion_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "images": [],
    }
    
    SUBMISSIONS[_submission_id] = submission
    _submission_id += 1
    
    if user["tier"] > 1:
        user["credits"] -= cost
    
    return submission

@app.post("/api/submissions/{submission_id}/images")
async def upload_images(
    submission_id: int,
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only add images to pending submissions")
    
    # Check total image count (max 20)
    current_count = len(submission["images"])
    if current_count + len(files) > 20:
        raise HTTPException(status_code=400, detail=f"Maximum 20 images allowed. You have {current_count}, trying to add {len(files)}")
    
    upload_dir = Path("./test_uploads") / str(submission_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    images = []
    next_id = max([img["id"] for img in submission["images"]], default=0) + 1
    next_order = len(submission["images"])
    
    for idx, file in enumerate(files):
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        image = {
            "id": next_id + idx,
            "submission_id": submission_id,
            "file_path": f"/uploads/{submission_id}/{file.filename}",
            "file_size": file_path.stat().st_size,
            "mime_type": file.content_type,
            "upload_order": next_order + idx,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        images.append(image)
        submission["images"].append(image)
    
    return {"message": f"Uploaded {len(images)} images", "images": images}

@app.delete("/api/submissions/{submission_id}/images/{image_id}")
async def delete_image(
    submission_id: int,
    image_id: int,
    user: dict = Depends(get_current_user),
):
    """Delete a specific image from a pending submission."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only delete images from pending submissions")
    
    # Find and remove the image
    image = next((img for img in submission["images"] if img["id"] == image_id), None)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    submission["images"] = [img for img in submission["images"] if img["id"] != image_id]
    
    # Reorder remaining images
    for idx, img in enumerate(submission["images"]):
        img["upload_order"] = idx
    
    return {"message": "Image deleted", "remaining_images": len(submission["images"])}

@app.get("/api/submissions/")
async def list_submissions(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    submissions = [s for s in SUBMISSIONS.values() if s["user_id"] == user["id"]]
    if status:
        submissions = [s for s in submissions if s["status"] == status]
    return submissions

@app.put("/api/submissions/{submission_id}")
async def update_submission(
    submission_id: int,
    character_name: str = Form(...),
    series: str = Form(...),
    description: str = Form(...),
    is_large_image_set: bool = Form(False),
    is_double_character: bool = Form(False),
    user: dict = Depends(get_current_user),
):
    """Update a pending submission (inline edit)."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only edit pending submissions")
    
    new_cost = 1 + (1 if is_large_image_set else 0) + (1 if is_double_character else 0)
    old_cost = submission["credit_cost"]
    cost_diff = new_cost - old_cost
    
    if cost_diff > 0 and user["tier"] > 1 and user["credits"] < cost_diff:
        raise HTTPException(status_code=400, detail="Not enough credits for modifier changes")
    
    submission["character_name"] = character_name
    submission["series"] = series
    submission["description"] = description
    submission["is_large_image_set"] = is_large_image_set
    submission["is_double_character"] = is_double_character
    submission["credit_cost"] = new_cost
    submission["updated_at"] = datetime.utcnow().isoformat()
    
    if user["tier"] > 1:
        user["credits"] -= cost_diff
    
    return submission

@app.delete("/api/submissions/{submission_id}")
async def cancel_submission(submission_id: int, user: dict = Depends(get_current_user)):
    """Cancel a pending submission and refund credits."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending submissions")
    
    if user["tier"] > 1:
        user["credits"] += submission["credit_cost"]
        if user["credits"] > user["max_credits"]:
            user["credits"] = user["max_credits"]
    
    submission["status"] = "cancelled"
    submission["updated_at"] = datetime.utcnow().isoformat()
    
    return {"message": "Submission cancelled", "credits_refunded": submission["credit_cost"]}

@app.get("/api/submissions/autocomplete/series")
async def autocomplete_series(q: str):
    """Get series autocomplete."""
    series_list = list(set([s["series"] for s in SUBMISSIONS.values() if q.lower() in s["series"].lower()]))
    return {"series": series_list[:10]}

@app.get("/api/queue/requests")
async def get_requests_queue(user: dict = Depends(get_current_user)):
    """Get the requests queue (tier 2+ submissions)."""
    requests = [s for s in SUBMISSIONS.values() if s["queue_type"] == "requests" and s["status"] == "pending"]
    requests.sort(key=lambda x: x["queue_position"])
    
    for sub in requests:
        sub["is_own_submission"] = sub["user_id"] == user["id"]
    
    user_subs = [s for s in requests if s["user_id"] == user["id"]]
    
    return {
        "queue_type": "requests",
        "total_submissions": len(requests),
        "user_position": user_subs[0]["queue_position"] if user_subs else None,
        "user_submissions": user_subs,
        "visible_submissions": requests,
    }

@app.get("/api/submissions/search")
async def search_submissions(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Search completed submissions by character name or series (real-time)."""
    completed = [s for s in SUBMISSIONS.values() if s["status"] == "completed"]
    
    if q:
        q_lower = q.lower()
        completed = [s for s in completed if 
                    q_lower in s["character_name"].lower() or 
                    q_lower in s["series"].lower()]
    
    completed.sort(key=lambda x: x["completed_at"] or "", reverse=True)
    
    return {"results": completed, "total": len(completed)}

# Vote session endpoints
@app.get("/api/votes/sessions")
async def list_vote_sessions(user: dict = Depends(get_current_user)):
    """List all vote sessions."""
    sessions = list(VOTE_SESSIONS.values())
    sessions.sort(key=lambda x: x["created_at"], reverse=True)
    return {"sessions": sessions}

@app.get("/api/votes/sessions/{session_id}")
async def get_vote_session(session_id: int, user: dict = Depends(get_current_user)):
    """Get a specific vote session with submissions."""
    session = VOTE_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Vote session not found")
    
    # Add user's vote status to each submission
    for sub in session["submissions"]:
        sub["user_has_voted"] = user["id"] in sub["voters"]
    
    return session

@app.post("/api/votes/sessions/{session_id}/submissions/{submission_id}/vote")
async def vote_in_session(session_id: int, submission_id: int, user: dict = Depends(get_current_user)):
    """Vote for a submission in a vote session (single choice per session, auto-switches)."""
    session = VOTE_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Vote session not found")
    
    if session["status"] != "open":
        raise HTTPException(status_code=400, detail="Vote session is not open")
    
    # Find submission in session
    submission = next((s for s in session["submissions"] if s["id"] == submission_id), None)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found in this session")
    
    # Check if user already voted for this exact submission (clicking same option = no-op)
    if user["id"] in submission["voters"]:
        return {"message": "Already voted for this option", "new_vote_count": submission["vote_count"]}
    
    # Remove vote from any other submission in this session (auto-switch)
    for other_sub in session["submissions"]:
        if other_sub["id"] != submission_id and user["id"] in other_sub["voters"]:
            other_sub["vote_count"] -= 1
            other_sub["voters"].remove(user["id"])
    
    # Add vote to the selected submission
    submission["vote_count"] += 1
    submission["voters"].append(user["id"])
    
    return {"message": "Vote added", "new_vote_count": submission["vote_count"]}

@app.delete("/api/votes/sessions/{session_id}/submissions/{submission_id}/vote")
async def unvote_in_session(session_id: int, submission_id: int, user: dict = Depends(get_current_user)):
    """Remove vote from a submission in a vote session."""
    session = VOTE_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Vote session not found")
    
    if session["status"] != "open":
        raise HTTPException(status_code=400, detail="Vote session is not open")
    
    submission = next((s for s in session["submissions"] if s["id"] == submission_id), None)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found in this session")
    
    if user["id"] not in submission["voters"]:
        raise HTTPException(status_code=400, detail="You haven't voted on this submission")
    
    submission["vote_count"] -= 1
    submission["voters"].remove(user["id"])
    user["votes_remaining"] += 1
    
    return {"message": "Vote removed", "new_vote_count": submission["vote_count"], "votes_remaining": user["votes_remaining"]}

# Creator/Admin endpoints for vote sessions
@app.post("/api/votes/sessions")
async def create_vote_session(
    title: str = Form(...),
    description: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """Create a new vote session (creator/admin only)."""
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    global _vote_session_id
    
    session = {
        "id": _vote_session_id,
        "title": title,
        "description": description,
        "status": "draft",
        "created_at": datetime.utcnow().isoformat(),
        "opened_at": None,
        "closes_at": None,
        "closed_at": None,
        "submissions": [],
    }
    
    VOTE_SESSIONS[_vote_session_id] = session
    _vote_session_id += 1
    
    return session

@app.post("/api/votes/sessions/{session_id}/open")
async def open_vote_session(session_id: int, days_open: int = Form(7), user: dict = Depends(get_current_user)):
    """Open a vote session (creator/admin only)."""
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    session = VOTE_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Vote session not found")
    
    session["status"] = "open"
    session["opened_at"] = datetime.utcnow().isoformat()
    session["closes_at"] = (datetime.utcnow() + timedelta(days=days_open)).isoformat()
    
    return session

@app.post("/api/votes/sessions/{session_id}/close")
async def close_vote_session(session_id: int, user: dict = Depends(get_current_user)):
    """Close a vote session (creator/admin only)."""
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    session = VOTE_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Vote session not found")
    
    session["status"] = "closed"
    session["closed_at"] = datetime.utcnow().isoformat()
    
    return session

@app.get("/api/admin/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    all_subs = list(SUBMISSIONS.values())
    pending = [s for s in all_subs if s["status"] == "pending"]
    completed = [s for s in all_subs if s["status"] == "completed"]
    
    series_counts = {}
    for sub in completed:
        series = sub["series"]
        series_counts[series] = series_counts.get(series, 0) + 1
    
    popular_series = sorted(series_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "requests_queue_size": len([s for s in pending if s["queue_type"] == "requests"]),
        "total_pending": len(pending),
        "total_completed": len(completed),
        "total_users": len(USERS),
        "active_users": len(set(s["user_id"] for s in all_subs if s["status"] == "pending")),
        "avg_completion_days": 7.0,
        "popular_series": [{"series": s, "count": c} for s, c in popular_series],
        "active_vote_sessions": len([v for v in VOTE_SESSIONS.values() if v["status"] == "open"]),
    }

@app.get("/")
async def root():
    return {
        "message": "Test Mode API v2",
        "users": len(USERS),
        "submissions": len(SUBMISSIONS),
        "vote_sessions": len(VOTE_SESSIONS),
    }

print(f"[SUCCESS] Test backend v2 ready - {len(USERS)} users, {len(SUBMISSIONS)} submissions, {len(VOTE_SESSIONS)} vote sessions")
