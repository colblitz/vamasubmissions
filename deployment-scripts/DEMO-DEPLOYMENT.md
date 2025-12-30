# Demo Deployment Guide (Test Mode - No Patreon)

This guide deploys the **test/demo version** of the site with:
- ✅ Mock authentication (no Patreon OAuth)
- ✅ Test data pre-loaded
- ✅ Fake login system
- ✅ All features functional for demonstration
- ❌ No real Patreon integration
- ❌ No database (in-memory only)

**Use this for:** Demos, testing, development, showing features to others

---

## Prerequisites

- Domain purchased from Namecheap
- Linode server (Ubuntu 24.04)
- That's it! No Patreon app needed.

---

## Quick Deployment Steps

### 1. Setup DNS (Namecheap → Linode)

**In Namecheap:**
1. Domain List → Manage → Nameservers
2. Select "Custom DNS"
3. Add Linode nameservers:
   - `ns1.linode.com`
   - `ns2.linode.com`
   - `ns3.linode.com`
   - `ns4.linode.com`
   - `ns5.linode.com`

**In Linode:**
1. Domains → Create Domain → Enter your domain
2. Add DNS records:
   - A record: (blank) → `YOUR_LINODE_IP`
   - A record: `www` → `YOUR_LINODE_IP`
   - A record: `api` → `YOUR_LINODE_IP`

Wait 15-30 minutes for DNS propagation.

---

### 2. Initial Server Setup

SSH into your server as root:

```bash
ssh root@YOUR_LINODE_IP
```

Download and run the setup script:

```bash
wget https://raw.githubusercontent.com/colblitz/vamasubmissions/master/deployment-scripts/01-initial-server-setup.sh
bash 01-initial-server-setup.sh
```

**What it asks:**
- Your SSH public key (get it with `cat ~/.ssh/id_rsa.pub` on your local machine)
- Timezone (e.g., `America/Los_Angeles`)

**Exit and reconnect as deploy user:**

```bash
exit
ssh deploy@YOUR_LINODE_IP
```

---

### 3. Deploy Demo Application

Download the demo deployment script:

```bash
cd ~
wget https://raw.githubusercontent.com/colblitz/vamasubmissions/master/deployment-scripts/deploy-demo.sh
chmod +x deploy-demo.sh
bash deploy-demo.sh
```

**What it asks:**
- Your domain name (e.g., `mysite.com`)

**What it does:**
- Clones your repository
- Sets up Python environment
- Builds frontend with demo mode enabled
- Configures Nginx
- Starts the test backend

---

### 4. Setup SSL

```bash
bash 05-setup-ssl.sh
```

**What it asks:**
- Domain name
- Email address

---

### 5. Setup Firewall

```bash
bash 06-setup-firewall.sh
```

Fully automated!

---

## Test Your Demo Site

Visit `https://yourdomain.com`

**Mock Login Options:**
- **Tier 1 User** (Free tier - voting only)
- **Tier 2 User** (Can submit, 2 credits/month)
- **Tier 3 User** (Can submit, 5 credits/month)
- **Tier 4 User** (Can submit, 10 credits/month)
- **Admin** (Full access to admin dashboard)

**Pre-loaded Test Data:**
- Sample character submissions
- Test images
- Mock vote sessions
- Sample queue data

---

## What's Different from Production?

| Feature | Demo Mode | Production Mode |
|---------|-----------|-----------------|
| Authentication | Mock login (choose tier) | Real Patreon OAuth |
| Database | In-memory (resets on restart) | PostgreSQL (persistent) |
| User Data | Test users only | Real Patreon users |
| Tier Detection | Manual selection | Automatic from Patreon |
| Data Persistence | Lost on restart | Saved permanently |
| Setup Complexity | Simple (no Patreon) | Complex (OAuth setup) |

---

## Demo Deployment Script

Here's what `deploy-demo.sh` does:

