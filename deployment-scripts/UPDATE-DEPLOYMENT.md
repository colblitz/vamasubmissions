# Update Existing Deployment to Latest HEAD

This guide covers updating your existing vamarequests.com deployment to the latest code with real Patreon OAuth.

## Prerequisites

- Existing deployment at vamarequests.com
- SSH access to the server
- Patreon OAuth credentials (Client ID, Secret, Creator ID)
- Your Patreon User ID for admin access

---

## Quick Update (TL;DR)

```bash
# SSH into server
ssh your-user@vamarequests.com

# Run the update script
cd /path/to/vamasubmissions
./deployment-scripts/update-deployment.sh
```

---

## Step-by-Step Update Process

### 1. Backup Current Deployment

**On the server:**

```bash
# SSH into server
ssh your-user@vamarequests.com

# Backup database
sudo -u postgres pg_dump vamasubmissions > ~/backup-$(date +%Y%m%d-%H%M%S).sql

# Backup application code (if needed)
cd /path/to/vamasubmissions
git stash  # Save any local changes
```

### 2. Pull Latest Code

```bash
# Pull latest from master
git fetch origin
git pull origin master

# Check what changed
git log --oneline -10
```

**Recent commits you're pulling:**
- `9f92308` - Browse tab UX improvements and date sorting fix
- `f0dbb16` - Browse Tab implementation  
- `1c42c5c` - Data normalization and validation
- `315c4b4` - Database migration instructions
- `8c63d72` - Workflow rules documentation
- `76d4c08` - Major UX improvements and tier-based access control

### 3. Run Database Migrations

**Critical: Run the new migration for tier_name column**

```bash
# Check if migration is needed
sudo -u postgres psql vamasubmissions -c "\d users" | grep tier_name

# If tier_name column doesn't exist, run the migration:
sudo -u postgres psql vamasubmissions -f backend/alembic/versions/006_add_tier_name.sql

# Verify migration succeeded
sudo -u postgres psql vamasubmissions -c "SELECT tier, tier_name FROM users LIMIT 5;"
```

### 4. Update Backend Dependencies

```bash
cd backend
source venv/bin/activate

# Install new dependencies (slowapi for rate limiting)
pip install -r requirements.txt

# Verify slowapi is installed
pip list | grep slowapi  # Should show: slowapi==0.1.9
```

### 5. Update Environment Variables

**Backend `.env` - Switch from mock auth to real Patreon OAuth:**

```bash
cd backend
nano .env  # or vim .env
```

**Update these values:**

```bash
# Patreon OAuth (REQUIRED - replace with your actual values)
PATREON_CLIENT_ID=your_actual_patreon_client_id
PATREON_CLIENT_SECRET=your_actual_patreon_client_secret
PATREON_REDIRECT_URI=https://vamarequests.com/api/auth/callback
PATREON_CREATOR_ID=your_patreon_creator_id

# Admin access (REQUIRED - your Patreon user ID)
ADMIN_PATREON_ID=your_patreon_user_id

# Database (verify this is correct)
DATABASE_URL=postgresql://postgres:your_password@localhost/vamasubmissions

# Security (generate new key if using default)
SECRET_KEY=generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# Application
ENVIRONMENT=production
FRONTEND_URL=https://vamarequests.com

# File uploads
UPLOAD_DIR=./uploads
MAX_IMAGE_SIZE_MB=10
MAX_IMAGES_PER_SUBMISSION=20
```

**Generate a secure SECRET_KEY:**

```bash
openssl rand -hex 32
```

### 6. Update Frontend Environment

**Frontend `.env` - Disable mock auth:**

```bash
cd ../frontend
nano .env  # or vim .env
```

**Update to:**

```bash
VITE_API_URL=https://vamarequests.com
VITE_USE_MOCK_AUTH=false
```

### 7. Rebuild Frontend

