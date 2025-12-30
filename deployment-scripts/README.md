# Automated Deployment Scripts

These scripts automate the deployment of your Patreon Character Submission site to Linode with a Namecheap domain.

## 📋 Prerequisites

**BEFORE running any scripts, complete the pre-deployment checklist:**

👉 **See `00-pre-deployment-checklist.md` for detailed instructions**

Quick checklist:
1. ✅ **Purchase domain from Namecheap**
2. ✅ **Create Linode server** (Ubuntu 22.04 LTS, Nanode 1GB)
3. ✅ **Configure DNS in Namecheap** (A records + CNAME)
4. ✅ **Create Patreon OAuth app** (get Client ID & Secret)
5. ✅ **Get Patreon tier IDs**
6. ✅ **Have your SSH key ready**
7. ✅ **Push code to GitHub**

## 🚀 Quick Start

### Step 1: Initial Server Setup (as root)

```bash
# SSH into your Linode server as root
ssh root@YOUR_SERVER_IP

# Upload and run the first script
wget https://raw.githubusercontent.com/YOUR_USERNAME/vamasubmissions/main/deployment-scripts/01-initial-server-setup.sh
bash 01-initial-server-setup.sh
```

**What it does:**
- Updates system packages
- Creates `deploy` user with sudo access
- Copies SSH keys to deploy user
- Installs Python, Node.js, PostgreSQL, Nginx, Git, Certbot

**Time:** ~5-10 minutes

---

### Step 2: Configure Database (as deploy user)

```bash
# Exit and SSH back in as deploy user
exit
ssh deploy@YOUR_SERVER_IP

# Upload scripts to server
cd ~
git clone https://github.com/YOUR_USERNAME/vamasubmissions.git
cd vamasubmissions/deployment-scripts

# Run database setup
bash 02-configure-database.sh
```

**What it does:**
- Creates PostgreSQL database `patreon_submissions`
- Creates database user `patreon_user`
- Tests database connection
- Saves password securely

**Time:** ~2 minutes

---

### Step 3: Deploy Application (as deploy user)

```bash
bash 03-deploy-application.sh
```

**You'll be prompted for:**
- Domain name (e.g., `mysite.com`)
- GitHub repository URL
- Patreon Client ID
- Patreon Client Secret

**What it does:**
- Clones your repository
- Creates backend `.env` file
- Installs Python dependencies
- Runs database migrations
- Builds frontend
- Deploys to web root

**Time:** ~10-15 minutes

---

### Step 4: Setup Services (as deploy user)

```bash
bash 04-setup-services.sh
```

**You'll be prompted for:**
- Domain name

**What it does:**
- Creates systemd service for backend
- Starts backend service
- Configures Nginx
- Restarts Nginx

**Time:** ~2 minutes

---

### Step 5: Setup SSL (as deploy user)

**IMPORTANT:** Wait for DNS propagation before running this (5-30 minutes after configuring DNS)

```bash
# Check if DNS is ready
dig yourdomain.com +short
# Should return your server IP

# Run SSL setup
bash 05-setup-ssl.sh
```

**You'll be prompted for:**
- Domain name
- Email for SSL notifications

**What it does:**
- Installs Let's Encrypt SSL certificates
- Configures auto-renewal
- Enables HTTPS redirect

**Time:** ~3 minutes

---

### Step 6: Setup Firewall (as deploy user)

```bash
bash 06-setup-firewall.sh
```

**What it does:**
- Configures UFW firewall
- Allows SSH, HTTP, HTTPS
- Enables firewall

**Time:** ~1 minute

---

### Step 7: Setup Backups (as deploy user)

```bash
bash 07-setup-backups.sh
```

**What it does:**
- Creates backup script
- Tests backup
- Schedules daily backups (2 AM)
- Configures 7-day retention

**Time:** ~2 minutes

---

## ✅ Deployment Complete!

Your site should now be live at:
- **Frontend:** `https://yourdomain.com`
- **API:** `https://api.yourdomain.com`

## 📊 Total Time

- **Hands-on time:** ~10 minutes (entering information)
- **Total time:** ~30-45 minutes (including waiting for installs)

## 🔧 Post-Deployment

### Update Patreon Tier IDs

Edit the backend `.env` file:

```bash
nano /home/deploy/vamasubmissions/backend/.env
```

Update these lines with your actual Patreon tier IDs:
```bash
TIER_1_ID=your_actual_tier_1_id
TIER_2_ID=your_actual_tier_2_id
TIER_3_ID=your_actual_tier_3_id
TIER_4_ID=your_actual_tier_4_id
```

Restart backend:
```bash
sudo systemctl restart patreon-backend
```

### Test Your Site

1. Visit `https://yourdomain.com`
2. Click "Login" and test Patreon OAuth
3. Create a test submission
4. Upload test images

## 📝 Useful Commands

```bash
# Check service status
sudo systemctl status patreon-backend
sudo systemctl status nginx

# View logs
sudo journalctl -u patreon-backend -f
sudo tail -f /var/log/nginx/error.log

# Manual backup
~/backup-db.sh

# View backups
ls -lh ~/backups/

# Restart services
sudo systemctl restart patreon-backend
sudo systemctl restart nginx

# Update application
cd /home/deploy/vamasubmissions
git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install && npm run build
sudo cp -r dist/* /var/www/patreon-submissions/
sudo systemctl restart patreon-backend
```

## 🐛 Troubleshooting

### Backend won't start
```bash
sudo journalctl -u patreon-backend -n 50
```

### Database connection issues
```bash
psql -U patreon_user -d patreon_submissions -h localhost
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

## 🔐 Security Notes

- Database password is stored in `~/deployment-config/db_password.txt` (mode 600)
- JWT secret is auto-generated and stored in backend `.env`
- Firewall is enabled (SSH, HTTP, HTTPS only)
- SSL certificates auto-renew
- Backups run daily at 2 AM

## 💰 Costs

- **Linode Nanode 1GB:** $5/month
- **Domain (.com):** ~$12/year
- **Total:** ~$6-7/month

## 📚 Full Documentation

See `DEPLOYMENT.md` for detailed manual instructions and additional information.

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs with the commands provided
3. Consult `DEPLOYMENT.md` for detailed steps
4. Check Linode/Nginx/PostgreSQL documentation

## 🎉 Congratulations!

Your Patreon Character Submission site is now live and ready to use!
