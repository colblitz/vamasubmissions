# VAMA Thumbnail Download Script

This script downloads square thumbnails from Patreon posts and saves them with the naming format: `[postid]-thumbnail-square.webp`

## Features

- **Idempotent**: Skips already downloaded thumbnails
- **Efficient**: Uses existing `post-api.json` files if available in post folders
- **Automatic**: Downloads post info only when needed (no media files)
- **Progress tracking**: Shows count of downloaded, skipped, and failed thumbnails

## Setup

### 1. Create Patreon-DL Config

Copy the example config:
```bash
cp vama_thumbnail_download.conf.example $HOME/patreon-test/vama_thumbnail_download.conf
```

### 2. Add Your Session Cookie

Edit the config file and add your Patreon session cookie:
```bash
nano $HOME/patreon-test/vama_thumbnail_download.conf
```

Replace `YOUR_SESSION_COOKIE_HERE` with your actual session cookie.

**How to get your session cookie:**
1. Log into Patreon in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage tab (Chrome) or Storage tab (Firefox)
4. Click on Cookies → patreon.com
5. Find `session_id` and copy its value

**Note:** The config follows the patreon-dl format from https://github.com/patrickkfkan/patreon-dl/blob/master/example.conf

### 3. Verify Directory Structure

The script expects this structure:
```
$HOME/patreon-test/VAMA - VAMA/posts/
├── 147602870 - victoria (eminence in shadow)/
│   └── post_info/
│       └── post-api.json  (optional, will download if missing)
├── 148929179 - Yukihime (uq holder)/
│   └── post_info/
│       └── post-api.json
└── ...
```

## Usage

Run the script:
```bash
./download_thumbnails.sh
```

## Output

Thumbnails will be saved to:
```
$HOME/patreon-test/vama-thumbnails/
├── 147602870-thumbnail-square.webp
├── 148929179-thumbnail-square.webp
└── ...
```

## How It Works

1. **Scans** all folders in `$HOME/patreon-test/VAMA - VAMA/posts/`
2. **Extracts** post ID from folder name (e.g., "147602870 - victoria" → "147602870")
3. **Checks** if thumbnail already exists (skips if yes)
4. **Downloads** fresh post info using patreon-dl (no media, just metadata with valid URLs)
5. **Extracts** `data.attributes.image.thumb_square_url` from JSON
6. **Downloads** the thumbnail image using curl
7. **Renames** to `[postid]-thumbnail-square.webp`
8. **Cleans up** temporary files

## Thumbnail Details

- **Source field**: `data.attributes.image.thumb_square_url`
- **Format**: WebP
- **Dimensions**: 360×360 pixels (square)
- **Example URL**: 
  ```
  https://c10.patreonusercontent.com/.../eyJoIjozNjAsInciOjM2MH0%3D/1.png
  ```

## Logs

Check the log file for detailed output:
```bash
tail -f $HOME/patreon-test/download_thumbnails.log
```

## Troubleshooting

### "Patreon-dl config not found"
Create the config file at `$HOME/patreon-test/vama_thumbnail_download.conf` with your session cookie.

### "Posts directory not found"
Verify that `$HOME/patreon-test/VAMA - VAMA/posts/` exists and contains post folders.

### "No thumbnail URL found"
The post might not have a thumbnail, or the JSON structure is different. Check the `post-api.json` file manually.

### "Failed to download thumbnail"
- Check your internet connection
- Verify the thumbnail URL is valid
- The URL might have expired (Patreon URLs have time-limited tokens)

## Configuration

You can modify these paths in the script:
- `POSTS_DIR`: Where your post folders are located
- `THUMBNAILS_DIR`: Where thumbnails will be saved
- `PATREON_DL_CONFIG`: Path to your patreon-dl config file

## Notes

- The script is **idempotent** - you can run it multiple times safely
- It will **skip** thumbnails that already exist
- It **always downloads fresh post info** to get valid (non-expired) thumbnail URLs
- Only downloads post metadata (very lightweight, no media files)
- Temporary files are cleaned up automatically after each post

## Example Output

```
[INFO] Scanning for posts in: /Users/joelee/patreon-test/VAMA - VAMA/posts
[INFO] [1] Processing post: 147602870
[INFO] Downloading post info for: 147602870
[INFO] Thumbnail URL: https://c10.patreonusercontent.com/.../1.png
[SUCCESS] Downloaded: 147602870-thumbnail-square.webp
[INFO] [2] Thumbnail already exists: 148929179-thumbnail-square.webp
...
=========================================
THUMBNAIL DOWNLOAD COMPLETE
=========================================
Total posts found: 2686
Newly downloaded: 234
Already existed: 2450
Failed: 2
Thumbnails directory: /Users/joelee/patreon-test/vama-thumbnails
[SUCCESS] All thumbnails processed successfully!
```
