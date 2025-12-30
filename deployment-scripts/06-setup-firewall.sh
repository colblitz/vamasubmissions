#!/bin/bash
# Firewall Setup Script
# Run as DEPLOY user
# Usage: bash 06-setup-firewall.sh

set -e

echo "=== Firewall Setup ==="
echo ""

echo "[1/3] Configuring UFW firewall..."

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow OpenSSH

# Allow Nginx (HTTP + HTTPS)
sudo ufw allow 'Nginx Full'

# Allow PostgreSQL only from localhost (already default, but being explicit)
# sudo ufw deny 5432

echo "[2/3] Enabling firewall..."
echo "y" | sudo ufw enable

echo "[3/3] Checking firewall status..."
sudo ufw status verbose

echo ""
echo "=== Firewall Setup Complete! ==="
echo ""
echo "Allowed ports:"
echo "  - 22 (SSH)"
echo "  - 80 (HTTP)"
echo "  - 443 (HTTPS)"
echo ""
echo "Next steps:"
echo "1. Run: bash 07-setup-backups.sh"
echo ""
