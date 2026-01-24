#!/bin/bash
# Rebuild and restart backend

set -e  # Exit on error

echo "================================"
echo "Rebuilding Backend"
echo "================================"
echo ""

cd ~/vamasubmissions/backend

echo "[1/3] Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "[2/3] Restarting backend service..."
sudo systemctl restart vamasubmissions-backend

echo ""
echo "[3/3] Checking status..."
sleep 2
sudo systemctl status vamasubmissions-backend --no-pager -l

echo ""
echo "================================"
echo "Backend rebuild complete!"
echo "================================"
echo ""
echo "View logs with: sudo journalctl -u vamasubmissions-backend -f"
