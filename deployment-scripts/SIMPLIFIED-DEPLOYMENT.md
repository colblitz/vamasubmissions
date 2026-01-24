# Simplified Deployment Guide

**Much simpler approach:** Export from local DB, upload SQL dump + thumbnails, import on server.

---

## Overview

Instead of transferring CSV/JSON files and importing, we'll:
1. Export your local database to SQL
2. Upload SQL dump + thumbnails to server
3. Import SQL dump on server
4. Update code and restart

**Estimated time:** 20-30 minutes (after thumbnail upload completes)

---

## Part 1: Prepare Data (LOCAL MACHINE)

### Step 1: Export Database to SQL

**On your local machine:**

```bash
cd ~/projects/vamasubmissions

# Export your user + all posts with static thumbnail URLs
python3 backend/export_production_data.py --user-email your@email.com

# This creates: production_data.sql
```

**What this does:**
- Exports your user account (only yours, no test users)
- Exports all posts from local database
- Updates thumbnail URLs to use static format: `https://vamarequests.com/static/thumbnails/{post_id}-thumbnail-square.jpg`
- Creates clean SQL ready to import

**Output:** `production_data.sql` (~5-10 MB)

### Step 2: Verify Thumbnails Are Ready

```bash
# Check thumbnail upload status
# Should be complete by now: all-thumbnails-square-148957454.zip
```

---

## Part 2: Transfer to Server (LOCAL MACHINE)

### Step 3: Upload SQL Dump

```bash
# Upload production data SQL
rsync -avz --progress production_data.sql deploy@45.33.94.21:~/
```

**Estimated time:** 1-2 minutes (small file)

---

## Part 3: Server Setup (REMOTE SERVER)

### Step 4: SSH Into Server

```bash
ssh deploy@45.33.94.21
cd ~/vamasubmissions
```

**All remaining steps run on the server.**

---

### Step 5: Extract Thumbnails

```bash
# Create thumbnails directory
mkdir -p backend/static/thumbnails

# Extract zip file (should already be uploaded)
unzip ~/all-thumbnails-square-148957454.zip -d backend/static/thumbnails/

# Verify extraction
ls backend/static/thumbnails/*.jpg | wc -l  # Should show ~2700

# Fix permissions
chmod 755 backend/static/thumbnails
chmod 644 backend/static/thumbnails/*
```

---

### Step 6: Update Code

```bash
# Pull latest code
git fetch origin
git pull origin master

# Show what changed
git log --oneline -5
```

**Latest commits:**
- Thumbnail format update
- Deployment guides
- Browse tab
- Data normalization
- UX improvements

---

### Step 7: Run All Migrations

```bash
# Run all migrations (idempotent - safe to re-run)
./deployment-scripts/run_all_migrations.sh
```

**This runs all 7 migrations in order:**
1. `001_add_oauth_tokens.sql`
2. `002_add_phase1_tables.sql`
3. `003_add_post_status_and_raw_json.sql`
4. `004_create_admin_settings.sql`
5. `005_add_skipped_status.sql`
6. `006_add_tier_name.sql`
7. `007_add_patreon_session_id.sql`

**Note:** Migrations are mostly idempotent (use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.). Safe to re-run.

---

### Step 8: Clean Database & Import Production Data

```bash
# Backup current database (just in case)
sudo -u postgres pg_dump vamasubmissions > ~/backup-before-import-$(date +%Y%m%d).sql

# Clean existing data
sudo -u postgres psql vamasubmissions << EOF
-- Delete all existing data
TRUNCATE posts CASCADE;
DELETE FROM edit_suggestions;
DELETE FROM edit_history;
DELETE FROM community_requests;
DELETE FROM users;

-- Verify clean
SELECT 'Posts:' as table, COUNT(*) as count FROM posts
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Edits:', COUNT(*) FROM edit_suggestions
UNION ALL
SELECT 'Requests:', COUNT(*) FROM community_requests;
EOF

# Import production data
sudo -u postgres psql vamasubmissions < ~/production_data.sql

# Verify import
sudo -u postgres psql vamasubmissions << EOF
SELECT 'Posts imported:' as info, COUNT(*) as count FROM posts;
SELECT 'Users imported:' as info, COUNT(*) as count FROM users;
SELECT 'Sample post:' as info, post_id, title FROM posts LIMIT 1;
SELECT 'Sample thumbnail:' as info, thumbnail_urls[1] FROM posts LIMIT 1;
EOF
```

