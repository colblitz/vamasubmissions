# Patreon Character Submission Site - DEPLOYMENT GUIDE

## 🚀 DEPLOYMENT TO LINODE + NAMECHEAP

### Prerequisites:
- ✅ Domain purchased from Namecheap
- ✅ Linode server provisioned
- ✅ Patreon OAuth app created
- ✅ PostgreSQL database ready

---

## STEP 1: DOMAIN SETUP (Namecheap)

### 1.1 Get Linode Server IP
```bash
# On your Linode server
curl ifconfig.me
# Example output: 123.45.67.89
```

### 1.2 Configure DNS in Namecheap
1. Log into Namecheap
2. Go to Domain List → Manage → Advanced DNS
3. Add these records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | `YOUR_LINODE_IP` | Automatic |
| A Record | www | `YOUR_LINODE_IP` | Automatic |
| CNAME | api | `yourdomain.com` | Automatic |

**Example:**
- Domain: `mysite.com`
- Linode IP: `123.45.67.89`
- Records:
  - `mysite.com` → `123.45.67.89`
  - `www.mysite.com` → `123.45.67.89`
  - `api.mysite.com` → `mysite.com`

**Wait 5-30 minutes for DNS propagation**

---

## STEP 2: SERVER SETUP (Linode)

### 2.1 Initial Server Setup
```bash
# SSH into your Linode server
ssh root@YOUR_LINODE_IP

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser deploy
usermod -aG sudo deploy

# Setup SSH for deploy user
su - deploy
mkdir ~/.ssh
chmod 700 ~/.ssh
exit

# Copy SSH key (from your local machine)
ssh-copy-id deploy@YOUR_LINODE_IP

# Test new user
ssh deploy@YOUR_LINODE_IP
```

### 2.2 Install Dependencies
```bash
# Install Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx

# Install Git
sudo apt install -y git
```

### 2.3 Setup PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE patreon_submissions;
CREATE USER patreon_user WITH PASSWORD 'SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE patreon_submissions TO patreon_user;
\q

# Test connection
psql -U patreon_user -d patreon_submissions -h localhost
# Enter password when prompted
\q
```

---

## STEP 3: PATREON OAUTH SETUP

### 3.1 Create Patreon OAuth App
1. Go to https://www.patreon.com/portal/registration/register-clients
2. Click "Create Client"
3. Fill in:
   - **App Name**: Your Site Name
   - **Description**: Character submission site
   - **App Category**: Community
   - **Redirect URIs**: 
     - `https://yourdomain.com/auth/callback`
     - `https://api.yourdomain.com/api/auth/callback`
   - **Client API Version**: 2
   - **Requested Scopes**: 
     - `identity`
     - `identity[email]`
     - `identity.memberships`

4. Save and note:
   - **Client ID**: `abc123...`
   - **Client Secret**: `xyz789...`

---

## STEP 4: DEPLOY BACKEND

### 4.1 Clone Repository
```bash
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/vamasubmissions.git
cd vamasubmissions/backend
```

### 4.2 Create Environment File
```bash
nano .env
```

Add:
```bash
# Database
DATABASE_URL=postgresql://patreon_user:SECURE_PASSWORD_HERE@localhost/patreon_submissions

# Patreon OAuth
PATREON_CLIENT_ID=your_client_id_here
PATREON_CLIENT_SECRET=your_client_secret_here
PATREON_REDIRECT_URI=https://yourdomain.com/auth/callback

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your_random_secret_here

# Environment
ENVIRONMENT=production

# CORS
FRONTEND_URL=https://yourdomain.com

# File Upload
UPLOAD_DIR=/home/deploy/vamasubmissions/uploads
MAX_FILE_SIZE=10485760

# Tier Configuration (Patreon tier IDs)
TIER_1_ID=your_tier_1_id
TIER_2_ID=your_tier_2_id
TIER_3_ID=your_tier_3_id
TIER_4_ID=your_tier_4_id
```

### 4.3 Setup Python Environment
```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4.4 Run Database Migrations
```bash
# Initialize Alembic (if not done)
alembic init alembic

