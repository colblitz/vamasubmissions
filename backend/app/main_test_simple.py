"""Simplified test mode backend - all endpoints use Depends properly."""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timedelta
import os
import shutil
from pathlib import Path
import json
import base64

app = FastAPI(title="Test Mode API", version="1.0.0-test")

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
VOTES = {}
_user_id = 1
_submission_id = 1

# Initialize mock users
def init_users():
    global _user_id
    for patreon_id, username, tier, role in [
        ("mock_tier1", "Tier1User", 1, "patron"),
        ("mock_tier2", "Tier2User", 2, "patron"),
        ("mock_tier3", "Tier3User", 3, "patron"),
        ("mock_tier4", "Tier4User", 4, "patron"),
        ("mock_admin", "AdminUser", 4, "admin"),
        ("mock_creator", "CreatorUser", 4, "creator"),
    ]:
        USERS[_user_id] = {
            "id": _user_id,
            "patreon_id": patreon_id,
            "patreon_username": username,
            "email": f"{username.lower()}@example.com",
            "tier": tier,
            "credits": {1: 0, 2: 2, 3: 4, 4: 8}[tier],
            "max_credits": {1: 0, 2: 2, 3: 4, 4: 8}[tier],
            "credits_per_month": {1: 0, 2: 1, 3: 2, 4: 4}[tier],
            "role": role,
            "can_submit_multiple": tier > 1,
            "votes_remaining": 3,
            "created_at": datetime.utcnow().isoformat(),
            "last_login": datetime.utcnow().isoformat(),
        }
        _user_id += 1

# Initialize test submissions
def init_test_submissions():
    global _submission_id
    now = datetime.utcnow()
    
    # Helper to create submission
    def create_sub(user_id, char, series, desc, status, tier, large=False, double=False, days_ago=0, votes=0):
        global _submission_id
        created = now - timedelta(days=days_ago)
        queue_type = "paid" if tier > 1 else "free"
        
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
            "queue_position": _submission_id,
            "vote_count": votes,
            "submitted_at": created.isoformat(),
            "credit_cost": 1 + (1 if large else 0) + (1 if double else 0),
            "estimated_completion_date": (created + timedelta(days=7)).isoformat(),
            "updated_at": created.isoformat(),
            "completed_at": (created + timedelta(days=5)).isoformat() if status == "completed" else None,
            "patreon_post_url": f"https://patreon.com/posts/{_submission_id}" if status == "completed" else None,
            "images": [],
        }
        
        SUBMISSIONS[_submission_id] = sub
        if queue_type == "free" and status == "pending":
            VOTES[_submission_id] = {"count": votes, "voters": []}
        
        _submission_id += 1
        return sub
    
    # Completed submissions (for search)
    create_sub(2, "Asuna", "Sword Art Online", "Main heroine from SAO", "completed", 2, False, False, 30)
    create_sub(3, "Rem", "Re:Zero", "Blue-haired maid", "completed", 3, True, False, 25)
    create_sub(4, "Zero Two", "Darling in the FranXX", "Pink-haired pilot", "completed", 4, False, True, 20)
    create_sub(2, "Megumin", "KonoSuba", "Explosion magic user", "completed", 2, False, False, 15)
    create_sub(3, "Mai Sakurajima", "Bunny Girl Senpai", "Actress with bunny outfit", "completed", 3, False, False, 10)
    create_sub(4, "Makise Kurisu", "Steins;Gate", "Genius scientist", "completed", 4, True, False, 8)
    
    # In-progress submissions
    create_sub(4, "Yor Forger", "Spy x Family", "Assassin mother", "in_progress", 4, True, True, 5)
    create_sub(2, "Nezuko", "Demon Slayer", "Demon girl with bamboo", "in_progress", 2, False, False, 3)
    
    # Paid queue (Tier 2+) - pending
    create_sub(2, "Mikasa Ackerman", "Attack on Titan", "Scout Regiment soldier", "pending", 2, False, False, 2)
    create_sub(3, "Makima", "Chainsaw Man", "Control Devil", "pending", 3, True, False, 1)
    create_sub(4, "Power", "Chainsaw Man", "Blood Fiend", "pending", 4, False, True, 1)
    create_sub(2, "Hinata Hyuga", "Naruto", "Byakugan user", "pending", 2, False, False, 0)
    create_sub(3, "Violet Evergarden", "Violet Evergarden", "Auto Memory Doll", "pending", 3, False, False, 0)
    
    # Free queue (Tier 1) - pending with votes
    create_sub(1, "Hatsune Miku", "Vocaloid", "Virtual idol with twin tails", "pending", 1, False, False, 4, 15)
    create_sub(1, "Raphtalia", "Shield Hero", "Raccoon demi-human", "pending", 1, False, False, 3, 12)
    create_sub(1, "Aqua", "KonoSuba", "Useless goddess", "pending", 1, False, False, 2, 8)
    create_sub(1, "Emilia", "Re:Zero", "Half-elf with silver hair", "pending", 1, False, False, 1, 5)
    create_sub(1, "Kaguya Shinomiya", "Kaguya-sama", "Student council vice president", "pending", 1, False, False, 0, 3)
    create_sub(1, "Chika Fujiwara", "Kaguya-sama", "Chaos incarnate", "pending", 1, False, False, 0, 2)
    
    print(f"[INFO] Created {len(SUBMISSIONS)} test submissions")

