# Complete Deployment Checklist

This is your step-by-step guide to deploy the latest code with real data to vamarequests.com.

**Current Status:** Thumbnails zip file uploading to server

---

## Prerequisites

✅ Thumbnails zip uploaded to server (in progress)
⬜ SSH access to server: `ssh deploy@45.33.94.21`
⬜ Local files ready: `vama_posts_initial.csv`, `all-post-api/`

---

## Step 1: Transfer Data Files to Server

**On your local machine:**

```bash
# Transfer CSV file
rsync -avz --progress vama_posts_initial.csv deploy@45.33.94.21:~/vamasubmissions/

# Transfer JSON directory
rsync -avz --progress all-post-api/ deploy@45.33.94.21:~/vamasubmissions/all-post-api/
```

**Estimated time:** 5-10 minutes (these are smaller files)

---

## Step 2: SSH Into Server

```bash
ssh deploy@45.33.94.21
cd ~/vamasubmissions
```

---

## Step 3: Extract Thumbnails to Correct Location

```bash
# Create thumbnails directory if it doesn't exist
mkdir -p backend/static/thumbnails

# Extract zip file
unzip ~/all-thumbnails-square-148957454.zip -d backend/static/thumbnails/

# Verify extraction
ls -lh backend/static/thumbnails/ | head -10
ls backend/static/thumbnails/*.jpg | wc -l  # Should show ~2700
```

---

## Step 4: Update Code to Latest Version

```bash
# Backup current state
git stash save "Pre-deployment backup $(date +%Y%m%d-%H%M%S)"

# Pull latest code
git fetch origin
git pull origin master

# Show what changed
git log --oneline -10
```

**Latest commits you're pulling:**
- `c373e0b` - Thumbnail format update (thumbnail-square)
- `cee5e43` - Deployment guides and scripts
- `9f92308` - Browse tab UX improvements
- `f0dbb16` - Browse Tab implementation
- `1c42c5c` - Data normalization
- `315c4b4` - Database migration docs
- `76d4c08` - Major UX improvements and tier access

---

## Step 5: Run Database Migrations

```bash
# Check if tier_name column exists
sudo -u postgres psql vamasubmissions -c "\d users" | grep tier_name

# If not, run the migration
sudo -u postgres psql vamasubmissions -f backend/alembic/versions/006_add_tier_name.sql

# Verify migration
sudo -u postgres psql vamasubmissions -c "SELECT tier, tier_name FROM users LIMIT 5;"
```

---

## Step 6: Clean Test Data

**Find your user ID:**

```bash
sudo -u postgres psql vamasubmissions -c "SELECT id, email, patreon_id, tier FROM users;"
```

**Note your user ID** (e.g., `123`)

**Clean test data:**

```bash
# Use the provided script (replace 123 with your actual user ID)
./deployment-scripts/clean_test_data.sh 123

# Or manually:
sudo -u postgres psql vamasubmissions << EOF
-- Backup first
\copy users TO '/tmp/users_backup.csv' CSV HEADER;
\copy edit_suggestions TO '/tmp/edits_backup.csv' CSV HEADER;
\copy community_requests TO '/tmp/requests_backup.csv' CSV HEADER;

-- Delete test data
DELETE FROM edit_suggestions;
DELETE FROM edit_history;
DELETE FROM community_requests;
DELETE FROM users WHERE id != 123;  -- Replace with your ID
TRUNCATE posts CASCADE;

-- Verify
SELECT 'Users remaining:' as info, COUNT(*) as count FROM users;
SELECT 'Posts remaining:' as info, COUNT(*) as count FROM posts;
EOF
```

---

## Step 7: Update Backend Dependencies

```bash
cd backend
source venv/bin/activate

# Install new dependencies (slowapi for rate limiting)
pip install -r requirements.txt

# Verify slowapi is installed
pip list | grep slowapi  # Should show: slowapi==0.1.9

cd ..
```

---

## Step 8: Configure Environment Variables

### Backend `.env` File

```bash
cd backend
nano .env  # or vim .env
```

**Update these values:**

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost/vamasubmissions

# Patreon OAuth (REQUIRED - get from https://www.patreon.com/portal/registration/register-clients)
PATREON_CLIENT_ID=your_actual_patreon_client_id
PATREON_CLIENT_SECRET=your_actual_patreon_client_secret
PATREON_REDIRECT_URI=https://vamarequests.com/api/auth/callback
PATREON_CREATOR_ID=your_patreon_creator_id

