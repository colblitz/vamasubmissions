#!/bin/bash
# Start the backend server with all required environment variables

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Activate virtual environment
source venv/bin/activate

# Start the server
echo "🚀 Starting backend server..."
echo "📍 API will be available at: http://localhost:8000"
echo "📚 API docs at: http://localhost:8000/docs"
echo "🔐 OAuth login at: http://localhost:8000/api/auth/login"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
