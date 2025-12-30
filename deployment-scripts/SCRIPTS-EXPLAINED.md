# Deployment Scripts Explained

This document explains what each deployment script does, why it's needed, and what happens when you run it.

---

## 📋 Overview

The deployment process is broken into 7 automated scripts that handle different aspects of setting up your server:

1. **Initial Server Setup** - Security, users, dependencies
2. **Database Configuration** - PostgreSQL setup
3. **Application Deployment** - Clone code, configure, build
4. **Service Setup** - Systemd + Nginx
5. **SSL Certificates** - HTTPS with Let's Encrypt
6. **Firewall Configuration** - UFW security
7. **Backup Setup** - Automated backups

---

## 🔧 Script Details

### 00-pre-deployment-checklist.md

**What it is:** A checklist document (not a script)

**Purpose:** Ensures you have everything ready before running the automated scripts

**What you need to do:**
- Purchase domain from Namecheap
- Create Linode server
- Configure DNS records
- Create Patreon OAuth app
- Get Patreon tier IDs
- Prepare SSH keys
- Push code to GitHub

**Why it's important:** Running the scripts without these prerequisites will fail. This checklist ensures you have all the information and accounts set up first.

---

### 01-initial-server-setup.sh

**What it does:**
1. Updates all system packages
2. Configures SSH security (key-only authentication, disable root login)
3. Creates a non-root `deploy` user with sudo privileges
4. Installs fail2ban (blocks brute-force attacks)
5. Installs all required dependencies:
   - Python 3.11
   - PostgreSQL
   - Node.js 18+
   - Nginx
   - Certbot (for SSL)
   - Git
6. Sets up basic UFW firewall (allows SSH only at this stage)
7. Configures timezone

**Run as:** `root` (first login to fresh server)

**What you'll be asked:**
- Your SSH public key (for the deploy user)
- Timezone (e.g., America/Los_Angeles)

**Why it's needed:** 
- Fresh Linode servers are insecure by default (root login with password)
- This hardens security and installs all tools needed for deployment
- Creates a non-root user for safer operations

**After running:**
- You'll need to reconnect as the `deploy` user (not root)
- SSH will be more secure (key-only, no root login)

---

### 02-configure-database.sh

**What it does:**
1. Creates PostgreSQL database: `patreon_submissions`
2. Creates PostgreSQL user: `patreon_user`
3. Sets up database permissions
4. Tests the connection
5. Saves database password for later scripts

**Run as:** `deploy` user

**What you'll be asked:**
- Database password (create a strong one!)

**Why it's needed:**
- Your application needs a database to store users, submissions, votes, etc.
- PostgreSQL needs to be configured with proper users and permissions
- The password is saved securely for the next script to use

**After running:**
- Database is ready to receive data
- Password is saved in `~/deployment-config/db_password.txt`

---

### 03-deploy-application.sh

**What it does:**
1. Clones your GitHub repository
2. Creates backend `.env` file with all configuration:
   - Database connection string
   - Patreon OAuth credentials
   - JWT secret (auto-generated)
   - File upload settings
   - Tier IDs
3. Sets up Python virtual environment
4. Installs Python dependencies
5. Runs database migrations (creates tables)
6. Creates upload directory for user images
7. Creates frontend `.env.production` file
8. Builds frontend (React/Vite)
9. Deploys frontend to web root (`/var/www/patreon-submissions`)

**Run as:** `deploy` user

**What you'll be asked:**
- Your domain name (e.g., mysite.com)
- GitHub repository URL (defaults to `git@github.com:colblitz/vamasubmissions.git`)
- Patreon Client ID
- Patreon Client Secret
- Database password (auto-loaded if you ran script 02)

**Why it's needed:**
- This is where your actual application code gets deployed
- Configuration files (`.env`) are created with your specific settings
- Frontend is built into static files ready to serve
- Database structure is created via migrations

**After running:**
- Your code is on the server at `/home/deploy/vamasubmissions`
- Backend is configured but not running yet
- Frontend is built and in web root
- You'll need to manually update Patreon tier IDs in `backend/.env`

