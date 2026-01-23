# Real Data Setup Guide

This guide explains how the application handles thumbnails and what you need to do to use real Patreon data.

---

## Current Data Architecture

### Database Structure

The `posts` table stores URLs for images, not the actual files:

```sql
posts (
  id SERIAL PRIMARY KEY,
  post_id VARCHAR(255),          -- Patreon post ID (e.g., "129090487")
  title TEXT,
  characters TEXT[],
  series TEXT[],
  tags TEXT[],
  image_urls TEXT[],             -- Array of full-size image URLs
  thumbnail_urls TEXT[],         -- Array of thumbnail URLs
  url TEXT,                      -- Link to Patreon post
  timestamp TIMESTAMP,
  ...
)
```

### Example Data

```sql
post_id:  129090487
title:    "Sailor pluto 481 pics"
image_urls: [
  "https://c10.patreonusercontent.com/.../1.png?token-hash=...",
  "https://c10.patreonusercontent.com/.../2.png?token-hash=...",
  ...
]
thumbnail_urls: [
  "http://localhost:8000/static/thumbnails/Akali_04.jpg",  -- TEST DATA
  ...
]
```

---

## Current State: Test Data vs Real Data

### What You Have Now (Test Data)

Your current database has:
- ✅ **Real Patreon image URLs** in `image_urls` column
- ❌ **Fake local thumbnail URLs** in `thumbnail_urls` column pointing to `localhost:8000/static/thumbnails/`

Example:
```
image_urls:     ["https://c10.patreonusercontent.com/.../1.png?token-hash=..."]
thumbnail_urls: ["http://localhost:8000/static/thumbnails/Akali_04.jpg"]  ← FAKE
```

### What You Need (Real Data)

For production, you need:
- ✅ **Real Patreon image URLs** in `image_urls` (already have this!)
- ✅ **Real Patreon thumbnail URLs** in `thumbnail_urls` (need to update this)

Example:
```
image_urls:     ["https://c10.patreonusercontent.com/.../1.png?token-hash=..."]
thumbnail_urls: ["https://c10.patreonusercontent.com/.../thumb.jpg?token-hash=..."]  ← REAL
```

---

## How the Application Uses Thumbnails

### Frontend Display

**SearchResults.jsx / PostCard.jsx:**
```javascript
// Displays the first thumbnail from the array
<img src={post.thumbnail_urls[0]} alt={post.title} />
```

**What this means:**
- The app displays `thumbnail_urls[0]` (first thumbnail) for each post
- It does NOT download or host images locally
- It just renders the URL directly in the browser
- The browser fetches the image from Patreon's CDN

### Why This Works

Patreon's image URLs are **public CDN links** that work from any browser:
- ✅ No authentication required to view
- ✅ Token is embedded in the URL
- ✅ Works from any domain (CORS-friendly)
- ✅ Fast CDN delivery

---

## Solution: Update Database with Real Thumbnail URLs

You have two options:

### Option 1: Re-import from JSON Files (Recommended)

Your `all-post-api/` directory contains JSON files with the real thumbnail URLs. Just re-run the import script:

**On your server:**

```bash
# 1. Backup current database
sudo -u postgres pg_dump vamasubmissions > ~/backup-before-reimport.sql

# 2. Clear posts table (keeps users, edits, requests)
sudo -u postgres psql vamasubmissions -c "TRUNCATE posts CASCADE;"

# 3. Re-import with real data
cd /path/to/vamasubmissions
source backend/venv/bin/activate
DATABASE_URL='postgresql://postgres:password@localhost/vamasubmissions' \
  python3 backend/import_posts.py \
  --csv vama_posts_initial.csv \
  --json-dir all-post-api
```

**What this does:**
- Reads `vama_posts_initial.csv` for character/series data
- Reads `all-post-api/*.json` for URLs and metadata
- Extracts **real thumbnail URLs** from JSON files
- Inserts into database with correct URLs

### Option 2: Update Existing Database (SQL Script)

If you want to keep existing data and just fix the thumbnail URLs, you can run a SQL update script.

