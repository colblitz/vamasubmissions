#!/bin/bash
# Application Deployment Script
# Run as DEPLOY user
# Usage: bash 03-deploy-application.sh

set -e

echo "=== Application Deployment ==="
echo ""

# Prompt for configuration
read -p "Enter your domain (e.g., mysite.com): " DOMAIN
read -p "Enter your GitHub repository URL: " REPO_URL
read -p "Enter Patreon Client ID: " PATREON_CLIENT_ID
read -sp "Enter Patreon Client Secret: " PATREON_CLIENT_SECRET
echo ""

# Get database password
if [ -f ~/deployment-config/db_password.txt ]; then
    DB_PASSWORD=$(cat ~/deployment-config/db_password.txt)
else
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
fi

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo ""
echo "[1/8] Cloning repository..."
cd /home/deploy
if [ -d "vamasubmissions" ]; then
    echo "Repository already exists, pulling latest..."
    cd vamasubmissions
    git pull
else
    git clone "$REPO_URL" vamasubmissions
    cd vamasubmissions
fi

echo "[2/8] Setting up backend environment..."
cd /home/deploy/vamasubmissions/backend

# Create .env file
cat > .env << EOF
# Database
DATABASE_URL=postgresql://patreon_user:$DB_PASSWORD@localhost/patreon_submissions

# Patreon OAuth
PATREON_CLIENT_ID=$PATREON_CLIENT_ID
PATREON_CLIENT_SECRET=$PATREON_CLIENT_SECRET
PATREON_REDIRECT_URI=https://$DOMAIN/auth/callback

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Environment
ENVIRONMENT=production

# CORS
FRONTEND_URL=https://$DOMAIN

# File Upload
UPLOAD_DIR=/home/deploy/vamasubmissions/uploads
MAX_FILE_SIZE=10485760

# Tier Configuration (update these with your Patreon tier IDs)
TIER_1_ID=your_tier_1_id
TIER_2_ID=your_tier_2_id
TIER_3_ID=your_tier_3_id
TIER_4_ID=your_tier_4_id
EOF

chmod 600 .env

echo "[3/8] Installing Python dependencies..."
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "[4/8] Running database migrations..."
# Check if alembic is initialized
if [ ! -d "alembic" ]; then
    echo "Initializing Alembic..."
    alembic init alembic
fi
alembic upgrade head || echo "Warning: Migration failed, continuing..."

echo "[5/8] Creating upload directory..."
mkdir -p /home/deploy/vamasubmissions/uploads
chmod 755 /home/deploy/vamasubmissions/uploads

echo "[6/8] Setting up frontend environment..."
cd /home/deploy/vamasubmissions/frontend

cat > .env.production << EOF
VITE_API_URL=https://api.$DOMAIN
EOF

echo "[7/8] Building frontend..."
npm install
npm run build

echo "[8/8] Deploying frontend to web root..."
sudo mkdir -p /var/www/patreon-submissions
sudo cp -r dist/* /var/www/patreon-submissions/
sudo chown -R www-data:www-data /var/www/patreon-submissions

echo ""
echo "=== Application Deployment Complete! ==="
echo ""
echo "Configuration saved:"
echo "  - Backend .env: /home/deploy/vamasubmissions/backend/.env"
echo "  - Frontend .env: /home/deploy/vamasubmissions/frontend/.env.production"
echo "  - JWT Secret: $JWT_SECRET (saved in .env)"
echo ""
echo "IMPORTANT: Update your Patreon tier IDs in backend/.env"
echo ""
echo "Next steps:"
echo "1. Run: bash 04-setup-services.sh"
echo ""
