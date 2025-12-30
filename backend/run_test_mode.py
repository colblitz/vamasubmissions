"""
Run the backend in test mode without requiring PostgreSQL or Patreon OAuth.

This creates an in-memory mock database and mocks external API calls.

Usage:
    python run_test_mode.py
"""
import os
import sys

# Set test mode environment variable
os.environ["TEST_MODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"  # In-memory SQLite
os.environ["SECRET_KEY"] = "test-secret-key-for-development-only"
os.environ["PATREON_CLIENT_ID"] = "mock_client_id"
os.environ["PATREON_CLIENT_SECRET"] = "mock_client_secret"
os.environ["PATREON_REDIRECT_URI"] = "http://localhost:8000/api/auth/callback"
os.environ["PATREON_CREATOR_ID"] = "mock_creator"
os.environ["UPLOAD_DIR"] = "./test_uploads"
os.environ["FRONTEND_URL"] = "http://localhost:5173"

# Create test uploads directory
os.makedirs("./test_uploads", exist_ok=True)

print("[INFO] Starting backend in TEST MODE")
print("[INFO] No PostgreSQL or Patreon OAuth required")
print("[INFO] Using in-memory database with mock data")
print("[INFO] API will be available at http://localhost:8000")
print("[INFO] API docs at http://localhost:8000/docs")
print()

# Import and run the app
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main_test_simple_v2:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
