#!/bin/bash

# Setup Environment Files for Production
# This script helps you configure the .env files interactively

set -e

echo "=========================================="
echo "Environment Files Setup"
echo "=========================================="
echo ""

# Generate SECRET_KEY
echo "Generating SECRET_KEY..."
SECRET_KEY=$(openssl rand -hex 32)
echo "✓ Generated: $SECRET_KEY"
echo ""

# Prompt for values
echo "Please provide the following values:"
echo ""

read -p "PostgreSQL password: " POSTGRES_PASSWORD
read -p "Patreon Client ID: " PATREON_CLIENT_ID
read -p "Patreon Client Secret: " PATREON_CLIENT_SECRET
read -p "Patreon Creator ID: " PATREON_CREATOR_ID
read -p "Your Patreon User ID (leave blank if you don't have it yet): " ADMIN_PATREON_ID

echo ""
echo "Creating backend/.env..."

cat > backend/.env << EOF
# Backend .env for Production
# Generated: $(date)

# Database
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@localhost/vamasubmissions

# Patreon OAuth
PATREON_CLIENT_ID=${PATREON_CLIENT_ID}
PATREON_CLIENT_SECRET=${PATREON_CLIENT_SECRET}
PATREON_REDIRECT_URI=https://vamarequests.com/api/auth/callback
PATREON_CREATOR_ID=${PATREON_CREATOR_ID}

# Admin Access
ADMIN_PATREON_ID=${ADMIN_PATREON_ID}

# Security
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# Application
ENVIRONMENT=production
FRONTEND_URL=https://vamarequests.com

# File Uploads
UPLOAD_DIR=./uploads
MAX_IMAGE_SIZE_MB=10
MAX_IMAGES_PER_SUBMISSION=20
EOF

echo "✓ Created backend/.env"
echo ""

echo "Creating frontend/.env..."

cat > frontend/.env << EOF
# Frontend .env for Production
# Generated: $(date)

VITE_API_URL=https://vamarequests.com
VITE_USE_MOCK_AUTH=false
EOF

echo "✓ Created frontend/.env"
echo ""

echo "=========================================="
echo "Environment Files Created!"
echo "=========================================="
echo ""
echo "Files created:"
echo "  - backend/.env"
echo "  - frontend/.env"
echo ""
echo "SECRET_KEY: $SECRET_KEY"
echo ""

if [ -z "$ADMIN_PATREON_ID" ]; then
    echo "⚠ Note: ADMIN_PATREON_ID is not set yet."
    echo "After your first login, get it with:"
    echo "  sudo -u postgres psql vamasubmissions -c \"SELECT patreon_id FROM users WHERE email = 'colblitz@gmail.com';\""
    echo "Then update backend/.env with the value."
    echo ""
fi

echo "Next steps:"
echo "  1. Verify the .env files"
echo "  2. Continue with deployment"
echo ""
