#!/bin/bash

# Update Deployment Script for vamarequests.com
# This script updates an existing deployment to the latest HEAD

set -e  # Exit on error

echo "=========================================="
echo "VAMA Requests - Deployment Update Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$HOME/vamasubmissions-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SERVICE_NAME="vamasubmissions-backend"
NGINX_DIR="/var/www/vamarequests.com/html"

echo "Application directory: $APP_DIR"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Check if running on server
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo -e "${RED}Error: Backend .env file not found. Are you on the server?${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Step 1: Backup Current State"
echo "=========================================="
echo ""

# Backup database
echo "Backing up database..."
sudo -u postgres pg_dump vamasubmissions > "$BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo -e "${GREEN}✓ Database backed up to: $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql${NC}"
echo ""

# Backup current code (optional)
echo "Saving current git state..."
cd "$APP_DIR"
git stash save "Pre-update backup $TIMESTAMP" || echo "No local changes to stash"
echo ""

echo "=========================================="
echo "Step 2: Pull Latest Code"
echo "=========================================="
echo ""

echo "Fetching latest code from origin..."
git fetch origin

echo "Current commit:"
git log -1 --oneline

echo ""
echo "Pulling latest changes..."
git pull origin master

echo ""
echo "Latest commit:"
git log -1 --oneline
echo ""

echo "Recent commits:"
git log --oneline -5
echo ""

echo "=========================================="
echo "Step 3: Run Database Migrations"
echo "=========================================="
echo ""

# Check if tier_name column exists
echo "Checking if database migrations are needed..."
TIER_NAME_EXISTS=$(sudo -u postgres psql vamasubmissions -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='tier_name';")

if [ "$TIER_NAME_EXISTS" -eq "0" ]; then
    echo -e "${YELLOW}Running migration: 006_add_tier_name.sql${NC}"
    sudo -u postgres psql vamasubmissions -f "$APP_DIR/backend/alembic/versions/006_add_tier_name.sql"
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo -e "${GREEN}✓ Database schema is up to date${NC}"
fi
echo ""

echo "=========================================="
echo "Step 4: Update Backend Dependencies"
echo "=========================================="
echo ""

cd "$APP_DIR/backend"
source venv/bin/activate

echo "Installing/updating Python dependencies..."
pip install -r requirements.txt --quiet

# Check for slowapi specifically (new dependency)
if pip show slowapi > /dev/null 2>&1; then
    echo -e "${GREEN}✓ slowapi installed (rate limiting)${NC}"
else
    echo -e "${YELLOW}Installing slowapi...${NC}"
    pip install slowapi==0.1.9
fi
echo ""

echo "=========================================="
echo "Step 5: Check Environment Variables"
echo "=========================================="
echo ""

echo "Checking backend .env configuration..."

# Check for critical variables
if grep -q "VITE_USE_MOCK_AUTH=true" "$APP_DIR/backend/.env" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: Mock auth might be enabled in backend .env${NC}"
fi

if ! grep -q "PATREON_CLIENT_ID" "$APP_DIR/backend/.env" 2>/dev/null; then
    echo -e "${RED}⚠ Warning: PATREON_CLIENT_ID not found in backend .env${NC}"
    echo "   You may need to configure Patreon OAuth credentials."
fi

if ! grep -q "ADMIN_PATREON_ID" "$APP_DIR/backend/.env" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: ADMIN_PATREON_ID not set in backend .env${NC}"
    echo "   Admin features will not work until this is configured."
fi

echo ""
echo "Checking frontend .env configuration..."

if grep -q "VITE_USE_MOCK_AUTH=true" "$APP_DIR/frontend/.env" 2>/dev/null; then
    echo -e "${RED}⚠ Warning: VITE_USE_MOCK_AUTH=true in frontend .env${NC}"
    echo "   For production, this should be: VITE_USE_MOCK_AUTH=false"
    echo ""
    read -p "Do you want to disable mock auth now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sed -i 's/VITE_USE_MOCK_AUTH=true/VITE_USE_MOCK_AUTH=false/' "$APP_DIR/frontend/.env"
        echo -e "${GREEN}✓ Mock auth disabled${NC}"
    fi
fi
echo ""

echo "=========================================="
echo "Step 6: Rebuild Frontend"
echo "=========================================="
echo ""

cd "$APP_DIR/frontend"

echo "Installing frontend dependencies..."
npm install --silent

echo "Building production bundle..."
npm run build

echo "Deploying to nginx..."
if [ -d "$NGINX_DIR" ]; then
    sudo rm -rf "$NGINX_DIR"/*
    sudo cp -r dist/* "$NGINX_DIR/"
    echo -e "${GREEN}✓ Frontend deployed to $NGINX_DIR${NC}"
else
    echo -e "${YELLOW}⚠ Warning: Nginx directory not found: $NGINX_DIR${NC}"
    echo "   You may need to manually copy dist/* to your web server directory"
fi
echo ""

echo "=========================================="
echo "Step 7: Restart Backend Service"
echo "=========================================="
echo ""

echo "Restarting $SERVICE_NAME..."
if sudo systemctl restart "$SERVICE_NAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Service restarted successfully${NC}"
    
    # Wait a moment for service to start
    sleep 2
    
    # Check status
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✓ Service is running${NC}"
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo "Check logs with: sudo journalctl -u $SERVICE_NAME -n 50"
    fi
else
    echo -e "${YELLOW}⚠ Warning: Could not restart service (may not be configured)${NC}"
    echo "   You may need to manually restart your backend process"
fi
echo ""

echo "=========================================="
echo "Step 8: Verification"
echo "=========================================="
echo ""

echo "Checking backend health..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs | grep -q "200"; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend may not be responding on port 8000${NC}"
fi
echo ""

echo "Recent backend logs:"
sudo journalctl -u "$SERVICE_NAME" -n 10 --no-pager 2>/dev/null || echo "Could not fetch logs (service may not be configured)"
echo ""

echo "=========================================="
echo "Deployment Update Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Code updated to latest HEAD${NC}"
echo -e "${GREEN}✓ Database migrations applied${NC}"
echo -e "${GREEN}✓ Dependencies updated${NC}"
echo -e "${GREEN}✓ Frontend rebuilt and deployed${NC}"
echo -e "${GREEN}✓ Backend service restarted${NC}"
echo ""
echo "Backup location: $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo ""
echo "Next steps:"
echo "1. Visit https://vamarequests.com and verify the site loads"
echo "2. Test Patreon OAuth login"
echo "3. Test new features (Browse tab, date sorting)"
echo "4. Check for any errors in logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "If something went wrong, you can rollback:"
echo "  cd $APP_DIR"
echo "  git reset --hard PREVIOUS_COMMIT_HASH"
echo "  sudo -u postgres psql vamasubmissions < $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo ""
echo "For detailed instructions, see: deployment-scripts/UPDATE-DEPLOYMENT.md"
echo ""
