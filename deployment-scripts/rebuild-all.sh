#!/bin/bash
# Rebuild both frontend and backend

set -e  # Exit on error

echo "================================"
echo "Rebuilding Frontend & Backend"
echo "================================"
echo ""

# Backend first (faster)
echo ">>> BACKEND <<<"
cd ~/vamasubmissions/backend

echo "[Backend 1/3] Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "[Backend 2/3] Restarting service..."
sudo systemctl restart vamasubmissions-backend

echo ""
echo "[Backend 3/3] Checking status..."
sleep 2
sudo systemctl status vamasubmissions-backend --no-pager -l | head -20

echo ""
echo "================================"
echo ""

# Frontend (slower)
echo ">>> FRONTEND <<<"
cd ~/vamasubmissions/frontend

echo "[Frontend 1/4] Installing dependencies..."
npm install

echo ""
echo "[Frontend 2/4] Building production bundle..."
npm run build

echo ""
echo "[Frontend 3/4] Deploying to nginx..."
sudo rm -rf /var/www/vamarequests/*
sudo cp -r dist/* /var/www/vamarequests/

echo ""
echo "[Frontend 4/4] Verifying deployment..."
ls -lh /var/www/vamarequests/ | head -10

echo ""
echo "================================"
echo "All rebuilds complete!"
echo "================================"
echo ""
echo "Backend logs: sudo journalctl -u vamasubmissions-backend -f"
echo "Nginx logs: sudo tail -f /var/log/nginx/error.log"