**Expected output:**
- Posts: ~2700
- Users: 1 (you)
- Thumbnail URL: `https://vamarequests.com/static/thumbnails/129090487-thumbnail-square.jpg`

---

### Step 9: Update Backend Dependencies

```bash
cd backend
source venv/bin/activate

# Install new dependencies
pip install -r requirements.txt

# Verify slowapi installed
pip list | grep slowapi  # Should show: slowapi==0.1.9

cd ..
```

---

### Step 10: Configure Environment Variables

#### Backend `.env`

```bash
cd backend
nano .env  # or vim .env
```

**Update these critical values:**

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost/vamasubmissions

# Patreon OAuth (REQUIRED)
PATREON_CLIENT_ID=your_actual_client_id
PATREON_CLIENT_SECRET=your_actual_client_secret
PATREON_REDIRECT_URI=https://vamarequests.com/api/auth/callback
PATREON_CREATOR_ID=your_creator_id

# Admin access (REQUIRED - your Patreon user ID)
ADMIN_PATREON_ID=your_patreon_user_id

# Security (generate new key)
SECRET_KEY=$(openssl rand -hex 32)
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

**Generate SECRET_KEY:**
```bash
openssl rand -hex 32
```

**Save and exit** (Ctrl+O, Enter, Ctrl+X)

#### Frontend `.env`

```bash
cd ../frontend
nano .env
```

**Set to:**

```bash
VITE_API_URL=https://vamarequests.com
VITE_USE_MOCK_AUTH=false
```

**Save and exit**

---

### Step 11: Configure Nginx for Static Thumbnails

```bash
sudo nano /etc/nginx/sites-available/vamarequests.com
```

**Add this location block** (if not already present):

```nginx
server {
    listen 80;
    server_name vamarequests.com;

    # Frontend
    location / {
        root /var/www/vamarequests.com/html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static thumbnails (ADD THIS IF NOT PRESENT)
    location /static/thumbnails/ {
        alias /home/deploy/vamasubmissions/backend/static/thumbnails/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        gzip on;
        gzip_types image/jpeg image/png image/webp;
    }
}
```

**Test and reload:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 12: Rebuild Frontend

```bash
cd ~/vamasubmissions/frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to nginx
sudo rm -rf /var/www/vamarequests.com/html/*
sudo cp -r dist/* /var/www/vamarequests.com/html/

# Verify
ls -la /var/www/vamarequests.com/html/
```

---

### Step 13: Restart Backend

```bash
# Restart backend service
sudo systemctl restart vamasubmissions-backend

# Check status
sudo systemctl status vamasubmissions-backend

# Check logs
sudo journalctl -u vamasubmissions-backend -n 50 --no-pager
```

---

### Step 14: Verify Deployment

#### Test Backend

```bash
# Test backend health
curl http://localhost:8000/docs  # Should return HTML
```

#### Test Static Thumbnails

```bash
# Get a post ID
sudo -u postgres psql vamasubmissions -c "SELECT post_id FROM posts LIMIT 1;"

# Test thumbnail (replace POST_ID)
curl -I https://vamarequests.com/static/thumbnails/POST_ID-thumbnail-square.jpg

# Should return: HTTP/1.1 200 OK
```

#### Test Frontend (in browser)