# Run migrations
alembic upgrade head
```

### 4.5 Create Upload Directory
```bash
mkdir -p /home/deploy/vamasubmissions/uploads
chmod 755 /home/deploy/vamasubmissions/uploads
```

### 4.6 Create Systemd Service
```bash
sudo nano /etc/systemd/system/patreon-backend.service
```

Add:
```ini
[Unit]
Description=Patreon Submission Backend
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/vamasubmissions/backend
Environment="PATH=/home/deploy/vamasubmissions/backend/venv/bin"
ExecStart=/home/deploy/vamasubmissions/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4.7 Start Backend Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable patreon-backend
sudo systemctl start patreon-backend
sudo systemctl status patreon-backend
```

---

## STEP 5: DEPLOY FRONTEND

### 5.1 Build Frontend
```bash
cd /home/deploy/vamasubmissions/frontend

# Create environment file
nano .env.production
```

Add:
```bash
VITE_API_URL=https://api.yourdomain.com
```

### 5.2 Install Dependencies and Build
```bash
npm install
npm run build
```

### 5.3 Move Build to Web Root
```bash
sudo mkdir -p /var/www/patreon-submissions
sudo cp -r dist/* /var/www/patreon-submissions/
sudo chown -R www-data:www-data /var/www/patreon-submissions
```

---

## STEP 6: NGINX CONFIGURATION

### 6.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/patreon-submissions
```

Add:
```nginx
# API subdomain
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
    server_name yourdomain.com www.yourdomain.com;

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
```

### 6.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/patreon-submissions /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## STEP 7: SSL CERTIFICATES (Let's Encrypt)

### 7.1 Install SSL Certificates
```bash
# For main domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# For API subdomain
sudo certbot --nginx -d api.yourdomain.com
```

### 7.2 Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is enabled by default via systemd timer
sudo systemctl status certbot.timer
```

---

## STEP 8: FIREWALL SETUP

```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## STEP 9: MONITORING & LOGS

### 9.1 View Backend Logs
```bash
sudo journalctl -u patreon-backend -f
```

### 9.2 View Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.3 Check Service Status
```bash
sudo systemctl status patreon-backend
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## STEP 10: BACKUP STRATEGY

### 10.1 Database Backup Script
```bash
nano ~/backup-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U patreon_user patreon_submissions > $BACKUP_DIR/db_$DATE.sql
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deploy/backup-db.sh
```

### 10.2 Uploads Backup
```bash
# Backup uploads directory
rsync -avz /home/deploy/vamasubmissions/uploads/ /home/deploy/backups/uploads/
```

---

## STEP 11: UPDATES & MAINTENANCE

### 11.1 Update Application
```bash
cd /home/deploy/vamasubmissions

# Pull latest code
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart patreon-backend

# Update frontend
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/patreon-submissions/
```

### 11.2 System Updates
```bash
sudo apt update && sudo apt upgrade -y
sudo systemctl restart patreon-backend
sudo systemctl restart nginx
```

---

## TROUBLESHOOTING

### Backend not starting
```bash
sudo journalctl -u patreon-backend -n 50
# Check for errors in logs
```

### Database connection issues
```bash
psql -U patreon_user -d patreon_submissions -h localhost
# Test connection manually
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

## SECURITY CHECKLIST

- ✅ SSH key-only authentication (disable password login)
- ✅ Firewall enabled (UFW)
- ✅ SSL certificates installed
- ✅ Database password is strong
- ✅ JWT secret is random and secure
- ✅ Regular backups configured
- ✅ System updates automated
- ✅ Non-root user for deployment
- ✅ File upload limits configured
- ✅ CORS properly configured

---

## ESTIMATED COSTS

**Linode Server** (Nanode 1GB):
- $5/month
- 1 CPU, 1GB RAM, 25GB SSD
- Sufficient for small-medium traffic

**Domain** (Namecheap):
- $10-15/year (.com)

**Total**: ~$6-7/month

---

## NEXT STEPS AFTER DEPLOYMENT

1. ✅ Test Patreon OAuth login
2. ✅ Create test submissions
3. ✅ Test file uploads
4. ✅ Verify email notifications (if implemented)
5. ✅ Monitor logs for errors
6. ✅ Setup monitoring (optional: UptimeRobot, Sentry)
7. ✅ Configure backups to external storage (optional: S3, Backblaze)

---

## USEFUL COMMANDS

```bash
# Restart everything
sudo systemctl restart patreon-backend nginx postgresql

# View all logs
sudo journalctl -xe

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
ps aux | grep uvicorn

# Database shell
psql -U patreon_user -d patreon_submissions
```

---

## SUPPORT & RESOURCES

- Linode Docs: https://www.linode.com/docs/
- Nginx Docs: https://nginx.org/en/docs/
- Certbot Docs: https://certbot.eff.org/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Patreon API: https://docs.patreon.com/