```bash
cd frontend
npm install  # Install any new dependencies
npm run build  # Build production bundle

# Copy to nginx directory (adjust path as needed)
sudo rm -rf /var/www/vamarequests.com/html/*
sudo cp -r dist/* /var/www/vamarequests.com/html/
```

### 8. Restart Backend Service

```bash
# Restart the backend service
sudo systemctl restart vamasubmissions-backend

# Check status
sudo systemctl status vamasubmissions-backend

# Check logs for errors
sudo journalctl -u vamasubmissions-backend -n 50 --no-pager
```

### 9. Verify Deployment

**Test the following:**

1. **Frontend loads:** https://vamarequests.com
2. **API health:** https://vamarequests.com/api/health (or check /docs)
3. **Patreon OAuth login:**
   - Click "Login with Patreon"
   - Should redirect to Patreon
   - After authorization, should redirect back and show your tier
4. **Browse tab:** Should see Characters/Series/Tags tabs
5. **Date sorting:** Try "Date (Oldest First)" and "Date (Newest First)"
6. **Search functionality:** Search for a character/series
7. **Admin access (if you're admin):** Check if "Import Posts" tab appears

### 10. Troubleshooting

**If backend won't start:**

```bash
# Check logs
sudo journalctl -u vamasubmissions-backend -n 100 --no-pager

# Common issues:
# 1. Missing slowapi module
cd backend && source venv/bin/activate && pip install slowapi==0.1.9

# 2. Database migration not run
sudo -u postgres psql vamasubmissions -f backend/alembic/versions/006_add_tier_name.sql

# 3. Invalid environment variables
cd backend && cat .env  # Check for typos
```

**If OAuth fails:**

```bash
# Check Patreon Developer Portal
# 1. Verify redirect URI is: https://vamarequests.com/api/auth/callback
# 2. Verify Client ID and Secret match your .env
# 3. Check backend logs for OAuth errors:
sudo journalctl -u vamasubmissions-backend -f  # Follow logs in real-time
```

**If tier restriction blocks you:**

```bash
# Check your tier in database
sudo -u postgres psql vamasubmissions -c "SELECT email, tier, tier_name FROM users WHERE email = 'your@email.com';"

# If you're Tier 1 (free), you'll be blocked unless you're an admin
# Verify ADMIN_PATREON_ID matches your Patreon user ID
```

**If frontend shows old version:**

```bash
# Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
# Or check if nginx is serving old files:
ls -la /var/www/vamarequests.com/html/

# Rebuild and redeploy frontend:
cd frontend
npm run build
sudo rm -rf /var/www/vamarequests.com/html/*
sudo cp -r dist/* /var/www/vamarequests.com/html/
```

---

## Getting Patreon OAuth Credentials

### 1. Get Client ID and Secret

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Find your existing client or create a new one
3. **Important:** Set Redirect URI to: `https://vamarequests.com/api/auth/callback`
4. Copy the Client ID and Client Secret

### 2. Get Creator ID

**Option A: From Patreon API**

```bash
# Use your access token from the developer portal
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://www.patreon.com/api/oauth2/v2/identity
```

Look for `"id"` in the response.

**Option B: From Patreon URL**

Your Creator ID is in your Patreon page URL:
- URL: `https://www.patreon.com/c/vama_art_12345678`
- Creator ID: `12345678`

### 3. Get Your Patreon User ID (for ADMIN_PATREON_ID)

**After logging in once with Patreon OAuth:**

```bash
# Check the database for your user ID
sudo -u postgres psql vamasubmissions -c "SELECT patreon_id, email, tier FROM users WHERE email = 'your@email.com';"
```

Copy the `patreon_id` value and set it as `ADMIN_PATREON_ID` in backend `.env`.

---

## Post-Deployment Checklist

- [ ] Database backup created
- [ ] Latest code pulled from master
- [ ] Database migration 006_add_tier_name.sql applied
- [ ] Backend dependencies updated (slowapi installed)
- [ ] Backend .env updated with real Patreon credentials
- [ ] Frontend .env updated (VITE_USE_MOCK_AUTH=false)
- [ ] Frontend rebuilt and deployed
- [ ] Backend service restarted
- [ ] Frontend loads at https://vamarequests.com
- [ ] Patreon OAuth login works
- [ ] Browse tab displays correctly
- [ ] Date sorting works (oldest/newest)
- [ ] Search functionality works
- [ ] Admin access verified (if applicable)
- [ ] No errors in backend logs

---

## New Features in This Update

### 1. Browse Tab
- Explore characters, series, and tags with post counts
- Click any item to apply it as a search filter
- Pagination for large datasets

### 2. Improved UX
- Edit suggestions now inline (no modal popup)
- Pending edits display with visual indicators
- "Mark as Done" confirmation inline
- Better text contrast (no white on white)

### 3. Tier System
- Display actual Patreon tier names (e.g., "NSFW Art! Tier 1")
- Access restricted to paid tiers (Tier 2+)
- Admin bypass for testing

### 4. Data Normalization
- Prevents duplicate characters/series/tags (whitespace, case, unicode)
- Rate limiting for API endpoints (100/min general, 10/min expensive)

### 5. Date Sorting
- Fixed "Date (Oldest First)" and "Date (Newest First)" sorting

---

## Rollback Instructions (If Needed)

If something goes wrong:

```bash
# Restore database
sudo -u postgres psql vamasubmissions < ~/backup-YYYYMMDD-HHMMSS.sql

# Revert code
git log --oneline -10  # Find the commit to revert to
git reset --hard COMMIT_HASH

# Rebuild and restart
cd frontend && npm run build
sudo cp -r dist/* /var/www/vamarequests.com/html/
sudo systemctl restart vamasubmissions-backend
```

---

## Support

If you encounter issues:

1. Check logs: `sudo journalctl -u vamasubmissions-backend -n 100`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables: `cd backend && cat .env`
4. Check database: `sudo -u postgres psql vamasubmissions`
5. Review PROJECT_PLAN.md for business rules and API reference

---

## Importing Real Data (Thumbnails)

Your current database likely has **test thumbnail URLs** pointing to `localhost:8000/static/thumbnails/`.

For production, you need **real Patreon thumbnail URLs** from your JSON files.

**See detailed guide:** `deployment-scripts/REAL-DATA-SETUP.md`

**Quick version:**

```bash
# 1. Transfer data files to server
rsync -avz vama_posts_initial.csv your-user@vamarequests.com:/path/to/vamasubmissions/
rsync -avz all-post-api/ your-user@vamarequests.com:/path/to/vamasubmissions/all-post-api/

# 2. On server: backup and clear test data
sudo -u postgres pg_dump vamasubmissions > ~/backup-before-real-data.sql
sudo -u postgres psql vamasubmissions -c "TRUNCATE posts CASCADE;"

# 3. Import real data
cd /path/to/vamasubmissions
source backend/venv/bin/activate
DATABASE_URL='postgresql://postgres:password@localhost/vamasubmissions' \
  python3 backend/import_posts.py \
  --csv vama_posts_initial.csv \
  --json-dir all-post-api

# 4. Verify
psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"  # Should show ~2700
```

**Important:** You do NOT need to download thumbnails. The database stores Patreon CDN URLs, and the frontend displays them directly from Patreon's servers.

---

## Next Steps After Deployment

Once deployed successfully:

1. **Import real data** (see above) - replace test thumbnails with real URLs
2. **Test all user flows** (search, requests, edits)
3. **Test admin flows** (import posts, review edits)
4. **Verify thumbnails display** from Patreon's CDN
5. **Monitor logs** for errors or unusual activity
6. **Set up automated backups** (if not already configured)
7. **Consider implementing** remaining priorities:
   - Global edit suggestions (bulk rename)
   - Email notifications
   - Discord integration
