# Static Thumbnail Hosting Setup

This guide explains how to download thumbnails from Patreon and serve them statically from your own server.

---

## Architecture

### File Storage Structure

```
backend/
├── static/
│   └── thumbnails/
│       ├── 129090487-thumbnail.jpg
│       ├── 130938449-thumbnail.jpg
│       ├── 148782465-thumbnail.jpg
│       └── ... (one file per post)
```

### Database URLs

```sql
-- Instead of Patreon CDN URLs:
thumbnail_urls = ["https://c10.patreonusercontent.com/.../thumb.jpg?token=..."]

-- Use your own static URLs:
thumbnail_urls = ["https://vamarequests.com/static/thumbnails/129090487-thumbnail.jpg"]
```

### Nginx Configuration

Nginx serves the static files directly (fast, no backend involvement):

```nginx
location /static/thumbnails/ {
    alias /path/to/backend/static/thumbnails/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## Step 1: Create Thumbnail Directory

**On your server:**

```bash
cd /path/to/vamasubmissions
mkdir -p backend/static/thumbnails
chmod 755 backend/static/thumbnails
```

---

## Step 2: Download Thumbnails from Patreon

### Option A: Using gallery-dl (Recommended)

**Install gallery-dl:**

```bash
pip install gallery-dl
```

**Download all post thumbnails:**

```bash
# Create a config file for gallery-dl
cat > gallery-dl.conf << 'EOF'
{
    "extractor": {
        "patreon": {
            "files": ["images"],
            "filename": "{id}-thumbnail.{extension}",
            "directory": ["backend/static/thumbnails/"]
        }
    }
}
EOF

# Download thumbnails (requires Patreon login)
gallery-dl --config gallery-dl.conf \
  --cookies-from-browser firefox \
  "https://www.patreon.com/vama_art/posts"
```

### Option B: Manual Download Script

If you already have the JSON files with Patreon URLs, you can download them:

```python
# download_thumbnails.py
import json
import requests
from pathlib import Path
import time

JSON_DIR = Path('all-post-api')
OUTPUT_DIR = Path('backend/static/thumbnails')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Get all JSON files
json_files = list(JSON_DIR.glob('*.json'))
print(f"Found {len(json_files)} JSON files")

for i, json_file in enumerate(json_files, 1):
    # Extract post ID from filename
    post_id = json_file.name.split(' - ')[0]
    
    # Load JSON
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Find first thumbnail URL
    thumbnail_url = None
    for item in data.get('included', []):
        if item.get('type') == 'media':
            img_urls = item.get('attributes', {}).get('image_urls', {})
            if 'thumbnail' in img_urls:
                thumbnail_url = img_urls['thumbnail']
                break
            elif 'thumbnail_large' in img_urls:
                thumbnail_url = img_urls['thumbnail_large']
                break
    
    if not thumbnail_url:
        print(f"[{i}/{len(json_files)}] No thumbnail for {post_id}")
        continue
    
    # Download thumbnail
    output_file = OUTPUT_DIR / f"{post_id}-thumbnail.jpg"
    
    if output_file.exists():
        print(f"[{i}/{len(json_files)}] Skip {post_id} (already exists)")
        continue
    
    try:
        response = requests.get(thumbnail_url, timeout=10)
        response.raise_for_status()
        
        with open(output_file, 'wb') as f:
            f.write(response.content)
        
        print(f"[{i}/{len(json_files)}] Downloaded {post_id}")
        
        # Be nice to Patreon's servers
        time.sleep(0.5)
    
    except Exception as e:
        print(f"[{i}/{len(json_files)}] Error downloading {post_id}: {e}")

