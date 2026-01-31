#!/bin/bash

# ============================================
# VAMA Requests - Staging Environment Setup
# ============================================
#
# USAGE:
#   scp deployment-scripts/setup-staging.sh deploy@YOUR_SERVER_IP:~/
#   ssh deploy@YOUR_SERVER_IP
#   bash ~/setup-staging.sh
#
# WHAT IT DOES:
#   1. Clones production repo to ~/vamasubmissions-staging
#   2. Checks out feature/postcard-redesign branch
#   3. Copies and modifies .env for staging (port 8001)
#   4. Creates staging systemd service (port 8001)
#   5. Sets up nginx config for staging.vamarequests.com
#   6. Builds and deploys staging frontend
#   7. Starts staging backend service
#
# REQUIREMENTS:
#   - Production already set up at ~/vamasubmissions
#   - DNS: staging.vamarequests.com points to server IP
#   - Run as 'deploy' user (will use sudo for systemd/nginx)
#
# AFTER SETUP:
#   - Staging URL: https://staging.vamarequests.com (or http if no SSL)
#   - Backend: localhost:8001
#   - Frontend: /var/www/vamarequests-staging
#   - Service: vamasubmissions-backend-staging
#   - Uses same database as production (shares data)
#   - Uses same static files as production (shares thumbnails)
#
# TO UPDATE STAGING:
#   cd ~/vamasubmissions-staging
#   git fetch origin
#   git checkout feature/postcard-redesign
#   git pull origin feature/postcard-redesign
#   bash deployment-scripts/deploy-staging.sh
#
# TO REMOVE STAGING:
#   sudo systemctl stop vamasubmissions-backend-staging
#   sudo systemctl disable vamasubmissions-backend-staging
#   sudo rm /etc/systemd/system/vamasubmissions-backend-staging.service
#   sudo rm /etc/nginx/sites-enabled/staging.vamarequests.com
#   sudo rm /etc/nginx/sites-available/staging.vamarequests.com
#   sudo rm -rf /var/www/vamarequests-staging
#   rm -rf ~/vamasubmissions-staging
#   sudo systemctl daemon-reload
#   sudo systemctl reload nginx
#
# ============================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "VAMA Requests - Staging Setup"
echo "=========================================="
echo ""

# Configuration
PROD_DIR="$HOME/vamasubmissions"
STAGING_DIR="$HOME/vamasubmissions-staging"
STAGING_PORT=8001
STAGING_SERVICE="vamasubmissions-backend-staging"
STAGING_NGINX_DIR="/var/www/vamarequests-staging"
STAGING_DOMAIN="staging.vamarequests.com"
FEATURE_BRANCH="feature/postcard-redesign"

# Verify production exists
if [ ! -d "$PROD_DIR" ]; then
    echo -e "${RED}Error: Production directory not found: $PROD_DIR${NC}"
    echo "Please set up production first."
    exit 1
fi

# ==========================================
# Step 1: Clone Production to Staging
# ==========================================
echo "=========================================="
echo "Step 1: Clone Production to Staging"
echo "=========================================="
echo ""

if [ -d "$STAGING_DIR" ]; then
    echo -e "${YELLOW}Warning: Staging directory already exists: $STAGING_DIR${NC}"
    read -p "Remove and recreate? (yes/no): " -r
    echo ""
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        rm -rf "$STAGING_DIR"
    else
        echo "Using existing staging directory"
    fi
fi

if [ ! -d "$STAGING_DIR" ]; then
    echo "Cloning production to staging..."
    cp -r "$PROD_DIR" "$STAGING_DIR"
    echo -e "${GREEN}✓ Cloned to $STAGING_DIR${NC}"
else
    echo -e "${GREEN}✓ Using existing staging directory${NC}"
fi
echo ""

# ==========================================
# Step 2: Checkout Feature Branch
# ==========================================
echo "=========================================="
echo "Step 2: Checkout Feature Branch"
echo "=========================================="
echo ""

cd "$STAGING_DIR"

echo "Fetching latest branches..."
git fetch origin

echo "Checking out $FEATURE_BRANCH..."
if git checkout "$FEATURE_BRANCH" 2>/dev/null; then
    echo -e "${GREEN}✓ Checked out $FEATURE_BRANCH${NC}"
else
    echo -e "${RED}Error: Branch $FEATURE_BRANCH not found${NC}"
    echo "Available branches:"
    git branch -a
    exit 1
fi

echo ""
echo "Current commit:"
git log -1 --oneline
echo ""

# ==========================================
# Step 3: Configure Staging Environment
# ==========================================
echo "=========================================="
echo "Step 3: Configure Staging Environment"
echo "=========================================="
echo ""

cd "$STAGING_DIR/backend"

if [ -f "$PROD_DIR/backend/.env" ]; then
    echo "Copying .env from production..."
    cp "$PROD_DIR/backend/.env" .env
    
    echo "Updating .env for staging..."
    # Update frontend URL for staging (this is where OAuth redirects after login)
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://$STAGING_DOMAIN|g" .env
    
    # Also update PATREON_REDIRECT_URI to point to staging backend
    sed -i "s|PATREON_REDIRECT_URI=.*|PATREON_REDIRECT_URI=http://$STAGING_DOMAIN/api/auth/callback|g" .env
    
    echo ""
    echo "Staging .env configuration:"
    grep "FRONTEND_URL\|PATREON_REDIRECT_URI" .env
    echo ""
    
    echo -e "${GREEN}✓ Environment configured${NC}"
