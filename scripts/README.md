# Thumbnail Redownload Script

Script to redownload all post thumbnails with new UUID-based naming convention.

## Requirements

**Minimal dependencies:**
- Python 3.7+
- `gallery-dl` (command line tool)
- `psycopg2-binary` (for database access)

**Install:**
```bash
# macOS
brew install gallery-dl
pip install psycopg2-binary

# Linux
pip install gallery-dl psycopg2-binary
```

## Features

- ✅ Auto-detects browser with Patreon cookies (Chrome, Firefox, Safari)
- ✅ Downloads all images per post (not just first)
- ✅ Renames with UUID: `[postid]-thumbnail-square-[ordinal]-[uuid].ext`
- ✅ Outputs to `output/` directory for easy deployment
- ✅ Generates SQL script for database update
- ✅ Dry-run mode for testing
- ✅ **Dump post IDs to file** for batch processing
- ✅ **Read post IDs from file** for selective processing

## Usage

### Dump post IDs to file
```bash
# Dump all post IDs
python scripts/redownload_thumbnails.py --dump-post-ids post_ids.txt

# Dump first 100 post IDs
python scripts/redownload_thumbnails.py --dump-post-ids post_ids.txt --limit 100
```

### Process from file
```bash
# Create/edit post_ids.txt with one post ID per line
# Then process those posts
python scripts/redownload_thumbnails.py --from-file post_ids.txt
```

### Test with one post
```bash
python scripts/redownload_thumbnails.py --post-id 129090487
```

### Dry run (preview without downloading)
```bash
python scripts/redownload_thumbnails.py --limit 10 --dry-run
```

### Process first 10 posts
```bash
python scripts/redownload_thumbnails.py --limit 10
```

### Process all posts
```bash
python scripts/redownload_thumbnails.py --all
```

### Override browser detection
```bash
python scripts/redownload_thumbnails.py --all --browser "chrome:Profile 2"
```

## Output Structure

```
output/
├── thumbnails/
│   ├── 129090487-thumbnail-square-000-a1b2c3d4.png
│   ├── 129090487-thumbnail-square-001-b2c3d4e5.png
│   └── ...
├── thumbnail_mapping.json
└── update_database.sql
```

## Deployment

After running the script:

### 1. Zip thumbnails
```bash
cd output && zip -r thumbnails.zip thumbnails/
```

### 2. SCP to server
```bash
scp thumbnails.zip update_database.sql deploy@YOUR_SERVER:/tmp/
```

### 3. On server
```bash
# Extract thumbnails
unzip /tmp/thumbnails.zip -d ~/vamasubmissions/backend/static/

# Update database
psql vamasubmissions < /tmp/update_database.sql
```

## Database Connection

The script uses the `DATABASE_URL` environment variable or defaults to:
```
postgresql://localhost/vamasubmissions
```

Set it before running:
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
python scripts/redownload_thumbnails.py --all
```

## Browser Cookie Detection

The script auto-detects cookies in this order:
1. Chrome Profile 1, 2, Default, 3
2. Firefox
3. Safari

If detection fails, specify manually:
```bash
python scripts/redownload_thumbnails.py --all --browser "chrome:Profile 1"
```

## Troubleshooting

### "gallery-dl not found"
```bash
brew install gallery-dl  # macOS
pip install gallery-dl   # Linux
```

### "psycopg2 not installed"
```bash
pip install psycopg2-binary
```

### "Could not find Patreon cookies"
- Make sure you're logged into Patreon in your browser
- Try specifying browser manually with `--browser`
- Check browser profile name in browser settings

### "Failed to download post"
- Post might be deleted or private
- Check Patreon subscription is active
- Try downloading manually with gallery-dl to test

## Notes

- Script uses temporary directories (auto-cleaned)
- Old thumbnails are NOT deleted (manual cleanup needed)
- Script is idempotent (safe to re-run)
- Each run generates new UUIDs (filenames will differ)