init_users()
init_test_submissions()

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

@app.get("/api/users/me/credits/history")
async def get_credit_history(limit: int = 50, user: dict = Depends(get_current_user)):
    return {"transactions": [], "current_credits": user["credits"]}

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
    
    # Create upload directory
    upload_dir = Path("./test_uploads") / str(submission_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    images = []
    for idx, file in enumerate(files):
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        image = {
            "id": len(images) + 1,
            "submission_id": submission_id,
            "file_path": f"/uploads/{submission_id}/{file.filename}",
            "file_size": file_path.stat().st_size,
            "mime_type": file.content_type,
            "upload_order": idx,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        images.append(image)
        submission["images"].append(image)
    
    return {"message": f"Uploaded {len(images)} images", "images": images}

@app.get("/api/submissions/")
async def list_submissions(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    submissions = [s for s in SUBMISSIONS.values() if s["user_id"] == user["id"]]
    if status:
        submissions = [s for s in submissions if s["status"] == status]
    return submissions

@app.get("/api/submissions/{submission_id}")
async def get_submission(submission_id: int, user: dict = Depends(get_current_user)):
    """Get a single submission by ID."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # All submissions are now public - anyone can view
    return submission

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
    """Update a pending submission."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only edit pending submissions")
    
    # Calculate new cost
    new_cost = 1 + (1 if is_large_image_set else 0) + (1 if is_double_character else 0)
    old_cost = submission["credit_cost"]
    cost_diff = new_cost - old_cost
    
    # Check if user has enough credits for increased cost
    if cost_diff > 0 and user["tier"] > 1 and user["credits"] < cost_diff:
        raise HTTPException(status_code=400, detail="Not enough credits for modifier changes")
    
    # Update submission
    submission["character_name"] = character_name
    submission["series"] = series
    submission["description"] = description
    submission["is_large_image_set"] = is_large_image_set
    submission["is_double_character"] = is_double_character
    submission["credit_cost"] = new_cost
    submission["updated_at"] = datetime.utcnow().isoformat()
    
    # Adjust credits
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
    
    # Refund credits
    if user["tier"] > 1:
        user["credits"] += submission["credit_cost"]
        if user["credits"] > user["max_credits"]:
            user["credits"] = user["max_credits"]
    
    # Mark as cancelled
    submission["status"] = "cancelled"
    submission["updated_at"] = datetime.utcnow().isoformat()
    
    # Remove from votes if in free queue
    if submission_id in VOTES:
        del VOTES[submission_id]
    
    return {"message": "Submission cancelled", "credits_refunded": submission["credit_cost"]}

@app.post("/api/submissions/{submission_id}/vote")
async def vote_submission(submission_id: int, user: dict = Depends(get_current_user)):
    """Vote for a tier 1 submission."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["queue_type"] != "free":
        raise HTTPException(status_code=400, detail="Can only vote on free queue submissions")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only vote on pending submissions")
    
    if submission["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot vote on your own submission")
    
    if user["votes_remaining"] <= 0:
        raise HTTPException(status_code=400, detail="No votes remaining")
    
    # Check if already voted
    vote_data = VOTES.get(submission_id, {"count": 0, "voters": []})
    if user["id"] in vote_data["voters"]:
        raise HTTPException(status_code=400, detail="Already voted on this submission")
    
    # Add vote
    vote_data["count"] += 1
    vote_data["voters"].append(user["id"])
    VOTES[submission_id] = vote_data
    
    submission["vote_count"] = vote_data["count"]
    user["votes_remaining"] -= 1
    
    return {"message": "Vote added", "new_vote_count": vote_data["count"], "votes_remaining": user["votes_remaining"]}

@app.delete("/api/submissions/{submission_id}/vote")
async def unvote_submission(submission_id: int, user: dict = Depends(get_current_user)):
    """Remove vote from a tier 1 submission."""
    submission = SUBMISSIONS.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    vote_data = VOTES.get(submission_id)
    if not vote_data or user["id"] not in vote_data["voters"]:
        raise HTTPException(status_code=400, detail="You haven't voted on this submission")
    
    # Remove vote
    vote_data["count"] -= 1
    vote_data["voters"].remove(user["id"])
    
    submission["vote_count"] = vote_data["count"]
    user["votes_remaining"] += 1
    
    return {"message": "Vote removed", "new_vote_count": vote_data["count"], "votes_remaining": user["votes_remaining"]}

@app.get("/api/submissions/autocomplete/series")
async def autocomplete_series(q: str):
    """Get series autocomplete - returns empty for now since no submissions exist yet."""
    series_list = list(set([s["series"] for s in SUBMISSIONS.values() if q.lower() in s["series"].lower()]))
    return {"series": series_list[:10]}

@app.get("/api/queue/paid")
async def get_paid_queue(user: dict = Depends(get_current_user)):
    paid = [s for s in SUBMISSIONS.values() if s["queue_type"] == "paid" and s["status"] == "pending"]
    paid.sort(key=lambda x: x["queue_position"])
    user_subs = [s for s in paid if s["user_id"] == user["id"]]
    
    # All submissions are now public - show all
    # Add is_own_submission flag
    for sub in paid:
        sub["is_own_submission"] = sub["user_id"] == user["id"]
    
    return {
        "queue_type": "paid",
        "total_submissions": len(paid),
        "user_position": user_subs[0]["queue_position"] if user_subs else None,
        "user_submissions": user_subs,
        "visible_submissions": paid,
    }

@app.get("/api/queue/free")
async def get_free_queue(user: dict = Depends(get_current_user)):
    free = [s for s in SUBMISSIONS.values() if s["queue_type"] == "free" and s["status"] == "pending"]
    free.sort(key=lambda x: (-x["vote_count"], x["submitted_at"]))
    user_subs = [s for s in free if s["user_id"] == user["id"]]
    
    # All submissions are now public - show all
    # Add is_own_submission flag
    for sub in free:
        sub["is_own_submission"] = sub["user_id"] == user["id"]
    
    return {
        "queue_type": "free",
        "total_submissions": len(free),
        "user_position": user_subs[0]["queue_position"] if user_subs else None,
        "user_submissions": user_subs,
        "visible_submissions": free,
    }

@app.get("/api/submissions/search")
async def search_submissions(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Search completed submissions by character name or series."""
    # All submissions are now public
    completed = [s for s in SUBMISSIONS.values() if s["status"] == "completed"]
    
    if q:
        q_lower = q.lower()
        completed = [s for s in completed if 
                    q_lower in s["character_name"].lower() or 
                    q_lower in s["series"].lower()]
    
    # Sort by completion date (newest first)
    completed.sort(key=lambda x: x["completed_at"] or "", reverse=True)
    
    return {"results": completed, "total": len(completed)}

@app.get("/api/admin/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    all_subs = list(SUBMISSIONS.values())
    pending = [s for s in all_subs if s["status"] == "pending"]
    in_progress = [s for s in all_subs if s["status"] == "in_progress"]
    completed = [s for s in all_subs if s["status"] == "completed"]
    
    # Get popular series from completed submissions
    series_counts = {}
    for sub in completed:
        series = sub["series"]
        series_counts[series] = series_counts.get(series, 0) + 1
    
    popular_series = sorted(series_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "paid_queue_size": len([s for s in pending if s["queue_type"] == "paid"]),
        "free_queue_size": len([s for s in pending if s["queue_type"] == "free"]),
        "total_pending": len(pending),
        "total_in_progress": len(in_progress),
        "total_completed": len(completed),
        "total_users": len(USERS),
        "active_users": len(set(s["user_id"] for s in all_subs if s["status"] in ["pending", "in_progress"])),
        "avg_completion_days": 7.0,
        "popular_series": [{"series": s, "count": c} for s, c in popular_series],
    }

@app.get("/")
async def root():
    return {"message": "Test Mode API", "users": len(USERS), "submissions": len(SUBMISSIONS)}

print(f"[SUCCESS] Test backend ready - {len(USERS)} users created")