**First, verify your JSON files have real thumbnails:**

```bash
# Check a sample JSON file
cd all-post-api
cat "129090487 - "*.json | jq '.included[] | select(.type=="media") | .attributes.image_urls.thumbnail' | head -5
```

**Then create and run an update script:**

```python
# update_thumbnails.py
import json
import psycopg2
from pathlib import Path

DB_URL = 'postgresql://postgres:password@localhost/vamasubmissions'
JSON_DIR = Path('all-post-api')

conn = psycopg2.connect(DB_URL)
cursor = conn.cursor()

# Get all posts
cursor.execute("SELECT id, post_id FROM posts")
posts = cursor.fetchall()

for db_id, post_id in posts:
    # Find JSON file
    json_files = list(JSON_DIR.glob(f"{post_id} - *.json"))
    if not json_files:
        print(f"No JSON for {post_id}")
        continue
    
    # Load JSON
    with open(json_files[0], 'r') as f:
        data = json.load(f)
    
    # Extract thumbnail URLs
    thumbnails = []
    for item in data.get('included', []):
        if item.get('type') == 'media':
            img_urls = item.get('attributes', {}).get('image_urls', {})
            if 'thumbnail' in img_urls:
                thumbnails.append(img_urls['thumbnail'])
            elif 'thumbnail_large' in img_urls:
                thumbnails.append(img_urls['thumbnail_large'])
    
    if thumbnails:
        cursor.execute(
            "UPDATE posts SET thumbnail_urls = %s WHERE id = %s",
            (thumbnails, db_id)
        )
        print(f"Updated {post_id}: {len(thumbnails)} thumbnails")

conn.commit()
cursor.close()
conn.close()
print("Done!")
```

---

## What About Downloaded Thumbnails?

### You DON'T Need to Download Thumbnails

