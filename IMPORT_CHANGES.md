# Post Import System Changes

## Summary
Updated the post import system to work in production environments by:
1. Using session_id cookie instead of browser cookie detection
2. Downloading thumbnails locally instead of using placeholders
3. Archiving JSON metadata files
4. Extracting proper metadata from gallery-dl

## Changes Made

### 1. Database Migration
**File**: `backend/alembic/versions/007_add_patreon_session_id.sql`
- Added `patreon_session_id` column to `admin_settings` table
- Allows admins to paste their Patreon session cookie

**To apply**:
```bash
psql vamasubmissions < backend/alembic/versions/007_add_patreon_session_id.sql
```

### 2. Model Updates
**File**: `backend/app/models/admin_settings.py`
- Added `patreon_session_id` field (TEXT, nullable)

### 3. Service Layer Updates
**File**: `backend/app/services/patreon_service.py`

#### `fetch_posts_with_gallery_dl()`:
- **Before**: Used `--cookies-from-browser chrome` (only works locally)
- **After**: Creates temporary cookie file with session_id and uses `--cookies FILE`
- Works on any server without Chrome installed

#### `extract_post_data_from_gallery_dl()`:
- **Before**: Used random League of Legends placeholder thumbnails
- **After**: 
  - Downloads `image.thumb_square_url` from Patreon
  - Saves as `{post_id}-thumbnail-square.{ext}` in `backend/static/thumbnails/`
  - Stores local path `/static/thumbnails/{filename}` in database
  - Archives full JSON metadata to `backend/static/archive/{post_id}-metadata.json`
  - Uses `published_at` field for timestamp (more accurate than `date`)

### 4. API Endpoints
**File**: `backend/app/api/admin.py`

#### New Endpoints:
- `PATCH /api/admin/settings/session-id` - Update admin's Patreon session_id
  - Body: `{"session_id": "your_session_id_here"}`
  - Returns: Success message

- `GET /api/admin/settings/session-id` - Check if session_id is configured
  - Returns: `{"has_session_id": true/false, "message": "..."}`

#### Updated Endpoint:
- `POST /api/admin/posts/fetch-new`
  - Now requires `patreon_session_id` to be configured
  - Returns error if session_id is missing
  - Uses session_id instead of browser cookies

### 5. Static File Serving
**File**: `backend/app/main.py`
- Updated to mount `backend/static/` directory
- Serves thumbnails at `/static/thumbnails/{filename}`
- Serves archives at `/static/archive/{filename}`

### 6. Directory Structure
Created new directories:
```
backend/
├── static/
│   ├── thumbnails/     # Downloaded post thumbnails
│   └── archive/        # Archived JSON metadata files
```

## How to Use (Production)

### Step 1: Get Patreon Session ID
1. Log into Patreon in your browser
2. Open DevTools (F12)
3. Go to Application → Cookies → https://www.patreon.com
4. Find cookie named `session_id`
5. Copy its value

### Step 2: Configure Session ID
```bash
curl -X PATCH http://your-server/api/admin/settings/session-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "YOUR_SESSION_ID_HERE"}'
```

### Step 3: Import Posts
```bash
curl -X POST http://your-server/api/admin/posts/fetch-new \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## What Gets Stored

### Database (posts table):
- `post_id`: Patreon post ID
- `title`: Post title
- `url`: Patreon post URL
- `timestamp`: Published date (from `published_at`)
- `thumbnail_urls`: Array with local path (e.g., `["/static/thumbnails/148956911-thumbnail-square.png"]`)
- `image_urls`: Empty array (not storing full images)
- `raw_patreon_json`: Full gallery-dl metadata (JSONB)
- `status`: 'pending' (admin reviews and publishes)
- `characters`: Empty (admin fills in)
- `series`: Empty (admin fills in)
- `tags`: Empty (auto-generated on publish)

### File System:
- `backend/static/thumbnails/148956911-thumbnail-square.png` - Downloaded thumbnail
- `backend/static/archive/148956911-metadata.json` - Full gallery-dl JSON

## Testing Locally

1. Apply migration:
```bash
psql vamasubmissions < backend/alembic/versions/007_add_patreon_session_id.sql
```

2. Get your Patreon session_id (see Step 1 above)

3. Update session_id via API or directly in database:
```sql
UPDATE admin_settings 
SET patreon_session_id = 'your_session_id_here' 
WHERE user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1);
```

4. Test import:
```bash
# Start backend
cd backend && source venv/bin/activate && ./start_server.sh

# In another terminal, trigger import
curl -X POST http://localhost:8000/api/admin/posts/fetch-new \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

5. Check results:
- Thumbnails in `backend/static/thumbnails/`
- JSON files in `backend/static/archive/`
- Posts in database with `status='pending'`

## Notes

- Thumbnails are downloaded once during import (not re-downloaded)
- JSON archives are for debugging/reference (not used by app)
- Session ID needs to be refreshed periodically (when Patreon cookie expires)
- Old placeholder thumbnail code has been completely removed
- Browser cookie detection code (`find_chrome_profile_with_patreon_cookies`) is now unused but kept for reference
