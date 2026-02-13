"""
Script to populate local database with test data for development.

Creates:
- 1 test user (admin role)
- 10 test posts with random thumbnails
- 10 test edit submissions (mix of pending/approved/rejected)
- ~11 test edit history entries (includes REJECTED entries)

Note: Edit history includes both approved (ADD/DELETE) and rejected (REJECTED) entries,
mirroring the actual application behavior.
"""

import os
import sys
import random
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User, Post, PostEdit, EditHistory
from app.core.database import Base

# Database URL - load from .env file
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql:///vamasubmissions")

# Test thumbnails directory
THUMBNAILS_DIR = Path(__file__).parent.parent / "static" / "test_thumbnails"


def get_random_thumbnails(count: int = 1) -> list:
    """Get random thumbnail filenames from test_thumbnails directory."""
    if not THUMBNAILS_DIR.exists():
        print(f"Warning: Thumbnails directory not found: {THUMBNAILS_DIR}")
        return []
    
    thumbnails = [f.name for f in THUMBNAILS_DIR.iterdir() if f.is_file()]
    if not thumbnails:
        return []
    
    selected = random.sample(thumbnails, min(count, len(thumbnails)))
    return [f"/static/test_thumbnails/{name}" for name in selected]


def create_test_user(session) -> User:
    """Create a test user with admin role."""
    # Check if test user already exists
    existing = session.query(User).filter(User.patreon_id == "test_admin_001").first()
    if existing:
        print(f"Test user already exists (ID: {existing.id})")
        return existing
    
    user = User(
        patreon_id="test_admin_001",
        patreon_username="test_admin",
        tier_id="test_tier_001",
        campaign_id="test_campaign_001",
        patron_status="active_patron",
        role="admin",
        last_login=datetime.now()
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    print(f"Created test user (ID: {user.id})")
    return user


def create_test_posts(session, count: int = 10) -> list:
    """Create test posts with random data."""
    posts = []
    statuses = ["published", "published", "published", "published", "published", 
                "published", "published", "published", "pending", "skipped"]  # 80/10/10 split
    
    characters_pool = [
        ["Ahri"],
        ["Ahri", "Akali"],
        ["Sakura"],
        ["Sakura", "Sasuke"],
        ["Luffy"],
        ["Nami", "Robin"],
        ["Mikasa"],
        ["Asuna"],
        ["Zero Two"],
        ["Rem", "Ram"]
    ]
    
    series_pool = [
        ["League of Legends"],
        ["Naruto"],
        ["One Piece"],
        ["Attack on Titan"],
        ["Sword Art Online"],
        ["Darling in the Franxx"],
        ["Re:Zero"],
        ["KDA"],
        ["Fate"],
        ["Genshin Impact"]
    ]
    
    tags_pool = [
        ["solo", "portrait"],
        ["duo", "yuri"],
        ["group", "action"],
        ["solo", "sfw"],
        ["duo", "nsfw"],
        ["solo", "casual"],
        ["group", "combat"],
        ["solo", "swimsuit"],
        ["duo", "bondage"],
        ["group", "story"]
    ]
    
    existing_count = session.query(Post).count()
    
    for i in range(count):
        post_num = existing_count + i + 1
        thumbnails = get_random_thumbnails(random.randint(1, 3))
        
        post = Post(
            post_id=f"test_post_{post_num:04d}",
            timestamp=datetime.now() - timedelta(days=random.randint(1, 365)),
            patreon_url=f"https://www.patreon.com/posts/test-post-{post_num}",
            title=f"Test Post {post_num} - {random.choice(['Ahri', 'Sakura', 'Luffy', 'Mikasa'])} {random.choice(['Portrait', 'Action', 'Casual', 'Special'])}",
            characters=random.choice(characters_pool),
            series=random.choice(series_pool),
            tags=random.choice(tags_pool),
            thumbnail_url=thumbnails[0] if thumbnails else None,
            thumbnail_urls=thumbnails,
            status=statuses[i % len(statuses)]
        )
        session.add(post)
        posts.append(post)
    
    session.commit()
    for post in posts:
        session.refresh(post)
    
    print(f"Created {len(posts)} test posts")
    return posts


def create_test_edits(session, posts: list, test_user: User, count: int = 10) -> list:
    """Create test edit submissions with various statuses."""
    edits = []
    
    # Distribution: 4 pending, 3 approved, 3 rejected
    statuses = ["pending", "pending", "pending", "pending", 
                "approved", "approved", "approved",
                "rejected", "rejected", "rejected"]
    
    fields = ["characters", "characters", "series", "series", "tags", "tags", "tags", "tags", "tags", "tags"]
    actions = ["ADD", "DELETE"]
    
    values_map = {
        "characters": ["New Character", "Missing Hero", "Side Character", "Villain", "Protagonist"],
        "series": ["New Series", "Missing Anime", "Spin-off", "OVA", "Movie"],
        "tags": ["uncensored", "bondage", "casual", "combat", "sfw", "nsfw", "portrait", "group"]
    }
    
    for i in range(count):
        post = posts[i % len(posts)]
        field = fields[i % len(fields)]
        action = actions[i % 2]
        value = random.choice(values_map[field])
        status = statuses[i % len(statuses)]
        
        edit = PostEdit(
            post_id=post.id,
            suggester_id=test_user.id,
            field_name=field,
            action=action,
            value=value,
            status=status,
            approver_id=test_user.id if status != "pending" else None,
            approved_at=datetime.now() if status != "pending" else None
        )
        session.add(edit)
        edits.append(edit)
    
    session.commit()
    for edit in edits:
        session.refresh(edit)
    
    pending_count = sum(1 for e in edits if e.status == "pending")
    approved_count = sum(1 for e in edits if e.status == "approved")
    rejected_count = sum(1 for e in edits if e.status == "rejected")
    
    print(f"Created {len(edits)} test edits ({pending_count} pending, {approved_count} approved, {rejected_count} rejected)")
    return edits


def create_test_edit_history(session, edits: list, test_user: User) -> list:
    """Create test edit history entries corresponding to approved/rejected edits."""
    history_entries = []
    
    # Create history entries for approved and rejected edits (matching the actual application behavior)
    # Pending edits don't create history entries
    non_pending_edits = [e for e in edits if e.status in ("approved", "rejected")]
    
    for edit in non_pending_edits:
        # For rejected edits, action is "REJECTED"; for approved, use the original action
        history_action = "REJECTED" if edit.status == "rejected" else edit.action
        
        entry = EditHistory(
            post_id=edit.post_id,
            suggester_id=edit.suggester_id,
            approver_id=edit.approver_id,
            field_name=edit.field_name,
            action=history_action,
            value=edit.value,
            applied_at=edit.approved_at or datetime.now()
        )
        session.add(entry)
        history_entries.append(entry)
    
    # Add some additional standalone history entries for variety
    fields = ["characters", "series", "tags"]
    actions = ["ADD", "DELETE"]
    
    values_map = {
        "characters": ["Ahri", "Sakura", "Luffy", "Mikasa", "Asuna"],
        "series": ["League of Legends", "Naruto", "One Piece", "Attack on Titan", "Sword Art Online"],
        "tags": ["solo", "duo", "group", "portrait", "action"]
    }
    
    # Add 5 more standalone history entries
    for i in range(5):
        post = random.choice(edits).post if edits else None
        if not post:
            continue
            
        field = random.choice(fields)
        action = random.choice(actions)
        value = random.choice(values_map[field])
        
        entry = EditHistory(
            post_id=post.id,
            suggester_id=test_user.id,
            approver_id=test_user.id,
            field_name=field,
            action=action,
            value=value,
            applied_at=datetime.now() - timedelta(days=random.randint(1, 30))
        )
        session.add(entry)
        history_entries.append(entry)
    
    session.commit()
    for entry in history_entries:
        session.refresh(entry)
    
    rejected_count = sum(1 for e in history_entries if e.action == "REJECTED")
    approved_count = len(history_entries) - rejected_count
    
    print(f"Created {len(history_entries)} test edit history entries ({approved_count} applied, {rejected_count} rejected)")
    return history_entries


def main():
    """Main function to populate database with test data."""
    print("=" * 60)
    print("VAMA Test Data Population Script")
    print("=" * 60)
    print(f"Database: {DATABASE_URL}")
    print(f"Thumbnails directory: {THUMBNAILS_DIR}")
    print()
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        # Create test user
        test_user = create_test_user(session)
        
        # Create test posts
        posts = create_test_posts(session, count=10)
        
        # Create test edits
        edits = create_test_edits(session, posts, test_user, count=10)
        
        # Create test edit history
        history = create_test_edit_history(session, edits, test_user)
        
        print()
        print("=" * 60)
        print("Test data population complete!")
        print("=" * 60)
        print(f"Test User ID: {test_user.id}")
        print(f"Created {len(posts)} posts, {len(edits)} edits, {len(history)} history entries")
        print()
        print("You can now test with your actual Patreon admin user.")
        print("The test user is available for reference/testing purposes.")
        
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
