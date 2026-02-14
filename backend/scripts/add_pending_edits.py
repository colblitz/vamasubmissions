"""
Script to add more pending test edits for iteration testing.
"""

import os
import random
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Post, PostEdit, User

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql:///vamasubmissions")


def create_additional_pending_edits(session, count: int = 10) -> list:
    """Create additional pending edit submissions."""
    edits = []

    # Get the test user
    test_user = session.query(User).filter(User.patreon_id == "test_admin_001").first()
    if not test_user:
        print("Test user not found! Please run populate_test_data.py first.")
        return []

    # Get all posts (including existing test posts)
    posts = session.query(Post).all()
    if not posts:
        print("No posts found! Please run populate_test_data.py first.")
        return []

    fields = ["characters", "series", "tags"]
    actions = ["ADD", "DELETE"]

    values_map = {
        "characters": [
            "Test Character A",
            "Test Character B",
            "Iteration Hero",
            "Debug Villain",
            "QA Protagonist",
        ],
        "series": [
            "Test Series X",
            "Iteration Anime",
            "Debug Show",
            "QA Manga",
            "Testing Universe",
        ],
        "tags": ["iteration", "testing", "debug", "qa", "wip", "review", "wip", "wip"],
    }

    existing_count = session.query(PostEdit).count()

    for i in range(count):
        post = random.choice(posts)
        field = random.choice(fields)
        action = random.choice(actions)
        value = random.choice(values_map[field])

        edit = PostEdit(
            post_id=post.id,
            suggester_id=test_user.id,
            field_name=field,
            action=action,
            value=f"{value}_{existing_count + i + 1}",  # Make unique
            status="pending",
            approver_id=None,
            approved_at=None,
        )
        session.add(edit)
        edits.append(edit)

    session.commit()
    for edit in edits:
        session.refresh(edit)

    print(f"Created {len(edits)} additional pending edits")
    return edits


def main():
    """Main function to add more pending edits."""
    print("=" * 60)
    print("Add More Pending Test Edits")
    print("=" * 60)
    print(f"Database: {DATABASE_URL}")
    print()

    # Create engine and session
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()

    try:
        # Create additional pending edits
        edits = create_additional_pending_edits(session, count=10)

        print()
        print("=" * 60)
        print("Additional pending edits created!")
        print("=" * 60)
        print(f"Added {len(edits)} pending edits for iteration testing")

    except Exception as e:
        print(f"Error: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