**Why?**
- Patreon's CDN URLs work directly in the browser
- No need to host images yourself
- Saves server storage and bandwidth
- Faster delivery (Patreon's CDN is optimized)

### If You Want to Host Thumbnails Locally (Optional)

Only do this if:
- Patreon URLs expire or break
- You want full control over image delivery
- You need to resize/optimize images

**Steps:**

1. **Download thumbnails from Patreon:**
```bash
# Using gallery-dl or wget
mkdir -p backend/static/thumbnails

# For each post, download thumbnail
wget "https://c10.patreonusercontent.com/.../thumb.jpg?token-hash=..." \
  -O backend/static/thumbnails/129090487_thumb.jpg
```

2. **Update database to point to local files:**
```sql
UPDATE posts 
SET thumbnail_urls = ARRAY['https://vamarequests.com/static/thumbnails/' || post_id || '_thumb.jpg']
WHERE post_id = '129090487';
```

3. **Configure nginx to serve static files:**
```nginx
location /static/thumbnails/ {
    alias /path/to/backend/static/thumbnails/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

**But again, this is NOT necessary.** Using Patreon's CDN URLs is simpler and better.

---

## Recommended Approach

### For Production Deployment

**Use Patreon's CDN URLs directly (Option 1 above):**

1. ✅ Copy `vama_posts_initial.csv` to server
2. ✅ Copy `all-post-api/` directory to server
3. ✅ Run `import_posts.py` to populate database with real URLs
4. ✅ Frontend displays thumbnails from Patreon's CDN
5. ✅ No local image hosting needed

**Advantages:**
- Simple setup
- No storage costs
- Fast CDN delivery
- Automatic image optimization by Patreon

**Disadvantages:**
- Dependent on Patreon's CDN
- URLs might expire (but they're long-lived)

---

## Step-by-Step: Deploy with Real Data

### 1. Prepare Data Files

**On your local machine:**

```bash
# Verify you have the data files
ls -lh vama_posts_initial.csv
ls -lh all-post-api/ | head

# Check CSV has all posts
wc -l vama_posts_initial.csv  # Should show ~2700 lines

# Check JSON directory has all posts
ls all-post-api/*.json | wc -l  # Should show ~2700 files
```

### 2. Transfer Data to Server

```bash
# Option A: Using rsync (recommended)
rsync -avz --progress vama_posts_initial.csv your-user@vamarequests.com:/path/to/vamasubmissions/
rsync -avz --progress all-post-api/ your-user@vamarequests.com:/path/to/vamasubmissions/all-post-api/

# Option B: Using scp
scp vama_posts_initial.csv your-user@vamarequests.com:/path/to/vamasubmissions/
scp -r all-post-api/ your-user@vamarequests.com:/path/to/vamasubmissions/
```

### 3. Import Data on Server

**SSH into server:**

```bash
ssh your-user@vamarequests.com
cd /path/to/vamasubmissions

# Backup current database
sudo -u postgres pg_dump vamasubmissions > ~/backup-before-real-data-$(date +%Y%m%d).sql

# Clear test data (keeps users, edits, requests)
sudo -u postgres psql vamasubmissions -c "TRUNCATE posts CASCADE;"

# Verify data files are present
ls -lh vama_posts_initial.csv
ls -lh all-post-api/ | head

# Import real data
source backend/venv/bin/activate
DATABASE_URL='postgresql://postgres:your_password@localhost/vamasubmissions' \
  python3 backend/import_posts.py \
  --csv vama_posts_initial.csv \
  --json-dir all-post-api

# Verify import
psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"  # Should show ~2700
psql vamasubmissions -c "SELECT post_id, title, thumbnail_urls[1] FROM posts LIMIT 3;"
```

### 4. Verify Thumbnails Work

**Check a few thumbnail URLs:**

```bash
# Get some thumbnail URLs from database
psql vamasubmissions -c "SELECT thumbnail_urls[1] FROM posts WHERE thumbnail_urls IS NOT NULL LIMIT 5;"

# Test if they load (should return 200 OK)
curl -I "https://c10.patreonusercontent.com/.../thumb.jpg?token-hash=..."
```

**Visit your site:**
- Go to https://vamarequests.com
- Search for a character
- Thumbnails should display from Patreon's CDN
- Open browser DevTools > Network tab
- Verify images load from `c10.patreonusercontent.com`

---

## Troubleshooting

### Thumbnails Don't Display

**Check 1: Verify URLs in database**
```sql
SELECT post_id, title, thumbnail_urls[1] 
FROM posts 
WHERE thumbnail_urls IS NOT NULL 
LIMIT 5;
```

**Check 2: Test URL directly**
```bash
# Copy a thumbnail URL from database and test:
curl -I "https://c10.patreonusercontent.com/.../thumb.jpg?token-hash=..."
```

**Check 3: Browser console errors**
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed image requests

### Patreon URLs Return 403 Forbidden

**Cause:** Token expired or invalid

**Solution:** Re-fetch data from Patreon API using gallery-dl:
```bash
gallery-dl --cookies-from-browser firefox "https://www.patreon.com/vama_art/posts"
```

### Images Load Slowly

**Cause:** Patreon's CDN might be slow for your region

**Solution:** Consider hosting thumbnails locally (see "If You Want to Host Thumbnails Locally" above)

---

## Summary

### Current Setup (Test Data)
```
Database: thumbnail_urls = ["http://localhost:8000/static/thumbnails/Akali_04.jpg"]
                                    ↑ FAKE - doesn't work in production
```

### Production Setup (Real Data)
```
Database: thumbnail_urls = ["https://c10.patreonusercontent.com/.../thumb.jpg?token-hash=..."]
                                    ↑ REAL - works from any browser
```

### What You Need to Do

1. ✅ Transfer `vama_posts_initial.csv` and `all-post-api/` to server
2. ✅ Run `import_posts.py` to populate database with real URLs
3. ✅ Verify thumbnails display from Patreon's CDN
4. ✅ No local image hosting needed!

### Key Takeaway

**You don't need to download or host thumbnails yourself.** The database just stores URLs, and the frontend displays them directly from Patreon's CDN. This is simpler, faster, and uses less server resources.