1. Visit **https://vamarequests.com**
2. Should see updated site
3. Click **"Login with Patreon"**
4. Should redirect to Patreon OAuth
5. After login, should show your tier name
6. **Search** for a character → thumbnails should display
7. Open **DevTools > Network** → verify images load from `vamarequests.com/static/thumbnails/`
8. Test **Browse tab** → should show Characters/Series/Tags
9. Test **Date sorting** → "Oldest First" and "Newest First" should work

---

### Step 15: Monitor Logs

```bash
# Watch backend logs
sudo journalctl -u vamasubmissions-backend -f

# In another terminal, watch nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
sudo journalctl -u vamasubmissions-backend -n 100 --no-pager

# Common fixes:
# 1. Missing slowapi
cd ~/vamasubmissions/backend && source venv/bin/activate && pip install slowapi==0.1.9

# 2. Check .env file
cat ~/vamasubmissions/backend/.env
```

### Thumbnails Don't Display

```bash
# Check files exist
ls ~/vamasubmissions/backend/static/thumbnails/*.jpg | wc -l  # Should be ~2700

# Check permissions
ls -la ~/vamasubmissions/backend/static/thumbnails/ | head -5

# Fix permissions
chmod 755 ~/vamasubmissions/backend/static/thumbnails
chmod 644 ~/vamasubmissions/backend/static/thumbnails/*

# Test nginx config
sudo nginx -t
```

### OAuth Login Fails

```bash
# Check backend logs
sudo journalctl -u vamasubmissions-backend -f

# Verify Patreon settings at:
# https://www.patreon.com/portal/registration/register-clients
# - Redirect URI must be: https://vamarequests.com/api/auth/callback
```

---

## Getting Patreon OAuth Credentials

### 1. Client ID & Secret

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Find your client or create new
3. Set Redirect URI: `https://vamarequests.com/api/auth/callback`
4. Copy Client ID and Secret

### 2. Creator ID

From your Patreon URL: `https://www.patreon.com/vama_art`
- The creator ID is in the URL or visible in your account settings

### 3. Your Patreon User ID (for ADMIN_PATREON_ID)

**After first login:**

```bash
sudo -u postgres psql vamasubmissions -c "SELECT patreon_id, email FROM users WHERE email = 'your@email.com';"
```

Copy the `patreon_id` and add to `backend/.env` as `ADMIN_PATREON_ID`.

---

## Summary

### What We Did

✅ Exported local database to SQL (with static thumbnail URLs)
✅ Uploaded SQL dump to server
✅ Extracted thumbnails to correct location
✅ Updated code to latest version
✅ Ran all database migrations
✅ Imported production data (your user + all posts)
✅ Updated dependencies
✅ Configured environment variables
✅ Configured nginx for static files
✅ Rebuilt and deployed frontend
✅ Restarted backend
✅ Verified everything works

### What You're Running

- **~2700 posts** with real data
- **~2700 static thumbnails** (no Patreon URL expiration)
- **Real Patreon OAuth** (no mock auth)
- **Your user account** (no test users)
- **Latest features:**
  - Browse tab
  - Fixed date sorting
  - Data normalization
  - Tier-based access control
  - Improved UX

### Total Time

- **Data export:** 2 minutes
- **Upload SQL:** 2 minutes
- **Server setup:** 15-20 minutes
- **Total:** ~20-30 minutes

---

## Key Differences from Original Plan

**OLD approach:**
- Transfer CSV + JSON files
- Run import_posts.py on server
- More steps, more files to transfer

**NEW approach (BETTER):**
- Export from local DB to SQL
- Transfer one SQL file
- Import directly
- Cleaner, faster, less error-prone

**Benefits:**
- ✅ No need for CSV/JSON files
- ✅ Thumbnail URLs already correct in SQL
- ✅ Only your user exported (no test data)
- ✅ One import command
- ✅ Faster and simpler

---

## Next Steps

Once deployed:
1. Test all features thoroughly
2. Monitor logs for any issues
3. Set up automated backups (if not already)
4. Consider implementing remaining features from PROJECT_PLAN.md

**You're done! 🎉**