else
    echo -e "${RED}Error: Production .env not found${NC}"
    exit 1
fi
echo ""

# ==========================================
# Step 4: Create Staging Systemd Service
# ==========================================
echo "=========================================="
echo "Step 4: Create Staging Systemd Service"
echo "=========================================="
echo ""

echo "Creating systemd service file..."
sudo tee /etc/systemd/system/$STAGING_SERVICE.service > /dev/null << EOF
[Unit]
Description=VAMA Requests Backend (Staging)
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=$STAGING_DIR/backend
Environment="PATH=$STAGING_DIR/backend/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$STAGING_DIR/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $STAGING_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Enabling staging service..."
sudo systemctl enable $STAGING_SERVICE

echo -e "${GREEN}✓ Systemd service created${NC}"
echo ""

# ==========================================
# Step 5: Setup Nginx for Staging
# ==========================================
echo "=========================================="
echo "Step 5: Setup Nginx for Staging"
echo "=========================================="
echo ""

echo "Creating staging nginx directory..."
sudo mkdir -p "$STAGING_NGINX_DIR"
sudo chown deploy:deploy "$STAGING_NGINX_DIR"

echo "Creating nginx config..."
sudo tee /etc/nginx/sites-available/$STAGING_DOMAIN > /dev/null << 'EOF'
server {
    listen 80;
    server_name staging.vamarequests.com;

    # Frontend (React app)
    root /var/www/vamarequests-staging;
    index index.html;

    # Serve frontend files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to staging backend
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy static files to staging backend
    location /static {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
EOF

echo "Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/$STAGING_DOMAIN /etc/nginx/sites-enabled/

echo "Testing nginx config..."
if sudo nginx -t; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configured${NC}"
else
    echo -e "${RED}✗ Nginx config test failed${NC}"
    exit 1
fi
echo ""

# ==========================================
# Step 6: Install Dependencies
# ==========================================
echo "=========================================="
echo "Step 6: Install Dependencies"
echo "=========================================="
echo ""

cd "$STAGING_DIR/backend"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt --quiet

echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# ==========================================
# Step 7: Build and Deploy Frontend
# ==========================================
echo "=========================================="
echo "Step 7: Build and Deploy Frontend"
echo "=========================================="
echo ""

cd "$STAGING_DIR/frontend"

echo "Installing frontend dependencies..."
npm install --silent

echo "Building production bundle..."
# Update API URL for staging
VITE_API_URL="http://$STAGING_DOMAIN" npm run build

echo "Deploying to nginx..."
sudo rm -rf "$STAGING_NGINX_DIR"/*
sudo cp -r dist/* "$STAGING_NGINX_DIR/"

echo -e "${GREEN}✓ Frontend deployed${NC}"
echo ""

# ==========================================
# Step 8: Start Staging Service
# ==========================================
echo "=========================================="
echo "Step 8: Start Staging Service"
echo "=========================================="
echo ""

echo "Starting $STAGING_SERVICE..."
sudo systemctl start $STAGING_SERVICE

sleep 2

if sudo systemctl is-active --quiet $STAGING_SERVICE; then
    echo -e "${GREEN}✓ Staging service is running${NC}"
else
    echo -e "${RED}✗ Staging service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u $STAGING_SERVICE -n 50"
    exit 1
fi
echo ""

# ==========================================
# Step 9: Verification
# ==========================================
echo "=========================================="
echo "Step 9: Verification"
echo "=========================================="
echo ""

echo "Checking staging backend health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$STAGING_PORT/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Staging backend is responding on port $STAGING_PORT${NC}"
else
    echo -e "${YELLOW}⚠ Staging backend returned HTTP $HTTP_CODE${NC}"
fi
echo ""

# ==========================================
# Setup Complete
# ==========================================
echo "=========================================="
echo "Staging Environment Setup Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Staging directory: $STAGING_DIR${NC}"
echo -e "${GREEN}✓ Backend service: $STAGING_SERVICE (port $STAGING_PORT)${NC}"
echo -e "${GREEN}✓ Frontend: $STAGING_NGINX_DIR${NC}"
echo -e "${GREEN}✓ Branch: $FEATURE_BRANCH${NC}"
echo ""
echo "Access staging at: http://$STAGING_DOMAIN"
echo "(or http://YOUR_SERVER_IP if DNS not set up yet)"
echo ""
echo -e "${YELLOW}IMPORTANT - OAuth Setup:${NC}"
echo "To use real Patreon login on staging, add this redirect URI to your Patreon app:"
echo "  http://$STAGING_DOMAIN/api/auth/callback"
echo ""
echo "OR use mock auth for testing (no Patreon setup needed):"
echo "  http://$STAGING_DOMAIN/api/auth/login?username=testuser"
echo ""
echo "Useful commands:"
echo "  View logs: sudo journalctl -u $STAGING_SERVICE -f"
echo "  Restart: sudo systemctl restart $STAGING_SERVICE"
echo "  Status: sudo systemctl status $STAGING_SERVICE"
echo ""
echo "To update staging with new changes:"
echo "  cd $STAGING_DIR"
echo "  git fetch origin"
echo "  git checkout $FEATURE_BRANCH"
echo "  git pull origin $FEATURE_BRANCH"
echo "  bash deployment-scripts/deploy-staging.sh"
echo ""
echo "To promote staging to production:"
echo "  1. Test thoroughly on staging"
echo "  2. Merge feature branch to master locally"
echo "  3. Push to origin/master"
echo "  4. Run production deployment script"
echo ""