```bash
#!/bin/bash
# Demo Deployment Script
# Deploys test mode without Patreon integration

set -e

echo "=== Demo Application Deployment ==="
echo ""

# Get domain
read -p "Enter your domain (e.g., mysite.com): " DOMAIN

# Clone repository
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
sudo tee /etc/nginx/sites-available/patreon-submissions > /dev/null << 'EOF'
# API subdomain
server {
    listen 80;
    server_name api.DOMAIN_PLACEHOLDER;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

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
echo "1. Wait for DNS to propagate (15-30 min)"
echo "2. Run: bash 05-setup-ssl.sh"
echo "3. Run: bash 06-setup-firewall.sh"
echo ""
echo "Test users available:"
echo "  - Tier 1 (Free)"
echo "  - Tier 2 (2 credits/month)"
echo "  - Tier 3 (5 credits/month)"
echo "  - Tier 4 (10 credits/month)"
echo "  - Admin"
echo ""
```

---

## Managing the Demo

### View Logs
```bash
sudo journalctl -u patreon-backend-demo -f
```

### Restart Backend
```bash
sudo systemctl restart patreon-backend-demo
```

### Check Status
```bash
sudo systemctl status patreon-backend-demo
sudo systemctl status nginx
```

### Update Demo
```bash
cd ~/vamasubmissions
git pull origin master

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart patreon-backend-demo

# Update frontend
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/patreon-submissions/
```

---

## Upgrading to Production Later

When you're ready to add real Patreon integration:

1. Create Patreon OAuth app
2. Setup PostgreSQL database
3. Run the full deployment scripts (02-04)
4. Switch systemd service from `patreon-backend-demo` to `patreon-backend`
5. Update frontend environment to disable demo mode

See `00-pre-deployment-checklist.md` for full production setup.

---

## Cost

**Demo deployment costs the same as production:**
- Linode: $5/month
- Domain: ~$1/month
- SSL: FREE
- **Total: ~$6/month**

---

## Limitations

**Demo mode limitations:**
- ⚠️ All data resets when backend restarts
- ⚠️ No real user accounts
- ⚠️ Can't test Patreon tier detection
- ⚠️ No email notifications
- ⚠️ Limited to test images only

**Good for:**
- ✅ Showing features to potential users
- ✅ Testing UI/UX
- ✅ Getting feedback
- ✅ Development/staging environment
- ✅ Demos and presentations

---

## Troubleshooting

**Backend won't start:**
```bash
sudo journalctl -u patreon-backend-demo -n 50
```

**Can't access site:**
```bash
# Check DNS
dig yourdomain.com

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check backend
curl http://localhost:8000/api/health
```

**Images not loading:**
```bash
# Check test images directory
ls -la /home/deploy/vamasubmissions/backend/test_uploads/test_images/

# Check Nginx config
sudo nginx -t
```

---

## Security Notes

Even in demo mode, you should:
- ✅ Enable firewall (script 06)
- ✅ Use SSL/HTTPS (script 05)
- ✅ Keep system updated
- ✅ Use SSH keys only

Demo mode is safe for public access since:
- No real user data
- No database to compromise
- No API keys or secrets needed
- Data resets on restart

---

## Questions?

**Q: Can I switch from demo to production later?**
A: Yes! Just run the full deployment scripts and setup Patreon OAuth.

**Q: Will my demo data be saved?**
A: No, demo mode uses in-memory storage. Data resets on restart.

**Q: Can I customize the test data?**
A: Yes! Edit `backend/app/main_test_simple_v2.py` and restart the service.

**Q: Do I need a database for demo mode?**
A: No! Demo mode runs entirely in memory.

**Q: Can multiple people use the demo at once?**
A: Yes, but they'll all see the same test data and changes affect everyone.

---

## Summary

**Demo deployment is perfect for:**
- Quick setup and testing
- Showing features without Patreon complexity
- Development and staging environments
- Getting feedback before going live

**3 simple steps:**
1. Run initial server setup (script 01)
2. Run demo deployment (deploy-demo.sh)
3. Setup SSL and firewall (scripts 05-06)

**Total time: ~30 minutes** (including DNS propagation)

🎉 Your demo site is ready to show off!