# Admin access (REQUIRED - your Patreon user ID)
ADMIN_PATREON_ID=your_patreon_user_id

# Security (generate new key if using default)
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

**Generate a secure SECRET_KEY:**

```bash
openssl rand -hex 32
```

**Save and exit** (Ctrl+O, Enter, Ctrl+X for nano)

### Frontend `.env` File

```bash
cd ../frontend
nano .env
```

**Update to:**

```bash
VITE_API_URL=https://vamarequests.com
VITE_USE_MOCK_AUTH=false
```

**Save and exit**

---

## Step 9: Import Posts with Static Thumbnail URLs

```bash
cd ~/vamasubmissions

# Set environment variable for static thumbnails
export STATIC_THUMBNAIL_BASE="https://vamarequests.com/static/thumbnails"

# Activate virtual environment
source backend/venv/bin/activate

# Import posts
DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@localhost/vamasubmissions' \
  python3 backend/import_posts.py \
  --csv vama_posts_initial.csv \
  --json-dir all-post-api

# Verify import
sudo -u postgres psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"  # Should show ~2700
sudo -u postgres psql vamasubmissions -c "SELECT post_id, title, thumbnail_urls[1] FROM posts LIMIT 3;"
```

**Expected output:** Should see URLs like `https://vamarequests.com/static/thumbnails/129090487-thumbnail-square.jpg`

---

## Step 10: Configure Nginx for Static Thumbnails

**Edit nginx config:**

```bash
sudo nano /etc/nginx/sites-available/vamarequests.com
```

**Add this location block** (if not already present):

```nginx
server {
    listen 80;
    server_name vamarequests.com;

    # Frontend (React app)
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

    # Static thumbnails (ADD THIS)
    location /static/thumbnails/ {
        alias /home/deploy/vamasubmissions/backend/static/thumbnails/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Optional: Enable gzip compression
        gzip on;
        gzip_types image/jpeg image/png image/webp;
    }
}
```

**Test and reload nginx:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 11: Rebuild Frontend

```bash
cd ~/vamasubmissions/frontend

# Install any new dependencies
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

## Step 12: Restart Backend Service

```bash
# Restart the backend
sudo systemctl restart vamasubmissions-backend

# Check status
sudo systemctl status vamasubmissions-backend

# Check logs for errors
sudo journalctl -u vamasubmissions-backend -n 50 --no-pager
```

---

## Step 13: Verify Deployment

### Test Backend Health

```bash
# Test backend is running
curl http://localhost:8000/docs

# Should return HTML for Swagger docs
```

### Test Static Thumbnails

```bash
# Get a post ID from database
sudo -u postgres psql vamasubmissions -c "SELECT post_id FROM posts LIMIT 1;"

# Test thumbnail URL (replace POST_ID)
curl -I https://vamarequests.com/static/thumbnails/POST_ID-thumbnail-square.jpg

# Should return: HTTP/1.1 200 OK
```

### Test Frontend

**In your browser:**

1. Visit https://vamarequests.com
2. Should see the updated site
3. Click "Login with Patreon"
4. Should redirect to Patreon OAuth
5. After login, should show your tier name
6. Search for a character
7. Thumbnails should display from your static directory
8. Open DevTools > Network tab
9. Verify images load from `vamarequests.com/static/thumbnails/`

### Test Browse Tab

1. Click "Browse" tab on search page
2. Should see Characters/Series/Tags tabs
3. Click a character
4. Should apply as filter and show results

### Test Date Sorting

1. Search for something
2. Change sort to "Date (Oldest First)"
3. Verify posts are sorted oldest to newest
4. Change to "Date (Newest First)"
5. Verify posts are sorted newest to oldest

---

## Step 14: Monitor for Issues

```bash
# Watch backend logs in real-time
sudo journalctl -u vamasubmissions-backend -f

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
sudo journalctl -u vamasubmissions-backend -n 100 --no-pager

# Common issues:
# 1. Missing slowapi module
cd ~/vamasubmissions/backend && source venv/bin/activate && pip install slowapi==0.1.9

# 2. Database migration not run
sudo -u postgres psql vamasubmissions -f backend/alembic/versions/006_add_tier_name.sql

