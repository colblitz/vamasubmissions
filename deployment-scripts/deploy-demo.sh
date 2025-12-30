#!/bin/bash
# Demo Deployment Script
# Deploys test mode without Patreon integration
# Run as DEPLOY user

set -e

echo "=== Demo Application Deployment ==="
echo ""
echo "This will deploy the DEMO version with:"
echo "  - Mock authentication (no Patreon)"
echo "  - Test data pre-loaded"
echo "  - In-memory storage (resets on restart)"
echo ""
read -p "Press Enter to continue..."

# Get domain
read -p "Enter your domain (e.g., mysite.com): " DOMAIN

# Clone repository
echo ""
echo "[1/6] Cloning repository..."
cd /home/deploy
if [ -d "vamasubmissions" ]; then
    echo "Repository exists, pulling latest..."
    cd vamasubmissions
    git pull origin master
else
    git clone git@github.com:colblitz/vamasubmissions.git vamasubmissions
    cd vamasubmissions
fi

# Setup backend (test mode)
echo "[2/6] Setting up test backend..."
cd /home/deploy/vamasubmissions/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service for test backend
echo "[3/6] Creating backend service..."
sudo tee /etc/systemd/system/patreon-backend-demo.service > /dev/null << EOF
[Unit]
Description=Patreon Submission Backend (Demo Mode)
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/vamasubmissions/backend
Environment="PATH=/home/deploy/vamasubmissions/backend/venv/bin"
ExecStart=/home/deploy/vamasubmissions/backend/venv/bin/python run_test_mode.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable patreon-backend-demo
sudo systemctl start patreon-backend-demo

echo "Waiting 5 seconds for backend to start..."
sleep 5

# Check if backend is running
if sudo systemctl is-active --quiet patreon-backend-demo; then
    echo "✓ Backend started successfully"
else
    echo "⚠ Backend may have issues, check logs with:"
    echo "  sudo journalctl -u patreon-backend-demo -n 50"
fi

# Build frontend
echo "[4/6] Building frontend..."
cd /home/deploy/vamasubmissions/frontend

cat > .env.production << EOF
VITE_API_URL=https://api.$DOMAIN
VITE_DEMO_MODE=true
EOF

npm install
npm run build

# Deploy frontend
echo "[5/6] Deploying frontend..."
sudo mkdir -p /var/www/patreon-submissions
sudo cp -r dist/* /var/www/patreon-submissions/
sudo chown -R www-data:www-data /var/www/patreon-submissions

# Configure Nginx
echo "[6/6] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/patreon-submissions > /dev/null << 'NGINXEOF'
# API subdomain
server {
    listen 80;
    server_name api.DOMAIN_PLACEHOLDER;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /test_images/ {
        alias /home/deploy/vamasubmissions/backend/test_uploads/test_images/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# Main frontend
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    root /var/www/patreon-submissions;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Replace domain placeholder
sudo sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/patreon-submissions

# Enable site
sudo ln -sf /etc/nginx/sites-available/patreon-submissions /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "=== Demo Deployment Complete! ==="
echo ""
echo "Your demo site is running at:"
echo "  http://$DOMAIN (will be https after SSL setup)"
echo "  http://api.$DOMAIN"
echo ""
echo "Backend service: patreon-backend-demo"
echo "  Status: sudo systemctl status patreon-backend-demo"
echo "  Logs: sudo journalctl -u patreon-backend-demo -f"
echo ""
echo "Next steps:"
echo "1. Wait for DNS to propagate (15-30 min if just configured)"
echo "2. Download remaining scripts:"
echo "   wget https://raw.githubusercontent.com/colblitz/vamasubmissions/master/deployment-scripts/05-setup-ssl.sh"
echo "   wget https://raw.githubusercontent.com/colblitz/vamasubmissions/master/deployment-scripts/06-setup-firewall.sh"
echo "   chmod +x *.sh"
echo "3. Run: bash 05-setup-ssl.sh"
echo "4. Run: bash 06-setup-firewall.sh"
echo ""
echo "Test users available after setup:"
echo "  - Tier 1 (Free - voting only)"
echo "  - Tier 2 (2 credits/month)"
echo "  - Tier 3 (5 credits/month)"
echo "  - Tier 4 (10 credits/month)"
echo "  - Admin (full access)"
echo ""
echo "Note: Demo mode uses in-memory storage."
echo "All data resets when backend restarts!"
echo ""
