#!/bin/bash
# Rebuild and deploy frontend

set -e  # Exit on error

echo "================================"
echo "Rebuilding Frontend"
echo "================================"
echo ""

cd ~/vamasubmissions/frontend

echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Building production bundle..."
npm run build

echo ""
echo "[3/4] Deploying to nginx..."
sudo rm -rf /var/www/vamarequests/*
sudo cp -r dist/* /var/www/vamarequests/

echo ""
echo "[4/4] Verifying deployment..."
ls -lh /var/www/vamarequests/ | head -10

echo ""
echo "================================"
echo "Frontend rebuild complete!"
echo "================================"