# 3. Invalid environment variables
cd ~/vamasubmissions/backend && cat .env  # Check for typos
```

### Thumbnails Don't Display

```bash
# Check if files exist
ls ~/vamasubmissions/backend/static/thumbnails/*.jpg | wc -l  # Should be ~2700

# Check nginx config
sudo nginx -t

# Check file permissions
ls -la ~/vamasubmissions/backend/static/thumbnails/ | head -10

# Fix permissions if needed
chmod 755 ~/vamasubmissions/backend/static/thumbnails
chmod 644 ~/vamasubmissions/backend/static/thumbnails/*
```

### OAuth Login Fails

```bash
# Check Patreon Developer Portal
# 1. Verify redirect URI is: https://vamarequests.com/api/auth/callback
# 2. Verify Client ID and Secret match your .env
# 3. Check backend logs for OAuth errors:
sudo journalctl -u vamasubmissions-backend -f
```

### Tier Restriction Blocks You

```bash
# Check your tier in database
sudo -u postgres psql vamasubmissions -c "SELECT email, tier, tier_name FROM users WHERE email = 'your@email.com';"

# If you're Tier 1 (free), you'll be blocked unless you're an admin
# Verify ADMIN_PATREON_ID matches your Patreon user ID in backend/.env
```

### Frontend Shows Old Version

```bash
# Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

# Or verify nginx is serving new files:
ls -la /var/www/vamarequests.com/html/

# Rebuild and redeploy:
cd ~/vamasubmissions/frontend
npm run build
sudo rm -rf /var/www/vamarequests.com/html/*
sudo cp -r dist/* /var/www/vamarequests.com/html/
```

---

## Post-Deployment Checklist

- [ ] Thumbnails extracted to `backend/static/thumbnails/`
- [ ] Code updated to latest version
- [ ] Database migration applied (tier_name)
- [ ] Test data cleaned (only your user remains)
- [ ] Backend dependencies updated (slowapi installed)
- [ ] Backend `.env` configured with real Patreon OAuth
- [ ] Frontend `.env` configured (mock auth disabled)
- [ ] Posts imported with static thumbnail URLs (~2700 posts)
- [ ] Nginx configured to serve `/static/thumbnails/`
- [ ] Frontend rebuilt and deployed
- [ ] Backend service restarted
- [ ] Site loads at https://vamarequests.com
- [ ] Patreon OAuth login works
- [ ] Thumbnails display correctly
- [ ] Browse tab works
- [ ] Date sorting works
- [ ] Search functionality works
- [ ] Admin access verified (if applicable)
- [ ] No errors in backend logs
- [ ] No errors in nginx logs

---

## Getting Patreon OAuth Credentials

If you don't have these yet:

### 1. Get Client ID and Secret

1. Go to https://www.patreon.com/portal/registration/register-clients
2. Find your existing client or create a new one
3. **Important:** Set Redirect URI to: `https://vamarequests.com/api/auth/callback`
4. Copy the Client ID and Client Secret

### 2. Get Creator ID

**Option A: From Patreon URL**
- Your Creator ID is in your Patreon page URL
- URL: `https://www.patreon.com/vama_art` or `https://www.patreon.com/c/vama_art_12345678`
- If numeric ID is visible, that's your Creator ID

**Option B: From Patreon API**
```bash
# Use your access token from the developer portal
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://www.patreon.com/api/oauth2/v2/identity
```
Look for `"id"` in the response.

### 3. Get Your Patreon User ID (for ADMIN_PATREON_ID)

**After logging in once with Patreon OAuth:**

```bash
# Check the database for your user ID
sudo -u postgres psql vamasubmissions -c "SELECT patreon_id, email, tier FROM users WHERE email = 'your@email.com';"
```

Copy the `patreon_id` value and set it as `ADMIN_PATREON_ID` in backend `.env`.

---

## Summary

**Total estimated time:** 30-60 minutes (not including thumbnail upload)

**Steps:**
1. ✅ Transfer data files (5-10 min)
2. ✅ Extract thumbnails (2 min)
3. ✅ Update code (1 min)
4. ✅ Run migrations (1 min)
5. ✅ Clean test data (2 min)
6. ✅ Update dependencies (2 min)
7. ✅ Configure env files (5 min)
8. ✅ Import posts (5-10 min)
9. ✅ Configure nginx (2 min)
10. ✅ Rebuild frontend (3-5 min)
11. ✅ Restart backend (1 min)
12. ✅ Verify deployment (5-10 min)

**You're deploying:**
- Latest code with all improvements
- Real Patreon OAuth (no more mock auth)
- ~2700 posts with real data
- ~2700 static thumbnails
- Browse tab feature
- Fixed date sorting
- Data normalization
- Tier-based access control

**Good luck! Let me know when you're ready to start or if you hit any issues!** 🚀
