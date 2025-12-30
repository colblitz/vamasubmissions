"""Test mode utilities for running backend without external dependencies."""
import os
from typing import Optional

# Check if test mode is enabled
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"


def is_test_mode() -> bool:
    """Check if application is running in test mode."""
    return TEST_MODE


class MockDatabase:
    """Mock database for test mode."""
    
    def __init__(self):
        self.users = {}
        self.submissions = {}
        self.images = {}
        self.votes = {}
        self.sessions = {}
        self._user_id_counter = 1
        self._submission_id_counter = 1
        
        # Create mock users
        self._create_mock_users()
    
    def _create_mock_users(self):
        """Create mock users for testing."""
        from datetime import datetime
        
        mock_users = [
            {
                "id": 1,
                "patreon_id": "mock_tier1",
                "patreon_username": "Tier1User",
                "email": "tier1@example.com",
                "tier": 1,
                "credits": 0,
                "role": "patron",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
            {
                "id": 2,
                "patreon_id": "mock_tier2",
                "patreon_username": "Tier2User",
                "email": "tier2@example.com",
                "tier": 2,
                "credits": 2,
                "role": "patron",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
            {
                "id": 3,
                "patreon_id": "mock_tier3",
                "patreon_username": "Tier3User",
                "email": "tier3@example.com",
                "tier": 3,
                "credits": 4,
                "role": "patron",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
            {
                "id": 4,
                "patreon_id": "mock_tier4",
                "patreon_username": "Tier4User",
                "email": "tier4@example.com",
                "tier": 4,
                "credits": 8,
                "role": "patron",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
            {
                "id": 5,
                "patreon_id": "mock_admin",
                "patreon_username": "AdminUser",
                "email": "admin@example.com",
                "tier": 4,
                "credits": 8,
                "role": "admin",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
            {
                "id": 6,
                "patreon_id": "mock_creator",
                "patreon_username": "CreatorUser",
                "email": "creator@example.com",
                "tier": 4,
                "credits": 8,
                "role": "creator",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            },
        ]
        
        for user in mock_users:
            self.users[user["id"]] = user
    
    def get_user_by_id(self, user_id: int):
        """Get user by ID."""
        return self.users.get(user_id)
    
    def get_user_by_patreon_id(self, patreon_id: str):
        """Get user by Patreon ID."""
        for user in self.users.values():
            if user["patreon_id"] == patreon_id:
                return user
        return None
    
    def create_submission(self, user_id: int, data: dict):
        """Create a submission."""
        from datetime import datetime
        
        submission_id = self._submission_id_counter
        self._submission_id_counter += 1
        
        submission = {
            "id": submission_id,
            "user_id": user_id,
            "character_name": data.get("character_name"),
            "series": data.get("series"),
            "description": data.get("description"),
            "is_public": data.get("is_public", False),
            "is_large_image_set": data.get("is_large_image_set", False),
            "is_double_character": data.get("is_double_character", False),
            "status": "pending",
            "queue_type": "paid" if self.users[user_id]["tier"] > 1 else "free",
            "queue_position": len([s for s in self.submissions.values() if s["status"] == "pending"]) + 1,
            "vote_count": 0,
            "submitted_at": datetime.utcnow(),
            "credit_cost": 1 + (1 if data.get("is_large_image_set") else 0) + (1 if data.get("is_double_character") else 0),
            "images": [],
        }
        
        self.submissions[submission_id] = submission
        return submission
    
    def get_submissions_by_user(self, user_id: int):
        """Get all submissions for a user."""
        return [s for s in self.submissions.values() if s["user_id"] == user_id]
    
    def get_submission_by_id(self, submission_id: int):
        """Get submission by ID."""
        return self.submissions.get(submission_id)


# Global mock database instance
_mock_db: Optional[MockDatabase] = None


def get_mock_db() -> MockDatabase:
    """Get or create mock database instance."""
    global _mock_db
    if _mock_db is None:
        _mock_db = MockDatabase()
    return _mock_db
