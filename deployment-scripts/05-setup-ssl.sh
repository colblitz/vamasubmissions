#!/bin/bash
# SSL Setup Script (Let's Encrypt)
# Run as DEPLOY user
# Usage: bash 05-setup-ssl.sh

set -e

echo "=== SSL Certificate Setup ==="
echo ""

read -p "Enter your domain (e.g., mysite.com): " DOMAIN
read -p "Enter your email for SSL notifications: " EMAIL

echo ""
echo "IMPORTANT: Make sure DNS is configured and propagated!"
echo "Check with: dig $DOMAIN +short"
echo "Should return your server IP address"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "[1/2] Installing SSL certificate for main domain..."
sudo certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --redirect

if [ $? -eq 0 ]; then
    echo "✓ SSL certificate installed for $DOMAIN"
else
    echo "✗ Failed to install SSL for $DOMAIN"
    echo "Make sure DNS is configured correctly!"
    exit 1
fi

echo ""
echo "[2/2] Installing SSL certificate for API subdomain..."
sudo certbot --nginx \
    -d "api.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --redirect

if [ $? -eq 0 ]; then
    echo "✓ SSL certificate installed for api.$DOMAIN"
else
    echo "✗ Failed to install SSL for api.$DOMAIN"
    exit 1
fi

echo ""
echo "Testing auto-renewal..."
sudo certbot renew --dry-run

echo ""
echo "=== SSL Setup Complete! ==="
echo ""
echo "Your site is now accessible at:"
echo "  - https://$DOMAIN"
echo "  - https://www.$DOMAIN"
echo "  - https://api.$DOMAIN"
echo ""
echo "SSL certificates will auto-renew via systemd timer"
echo "Check renewal timer: sudo systemctl status certbot.timer"
echo ""
echo "Next steps:"
echo "1. Run: bash 06-setup-firewall.sh"
echo ""