print("\nDone!")
```

**Run the script:**

```bash
cd /path/to/vamasubmissions
python3 download_thumbnails.py
```

### Option C: Copy from Existing Downloads

If you've already downloaded thumbnails elsewhere:

```bash
# Copy and rename to the correct format
for file in /path/to/downloads/*.jpg; do
    # Extract post ID from filename (adjust pattern as needed)
    post_id=$(basename "$file" | grep -oE '[0-9]+')
    cp "$file" "backend/static/thumbnails/${post_id}-thumbnail.jpg"
done
```

---

## Step 3: Update Database with Static URLs

Once thumbnails are downloaded, update the database to point to your static URLs:

```python
# update_thumbnail_urls.py
import psycopg2
from pathlib import Path

DB_URL = 'postgresql://postgres:password@localhost/vamasubmissions'
THUMBNAIL_DIR = Path('backend/static/thumbnails')
BASE_URL = 'https://vamarequests.com/static/thumbnails'

conn = psycopg2.connect(DB_URL)
cursor = conn.cursor()

# Get all posts
cursor.execute("SELECT id, post_id FROM posts")
posts = cursor.fetchall()

updated = 0
missing = 0

for db_id, post_id in posts:
    thumbnail_file = THUMBNAIL_DIR / f"{post_id}-thumbnail.jpg"
    
    if thumbnail_file.exists():
        # Update database with static URL
        static_url = f"{BASE_URL}/{post_id}-thumbnail.jpg"
        cursor.execute(
            "UPDATE posts SET thumbnail_urls = %s WHERE id = %s",
            ([static_url], db_id)
        )
        updated += 1
        
        if updated % 100 == 0:
            print(f"Updated {updated} posts...")
            conn.commit()
    else:
        print(f"Missing thumbnail for post {post_id}")
        missing += 1

conn.commit()
cursor.close()
conn.close()

print(f"\nDone!")
print(f"Updated: {updated} posts")
print(f"Missing: {missing} thumbnails")
```

**Run the script:**

```bash
cd /path/to/vamasubmissions
python3 update_thumbnail_urls.py
```

---

## Step 4: Configure Nginx to Serve Static Files

**Edit your nginx config:**

```bash
sudo nano /etc/nginx/sites-available/vamarequests.com
```

**Add this location block:**

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
    }

    # Static thumbnails (NEW)
    location /static/thumbnails/ {
        alias /path/to/vamasubmissions/backend/static/thumbnails/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Optional: Enable gzip compression for faster delivery
        gzip on;
        gzip_types image/jpeg image/png;
    }
}
```

**Test and reload nginx:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 5: Verify Thumbnails Work

**Test a thumbnail URL directly:**

```bash
# Get a post ID from database
psql vamasubmissions -c "SELECT post_id FROM posts LIMIT 1;"

# Test the URL (replace POST_ID)
curl -I https://vamarequests.com/static/thumbnails/POST_ID-thumbnail.jpg
# Should return: HTTP/1.1 200 OK
```

**Test in browser:**

1. Visit https://vamarequests.com
2. Search for a character
3. Thumbnails should display from your static directory
4. Open DevTools > Network tab
5. Verify images load from `vamarequests.com/static/thumbnails/`

---

## Clean Data Migration

You want to keep real posts but remove test data. Here's how:

### Identify Your User

**Find your Patreon user ID:**

```bash
psql vamasubmissions -c "SELECT id, patreon_id, email, tier FROM users;"
```

Note your `id` (e.g., `123`).

### Clean Test Data

```sql
-- Keep only your user, delete all others
DELETE FROM users WHERE id != 123;  -- Replace 123 with your user ID

-- Delete all test edits
DELETE FROM edit_suggestions;
DELETE FROM edit_history;

-- Delete all test community requests
DELETE FROM community_requests;

-- Keep all posts (they're real data from import)
-- Posts table is fine as-is
```

**Or run as a script:**

```bash
# clean_test_data.sh
#!/bin/bash

YOUR_USER_ID=123  # Replace with your actual user ID

psql vamasubmissions << EOF
-- Backup first
\copy users TO '/tmp/users_backup.csv' CSV HEADER;
\copy edit_suggestions TO '/tmp/edits_backup.csv' CSV HEADER;
\copy community_requests TO '/tmp/requests_backup.csv' CSV HEADER;

-- Delete test data
DELETE FROM edit_suggestions;
DELETE FROM edit_history;
DELETE FROM community_requests;
DELETE FROM users WHERE id != $YOUR_USER_ID;

-- Verify
SELECT 'Users remaining:' as info, COUNT(*) FROM users;
SELECT 'Posts remaining:' as info, COUNT(*) FROM posts;
SELECT 'Edits remaining:' as info, COUNT(*) FROM edit_suggestions;
SELECT 'Requests remaining:' as info, COUNT(*) FROM community_requests;
EOF
```

---

## Import Script Modification

Update `import_posts.py` to use static URLs instead of Patreon URLs:

```python
# In import_posts.py, modify the load_json_data function:

def load_json_data(post_id: str, json_dir: Path) -> Optional[Dict]:
    """Load JSON data for a post ID from the all-post-api directory."""
    json_files = list(json_dir.glob(f"{post_id} - *.json"))
    
    if not json_files:
        print(f"  WARNING: No JSON file found for post {post_id}")
        return None
    
    json_file = json_files[0]
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        post_data = data['data']
        attrs = post_data['attributes']
        
        url = attrs.get('url', '')
        published_at = attrs.get('published_at', '')
        title = attrs.get('title', '')
        
        # Extract media
        included = data.get('included', [])
        media_items = [
            i for i in included 
            if i.get('type') == 'media' and i.get('attributes', {}).get('media_type') == 'image'
        ]
        
        # Get image URLs from media
        image_urls = []
        
        for media in media_items:
            media_attrs = media.get('attributes', {})
            image_url_obj = media_attrs.get('image_urls', {})
            
            if 'default' in image_url_obj:
                image_urls.append(image_url_obj['default'])
            elif 'url' in image_url_obj:
                image_urls.append(image_url_obj['url'])
        
        # CHANGED: Use static thumbnail URL instead of Patreon URL
        thumbnail_urls = [f"https://vamarequests.com/static/thumbnails/{post_id}-thumbnail.jpg"]
        
        return {
            'url': url,
            'published_at': published_at,
            'title': title,
            'image_urls': image_urls,
            'thumbnail_urls': thumbnail_urls  # Now points to static files
        }
    
    except Exception as e:
        print(f"  ERROR: Failed to parse JSON for post {post_id}: {e}")
        return None
```

**Or use an environment variable:**

```python
# At the top of import_posts.py
STATIC_THUMBNAIL_BASE = os.environ.get(
    'STATIC_THUMBNAIL_BASE', 
    'https://vamarequests.com/static/thumbnails'
)

# In load_json_data function:
thumbnail_urls = [f"{STATIC_THUMBNAIL_BASE}/{post_id}-thumbnail.jpg"]
```

---

## Complete Deployment Workflow

### 1. Prepare Thumbnails Locally

```bash
# On your local machine
cd /Users/joelee/projects/vamasubmissions

# Download thumbnails (choose one method from Step 2 above)
python3 download_thumbnails.py

# Verify thumbnails
ls -lh backend/static/thumbnails/ | wc -l  # Should show ~2700 files
```

### 2. Transfer to Server

```bash
# Transfer thumbnails
rsync -avz --progress backend/static/thumbnails/ \
  your-user@vamarequests.com:/path/to/vamasubmissions/backend/static/thumbnails/

# Transfer data files
rsync -avz --progress vama_posts_initial.csv \
  your-user@vamarequests.com:/path/to/vamasubmissions/

rsync -avz --progress all-post-api/ \
  your-user@vamarequests.com:/path/to/vamasubmissions/all-post-api/
```

### 3. On Server: Clean Test Data

```bash
ssh your-user@vamarequests.com
cd /path/to/vamasubmissions

# Find your user ID
psql vamasubmissions -c "SELECT id, email FROM users;"

# Clean test data (replace 123 with your user ID)
psql vamasubmissions << EOF
DELETE FROM edit_suggestions;
DELETE FROM edit_history;
DELETE FROM community_requests;
DELETE FROM users WHERE id != 123;
TRUNCATE posts CASCADE;
EOF
```

### 4. Import Posts with Static URLs

```bash
# Modify import_posts.py to use static URLs (see above)
nano backend/import_posts.py

# Or set environment variable
export STATIC_THUMBNAIL_BASE="https://vamarequests.com/static/thumbnails"

# Import posts
source backend/venv/bin/activate
DATABASE_URL='postgresql://postgres:password@localhost/vamasubmissions' \
  python3 backend/import_posts.py \
  --csv vama_posts_initial.csv \
  --json-dir all-post-api
```

### 5. Configure Nginx

```bash
# Add static thumbnails location block
sudo nano /etc/nginx/sites-available/vamarequests.com

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Verify

```bash
# Check file count
ls backend/static/thumbnails/*.jpg | wc -l

# Check database
psql vamasubmissions -c "SELECT COUNT(*) FROM posts;"
psql vamasubmissions -c "SELECT post_id, thumbnail_urls[1] FROM posts LIMIT 3;"

# Test URL
curl -I https://vamarequests.com/static/thumbnails/129090487-thumbnail.jpg
```

---

## Maintenance

### Adding New Posts

When you import new posts:

1. Download the new thumbnail: `{post_id}-thumbnail.jpg`
2. Place in `backend/static/thumbnails/`
3. Import post with static URL
4. Thumbnail is immediately available

### Backup Thumbnails

```bash
# Backup thumbnails directory
tar -czf thumbnails-backup-$(date +%Y%m%d).tar.gz backend/static/thumbnails/

# Or sync to backup location
rsync -avz backend/static/thumbnails/ /backup/location/thumbnails/
```

### Regenerate Thumbnails

If you need to regenerate thumbnails (resize, optimize, etc.):

```bash
# Using ImageMagick
for file in backend/static/thumbnails/*.jpg; do
    convert "$file" -resize 400x400^ -gravity center -extent 400x400 "$file"
done
```

---

## Summary

### File Structure

```
backend/static/thumbnails/
├── 129090487-thumbnail.jpg  (your static file)
├── 130938449-thumbnail.jpg
└── ...

Database:
thumbnail_urls = ["https://vamarequests.com/static/thumbnails/129090487-thumbnail.jpg"]

Nginx:
/static/thumbnails/ → /path/to/backend/static/thumbnails/
```

### Benefits

- ✅ No URL expiration issues
- ✅ Full control over images
- ✅ Fast static file serving via nginx
- ✅ Can optimize/resize thumbnails
- ✅ Reliable long-term storage

### Workflow

1. Download thumbnails → `backend/static/thumbnails/`
2. Import posts with static URLs
3. Nginx serves files directly
4. Frontend displays from your domain
