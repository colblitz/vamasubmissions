#!/bin/bash

# ============================================
# VAMA Requests - Staging Deployment Script
# ============================================
#
# USAGE:
#   ssh deploy@YOUR_SERVER_IP
#   cd ~/vamasubmissions-staging
#   bash deployment-scripts/deploy-staging.sh
#
# WHAT IT DOES:
#   1. Pulls latest code from feature branch
#   2. Updates Python dependencies
#   3. Rebuilds frontend
#   4. Deploys frontend to /var/www/vamarequests-staging
#   5. Restarts staging backend service
#   6. Verifies deployment health
#
# NOTE: Does NOT run migrations or backup database
#       (staging shares database with production)
#
# ============================================

set -e  # Exit on error

echo "=========================================="
echo "VAMA Requests - Staging Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
STAGING_DIR="$HOME/vamasubmissions-staging"
STAGING_PORT=8001
SERVICE_NAME="vamasubmissions-backend-staging"
NGINX_DIR="/var/www/vamarequests-staging"
FEATURE_BRANCH="feature/postcard-redesign"
STAGING_DOMAIN="staging.vamarequests.com"

echo "Staging directory: $STAGING_DIR"
echo ""

# Verify we're in staging directory
if [ ! -d "$STAGING_DIR" ]; then
    echo -e "${RED}Error: Staging directory not found: $STAGING_DIR${NC}"
    echo "Run setup-staging.sh first to create staging environment."
    exit 1
fi

# ==========================================
# Step 1: Pull Latest Code
# ==========================================
echo "=========================================="
echo "Step 1: Pull Latest Code"
echo "=========================================="
echo ""

cd "$STAGING_DIR"

echo "Current commit:"
PREVIOUS_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
echo ""

echo "Fetching latest code..."
git fetch origin

echo ""
echo "Commits to be deployed:"
git log --oneline HEAD..origin/$FEATURE_BRANCH
echo ""

# Confirmation prompt
read -p "Do you want to proceed with staging deployment? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled by user${NC}"
    exit 0
fi

echo "Pulling latest changes from $FEATURE_BRANCH..."
git pull origin "$FEATURE_BRANCH"

echo ""
echo "New commit:"
NEW_COMMIT=$(git rev-parse HEAD)
git log -1 --oneline
echo ""

# ==========================================
# Step 2: Update Backend Dependencies
# ==========================================
echo "=========================================="
echo "Step 2: Update Backend Dependencies"
echo "=========================================="
echo ""

cd "$STAGING_DIR/backend"
source venv/bin/activate

echo "Installing/updating Python dependencies..."
pip install -r requirements.txt --quiet

echo -e "${GREEN}✓ Backend dependencies updated${NC}"
echo ""

# ==========================================
# Step 3: Rebuild Frontend
# ==========================================
echo "=========================================="
echo "Step 3: Rebuild Frontend"
echo "=========================================="
echo ""

cd "$STAGING_DIR/frontend"

echo "Installing frontend dependencies..."
npm install --silent

echo "Building production bundle for staging..."
VITE_API_URL="http://$STAGING_DOMAIN" npm run build

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
# Step 4: Restart Staging Service
# ==========================================
echo "=========================================="
echo "Step 4: Restart Staging Service"
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
# Step 5: Verification
# ==========================================
echo "=========================================="
echo "Step 5: Verification"
echo "=========================================="
echo ""

echo "Checking staging backend health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$STAGING_PORT/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Staging backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Staging backend returned HTTP $HTTP_CODE${NC}"
fi
echo ""

echo "Recent staging backend logs:"
sudo journalctl -u "$SERVICE_NAME" -n 10 --no-pager
echo ""

# ==========================================
# Deployment Complete
# ==========================================
echo "=========================================="
echo "Staging Deployment Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Code updated to latest${NC}"
echo -e "${GREEN}✓ Dependencies updated${NC}"
echo -e "${GREEN}✓ Frontend rebuilt and deployed${NC}"
echo -e "${GREEN}✓ Staging service restarted${NC}"
echo ""
echo "Deployed commits:"
git log --oneline $PREVIOUS_COMMIT..$NEW_COMMIT
echo ""
echo "Staging URL: http://$STAGING_DOMAIN"
echo ""
echo "Next steps:"
echo "1. Visit http://$STAGING_DOMAIN and test the changes"
echo "2. Monitor logs: sudo journalctl -u $SERVICE_NAME -f"
echo "3. If everything looks good, promote to production"
echo ""
echo "To promote to production:"
echo "  cd ~/vamasubmissions"
echo "  git checkout master"
echo "  git merge $FEATURE_BRANCH"
echo "  git push origin master"
echo "  bash deployment-scripts/deploy.sh"
echo ""
echo "If something went wrong, rollback with:"
echo "  cd $STAGING_DIR"
echo "  git reset --hard $PREVIOUS_COMMIT"
echo "  bash deployment-scripts/deploy-staging.sh"
echo ""