**Important:** After this script, edit `backend/.env` to add your real Patreon tier IDs!

---

### 04-setup-services.sh

**What it does:**
1. Creates systemd service for backend (`patreon-backend.service`)
   - Runs FastAPI with uvicorn
   - Auto-starts on boot
   - Auto-restarts if it crashes
   - Runs on port 8000 (localhost only)
2. Creates Nginx configuration:
   - Main domain: serves frontend static files
   - API subdomain: proxies to backend on port 8000
   - Handles file uploads (20MB limit)
   - Serves uploaded images
3. Enables and starts both services

**Run as:** `deploy` user

**What you'll be asked:**
- Your domain name (e.g., mysite.com)

**Why it's needed:**
- Your backend needs to run continuously as a service
- Nginx acts as a reverse proxy and web server:
  - Serves frontend files efficiently
  - Forwards API requests to backend
  - Handles SSL termination (after script 05)
  - Serves user-uploaded images

**After running:**
- Backend is running on `http://localhost:8000`
- Nginx is serving your site on `http://yourdomain.com` (no HTTPS yet)
- Site is accessible but not secure (no SSL)

---

### 05-setup-ssl.sh

**What it does:**
1. Runs Certbot to get SSL certificates from Let's Encrypt
2. Installs certificates for:
   - Main domain (yourdomain.com)
   - www subdomain (www.yourdomain.com)
   - API subdomain (api.yourdomain.com)
3. Configures Nginx to use HTTPS
4. Sets up auto-renewal (certificates expire every 90 days)

**Run as:** `deploy` user

