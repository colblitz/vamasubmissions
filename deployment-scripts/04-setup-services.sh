#!/bin/bash
# Services Setup Script (Systemd + Nginx)
# Run as DEPLOY user
# Usage: bash 04-setup-services.sh

set -e

echo "=== Services Setup ==="
echo ""

read -p "Enter your domain (e.g., mysite.com): " DOMAIN

echo "[1/4] Creating systemd service for backend..."
sudo tee /etc/systemd/system/patreon-backend.service > /dev/null << EOF
[Unit]
Description=Patreon Submission Backend
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/vamasubmissions/backend
Environment="PATH=/home/deploy/vamasubmissions/backend/venv/bin"
EnvironmentFile=/home/deploy/vamasubmissions/backend/.env
ExecStart=/home/deploy/vamasubmissions/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[2/4] Starting backend service..."
sudo systemctl daemon-reload
sudo systemctl enable patreon-backend
sudo systemctl start patreon-backend

# Wait a moment for service to start
sleep 3

# Check if service started successfully
if sudo systemctl is-active --quiet patreon-backend; then
    echo "✓ Backend service started successfully"
else
    echo "✗ Backend service failed to start. Check logs with: sudo journalctl -u patreon-backend -n 50"
    exit 1
fi

echo "[3/4] Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/patreon-submissions > /dev/null << EOF
# API subdomain
server {
    listen 80;
    server_name api.$DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        alias /home/deploy/vamasubmissions/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# Main frontend
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /var/www/patreon-submissions;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "[4/4] Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/patreon-submissions /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
if sudo nginx -t; then
    echo "✓ Nginx configuration valid"
    sudo systemctl restart nginx
    echo "✓ Nginx restarted"
else
    echo "✗ Nginx configuration invalid!"
    exit 1
fi

echo ""
echo "=== Services Setup Complete! ==="
echo ""
echo "Services running:"
echo "  - Backend: http://127.0.0.1:8000 (internal)"
echo "  - Frontend: http://$DOMAIN (via Nginx)"
echo "  - API: http://api.$DOMAIN (via Nginx)"
echo ""
echo "Check status:"
echo "  - Backend: sudo systemctl status patreon-backend"
echo "  - Nginx: sudo systemctl status nginx"
echo ""
echo "Next steps:"
echo "1. Make sure DNS is configured (A records for $DOMAIN and api.$DOMAIN)"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Run: bash 05-setup-ssl.sh"
echo ""
