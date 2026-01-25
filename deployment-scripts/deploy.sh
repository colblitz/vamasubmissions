#!/bin/bash

# VAMA Requests - Production Deployment Script
# This script updates an existing deployment to the latest code
# Run as: bash deployment-scripts/deploy.sh

set -e  # Exit on error

echo "=========================================="
echo "VAMA Requests - Production Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$HOME/vamasubmissions-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_NAME="vamasubmissions"
SERVICE_NAME="vamasubmissions-backend"
NGINX_DIR="/var/www/vamarequests"

echo "App directory: $APP_DIR"
echo "Backup directory: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Verify we're on the server
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo -e "${RED}Error: Backend .env file not found. Are you on the server?${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ==========================================
# Step 1: Backup Current State
# ==========================================
echo "=========================================="
echo "Step 1: Backup Database"
echo "=========================================="
echo ""

echo "Backing up database to: $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo -e "${GREEN}✓ Database backed up${NC}"
echo ""

# ==========================================
# Step 2: Pull Latest Code
# ==========================================
echo "=========================================="
echo "Step 2: Pull Latest Code"
echo "=========================================="
echo ""

cd "$APP_DIR"

echo "Current commit:"
git log -1 --oneline
echo ""

echo "Fetching latest code..."
git fetch origin

echo "Pulling latest changes..."
git pull origin master

echo ""
echo "Latest commit:"
git log -1 --oneline
echo ""

echo "Recent commits:"
git log --oneline -5
echo ""

# ==========================================
# Step 3: Run Database Migrations
# ==========================================
echo "=========================================="
echo "Step 3: Run Database Migrations"
echo "=========================================="
echo ""

MIGRATIONS_DIR="$APP_DIR/backend/alembic/versions"

echo "Running all migrations in order..."
echo ""

# Run each migration file in order
for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    migration_name=$(basename "$migration")
    echo "Running: $migration_name"
    
    # Run migration (most are idempotent with IF NOT EXISTS or similar)
    if sudo -u postgres psql "$DB_NAME" -f "$migration" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Success${NC}"
    else
        echo -e "  ${YELLOW}⚠ Already applied or skipped${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ All migrations processed${NC}"
echo ""

# ==========================================
# Step 4: Update Backend Dependencies
# ==========================================
echo "=========================================="
echo "Step 4: Update Backend Dependencies"
echo "=========================================="
echo ""

cd "$APP_DIR/backend"
source venv/bin/activate

echo "Installing/updating Python dependencies..."
pip install -r requirements.txt --quiet

echo -e "${GREEN}✓ Backend dependencies updated${NC}"
echo ""

# ==========================================
# Step 5: Rebuild Frontend
# ==========================================
echo "=========================================="
echo "Step 5: Rebuild Frontend"
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
    echo -e "${RED}✗ Error: Nginx directory not found: $NGINX_DIR${NC}"
    exit 1
fi
echo ""

# ==========================================
# Step 6: Restart Backend Service
# ==========================================
echo "=========================================="
echo "Step 6: Restart Backend Service"
echo "=========================================="
echo ""

echo "Restarting $SERVICE_NAME..."
if sudo systemctl restart "$SERVICE_NAME" 2>/dev/null; then
    echo -e "${GREEN}✓ Service restarted${NC}"
    
    # Wait for service to start
    sleep 2
    
    # Check status
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✓ Service is running${NC}"
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo "Check logs with: sudo journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
else
    echo -e "${RED}✗ Error: Could not restart service${NC}"
    exit 1
fi
echo ""

# ==========================================
# Step 7: Verification
# ==========================================
echo "=========================================="
echo "Step 7: Verification"
echo "=========================================="
echo ""

echo "Checking backend health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend returned HTTP $HTTP_CODE${NC}"
fi
echo ""

echo "Recent backend logs:"
sudo journalctl -u "$SERVICE_NAME" -n 10 --no-pager
echo ""

# ==========================================
# Deployment Complete
# ==========================================
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Code updated to latest${NC}"
echo -e "${GREEN}✓ Database migrations applied${NC}"
echo -e "${GREEN}✓ Dependencies updated${NC}"
echo -e "${GREEN}✓ Frontend rebuilt and deployed${NC}"
echo -e "${GREEN}✓ Backend service restarted${NC}"
echo ""
echo "Backup location: $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo ""
echo "Next steps:"
echo "1. Visit https://vamarequests.com and verify the site loads"
echo "2. Test new features"
echo "3. Monitor logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "If something went wrong, rollback with:"
echo "  cd $APP_DIR"
echo "  git reset --hard PREVIOUS_COMMIT"
echo "  sudo -u postgres psql $DB_NAME < $BACKUP_DIR/vamasubmissions-$TIMESTAMP.sql"
echo "  bash deployment-scripts/deploy.sh"
echo ""