**What you'll be asked:**
- Your domain name
- Your email address (for Let's Encrypt notifications)
- Agree to Let's Encrypt Terms of Service

**Why it's needed:**
- HTTPS is required for Patreon OAuth (they won't redirect to HTTP sites)
- Encrypts all traffic between users and your site
- Modern browsers show warnings for non-HTTPS sites
- Required for production use

**After running:**
- Site is accessible via HTTPS: `https://yourdomain.com`
- API is accessible via HTTPS: `https://api.yourdomain.com`
- Certificates auto-renew every 60 days

**Note:** DNS must be fully propagated before running this script, or certificate issuance will fail!

---

### 06-setup-firewall.sh

**What it does:**
1. Configures UFW (Uncomplicated Firewall)
2. Allows only necessary ports:
   - SSH (port 22)
   - HTTP (port 80)
   - HTTPS (port 443)
3. Blocks all other incoming traffic
4. Enables the firewall

**Run as:** `deploy` user

**What you'll be asked:**
- Nothing (fully automated)

**Why it's needed:**
- Servers exposed to the internet are constantly scanned for vulnerabilities
- Firewall blocks unauthorized access attempts
- Only allows web traffic and SSH
- Essential security layer

**After running:**
- Firewall is active and protecting your server
- Only ports 22, 80, 443 are accessible
- All other ports are blocked

---

### 07-setup-backups.sh

**What it does:**
1. Creates backup directory structure
2. Creates database backup script:
   - Dumps PostgreSQL database to SQL file
   - Compresses with gzip
   - Keeps last 7 days of backups
   - Deletes older backups automatically
3. Creates uploads backup script:
   - Copies user-uploaded images
   - Uses rsync for efficiency
4. Schedules both backups to run daily at 2 AM via cron

**Run as:** `deploy` user

**What you'll be asked:**
- Nothing (fully automated)

**Why it's needed:**
- Protects against data loss from:
  - Accidental deletion
  - Server failure
  - Database corruption
  - User errors
- Automated daily backups ensure you can restore recent data
- Keeps 7 days of history for recovery

**After running:**
- Backups run automatically every day at 2 AM
- Database backups stored in `~/backups/database/`
- Upload backups stored in `~/backups/uploads/`
- Old backups (>7 days) are automatically deleted

**Important:** These backups are on the same server! For production, you should also:
- Copy backups to external storage (S3, Backblaze, etc.)
- Test restoration periodically
- Consider real-time database replication for critical data

---

## 🔄 Execution Order

**You must run the scripts in order:**

```bash
# 1. As root (first login)
bash 01-initial-server-setup.sh

# 2-7. As deploy user (after reconnecting)
bash 02-configure-database.sh
bash 03-deploy-application.sh
bash 04-setup-services.sh
bash 05-setup-ssl.sh
bash 06-setup-firewall.sh
bash 07-setup-backups.sh
```

**Why this order?**
1. Must create deploy user before running other scripts
2. Database must exist before deploying application
3. Application must be deployed before creating services
4. Services must be running before setting up SSL
5. SSL must be configured before finalizing firewall
6. Backups are last (everything else must be working)

---

## 📊 What Gets Installed

**System Packages:**
- Python 3.12+ (backend runtime - Ubuntu 24.04 default)
- PostgreSQL (database)
- Node.js 18+ (frontend build tool)
- Nginx (web server / reverse proxy)
- Certbot (SSL certificates)
- Git (version control)
- fail2ban (security)
- UFW (firewall)

**Python Packages:** (from requirements.txt)
- FastAPI (web framework)
- SQLAlchemy (database ORM)
- Alembic (database migrations)
- Pydantic (data validation)
- python-jose (JWT tokens)
- httpx (HTTP client for Patreon API)
- python-multipart (file uploads)
- Pillow (image processing)

**Node Packages:** (from package.json)
- React (frontend framework)
- Vite (build tool)
- react-router-dom (routing)
- axios (HTTP client)
- Tailwind CSS (styling)

---

## 🔐 Security Measures

**What the scripts do for security:**

1. **SSH Hardening:**
   - Disable root login
   - Disable password authentication
   - Key-only authentication
   - Change SSH port (optional)

2. **User Security:**
   - Non-root deploy user
   - Sudo access only when needed
   - Restricted file permissions

3. **Network Security:**
   - UFW firewall (blocks all except 22, 80, 443)
   - fail2ban (blocks brute-force attacks)
   - SSL/HTTPS encryption

4. **Application Security:**
   - Environment variables for secrets
   - JWT authentication
   - File upload limits
   - CORS configuration

5. **Database Security:**
   - Non-root database user
   - Strong password
   - Local-only connections

---

## 🐛 Troubleshooting

**Script fails during execution:**
- Read the error message carefully
- Check if prerequisites are met (DNS, SSH keys, etc.)
- Ensure you're running as the correct user (root vs deploy)
- Check if previous scripts completed successfully

**Can't SSH after script 01:**
- Make sure you added your SSH public key correctly
- Try: `ssh deploy@YOUR_IP` (not root)
- If locked out, use Linode console (LISH) to recover

**SSL certificate fails (script 05):**
- DNS must be fully propagated (wait 30 minutes after DNS changes)
- Check DNS with: `dig yourdomain.com`
- Ensure ports 80 and 443 are open

**Backend won't start (script 04):**
- Check logs: `sudo journalctl -u patreon-backend -n 50`
- Verify .env file has correct values
- Test database connection manually

**Backups not running:**
- Check cron: `crontab -l`
- Check backup scripts are executable: `ls -l ~/backup-*.sh`
- Test manually: `bash ~/backup-database.sh`

---

## 📝 Configuration Files Created

**Backend:**
- `/home/deploy/vamasubmissions/backend/.env` - All backend configuration
- `/etc/systemd/system/patreon-backend.service` - Backend service definition

**Frontend:**
- `/home/deploy/vamasubmissions/frontend/.env.production` - Frontend API URL

**Nginx:**
- `/etc/nginx/sites-available/patreon-submissions` - Web server config
- `/etc/nginx/sites-enabled/patreon-submissions` - Symlink to enable

**Backups:**
- `/home/deploy/backup-database.sh` - Database backup script
- `/home/deploy/backup-uploads.sh` - Uploads backup script

**Security:**
- `/etc/ssh/sshd_config` - SSH configuration
- `/etc/ufw/` - Firewall rules

---

## 🔄 Updates & Maintenance

**To update your application after changes:**

```bash
# SSH into server
ssh deploy@YOUR_IP

# Pull latest code
cd ~/vamasubmissions
git pull origin master

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

**To view logs:**
```bash
# Backend logs
sudo journalctl -u patreon-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -xe
```

**To restart services:**
```bash
sudo systemctl restart patreon-backend
sudo systemctl restart nginx
sudo systemctl restart postgresql
```

---

## 💰 Cost Breakdown

**Linode Server (Nanode 1GB):**
- $5/month
- 1 CPU core
- 1 GB RAM
- 25 GB SSD storage
- 1 TB transfer
- Sufficient for small-medium traffic (100-1000 users)

**Domain (Namecheap):**
- $10-15/year for .com
- ~$1/month amortized

**SSL Certificate:**
- FREE (Let's Encrypt)

**Total: ~$6/month**

**When to upgrade:**
- More than 1000 active users
- High traffic spikes
- Large file uploads
- Need more storage

---

## 🎯 What Happens After All Scripts Complete

Your site will be:
- ✅ Fully deployed and running
- ✅ Accessible at `https://yourdomain.com`
- ✅ API accessible at `https://api.yourdomain.com`
- ✅ Secured with HTTPS
- ✅ Protected by firewall
- ✅ Backed up daily
- ✅ Auto-restarting if it crashes
- ✅ Ready for users to register via Patreon OAuth

**Final steps:**
1. Test Patreon login flow
2. Create a test submission
3. Verify file uploads work
4. Check admin dashboard
5. Monitor logs for errors
6. Set up external backup storage (recommended)

---

## 📚 Additional Resources

- **Linode Docs:** https://www.linode.com/docs/
- **Nginx Docs:** https://nginx.org/en/docs/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Certbot Docs:** https://certbot.eff.org/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **React Docs:** https://react.dev/

---

## ❓ Common Questions

**Q: Can I run these scripts multiple times?**
A: Most scripts are idempotent (safe to re-run), but script 01 should only run once. Scripts 03-07 can be re-run if needed.

**Q: What if I want to use a different domain later?**
A: Re-run scripts 03, 04, and 05 with the new domain name.

**Q: Can I use a different database password?**
A: Yes, but you'll need to update it in both PostgreSQL and the backend `.env` file.

**Q: What if I want to deploy to a different server?**
A: Run all scripts again on the new server. Don't forget to update DNS!

**Q: How do I add more storage?**
A: Resize your Linode in the Linode dashboard, then resize the filesystem.

**Q: Can I use a different port for the backend?**
A: Yes, edit the systemd service file and Nginx config to use a different port.

**Q: How do I enable debug mode?**
A: Change `ENVIRONMENT=production` to `ENVIRONMENT=development` in backend `.env`, then restart the service.

---

## 🚨 Important Notes

1. **Never commit `.env` files to Git** - They contain secrets!
2. **Save your database password** - You'll need it for manual access
3. **Test backups regularly** - Ensure you can restore from them
4. **Monitor disk space** - Uploads can fill up storage
5. **Keep system updated** - Run `sudo apt update && sudo apt upgrade` monthly
6. **Watch logs after deployment** - Catch errors early
7. **DNS takes time** - Wait 30 minutes after DNS changes before running SSL script

---

## ✅ Success Indicators

**After all scripts complete, verify:**

```bash
# Backend is running
sudo systemctl status patreon-backend
# Should show: "active (running)"

# Nginx is running
sudo systemctl status nginx
# Should show: "active (running)"

# Database is running
sudo systemctl status postgresql
# Should show: "active (running)"

# Site is accessible
curl https://yourdomain.com
# Should return HTML

# API is accessible
curl https://api.yourdomain.com/api/health
# Should return JSON

# SSL is working
curl -I https://yourdomain.com
# Should show: "HTTP/2 200"

# Firewall is active
sudo ufw status
# Should show: "Status: active"

# Backups are scheduled
crontab -l
# Should show backup cron jobs
```

If all of these pass, your deployment is successful! 🎉
