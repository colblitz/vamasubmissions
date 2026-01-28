# Gallery-dl Output Analysis

**Date**: 2026-01-27
**Sample Post**: 129090487 - "Sailor pluto 481 pics"
**URL**: https://www.patreon.com/posts/sailor-pluto-481-129090487

## Summary

- **Total files downloaded**: 34 files (33 PNGs + 1 ZIP)
- **File naming pattern**: `[post_id]_[title]_[ordinal].ext`
  - Example: `129090487_Sailor pluto 481 pics_01.png`
- **Metadata files**: Each file gets a corresponding `.json` metadata file
- **File extensions**: `.png` for images, `.zip` for archives

## File Structure

```
gallery-dl/patreon/carza/
├── 129090487_Sailor pluto 481 pics_01.png (1.5M)
├── 129090487_Sailor pluto 481 pics_01.png.json (149K)
├── 129090487_Sailor pluto 481 pics_02.png
├── 129090487_Sailor pluto 481 pics_02.png.json
├── ...
├── 129090487_Sailor pluto 481 pics_33.png
├── 129090487_Sailor pluto 481 pics_33.png.json
├── 129090487_Sailor pluto 481 pics_34.zip (755M!)
└── 129090487_Sailor pluto 481 pics_34.zip.json
```

**Total**: 68 files (34 media files + 34 JSON metadata files)

## JSON Metadata Structure

Each `.json` file contains extensive metadata. Key fields:

### Post-Level Data
```json
{
  "post_id": "129090487",
  "title": "Sailor pluto 481 pics",
  "content": "...",
  "published_at": "2025-01-20T18:17:36.000+00:00",
  "url": "https://www.patreon.com/posts/129090487",
  "tags": []
}
```

### File-Level Data
```json
{
  "num": 1,  // Ordinal (1-indexed in JSON)
  "hash": "d0ac48114ed24531843e244336ec33fa",
  "type": "image",
  "file": {
    "file_name": "00000-2698488310.png",  // Original filename from VAMA
    "download_url": "https://c10.patreonusercontent.com/...",
    "image_urls": {
      "original": "https://...",
      "thumbnail": "https://...",
      "thumbnail_large": "https://...",
      "thumbnail_small": "https://..."
    },
    "metadata": {
      "dimensions": {
        "h": 1296,
        "w": 896
      }
    }
  },
  "filename": "00000-2698488310",  // Without extension
  "extension": "png"
}
```

### Creator Data
```json
{
  "creator": {
    "first_name": "carza",
    "full_name": "carza",
    "vanity": "VAMA",
    "url": "https://www.patreon.com/VAMA"
  }
}
```

## Key Observations

### 1. **Multiple Files Per Post**
- This post has 34 files (33 images + 1 zip)
- ZIP file is HUGE (755MB) - likely contains high-res versions
- We need to handle both images and other file types

### 2. **File Naming**
- Gallery-dl uses: `[post_id]_[title]_[ordinal].ext`
- Ordinal is 2-digit zero-padded (01, 02, ..., 34)
- Title includes spaces and special characters
- Extension matches actual file type

### 3. **Metadata Richness**
- Each file has complete post metadata (redundant across files)
- `num` field gives ordinal position (1-indexed)
- `hash` field is unique per file (could use for deduplication)
- Original filename preserved in `file.file_name`

### 4. **Image URLs**
- Patreon provides multiple sizes: original, thumbnail, thumbnail_large, thumbnail_small
- All URLs have token-based authentication with expiration
- We're downloading the full-size images

### 5. **File Types**
- Images: `.png` (this post)
- Archives: `.zip` (this post has one)
- Other posts might have: `.jpg`, `.webp`, `.gif`, `.mp4`, etc.

## Implications for Our Implementation

### For Thumbnail Download Script:

1. **Handle multiple files per post**
   - Loop through all files in gallery-dl output
   - Skip non-image files (ZIP, videos, etc.) for thumbnails
   - Or: process ZIP files separately

2. **Extract ordinal from filename or JSON**
   - Gallery-dl filename has ordinal: `_01.png`, `_02.png`
   - JSON metadata has `num` field (1-indexed)
   - We'll use 0-indexed for our naming

3. **Generate UUID per file**
   - Use Python's `uuid.uuid4().hex[:8]` for short hash
   - Ensures uniqueness and prevents URL guessing

4. **Rename files to our convention**
   - From: `129090487_Sailor pluto 481 pics_01.png`
   - To: `129090487-thumbnail-square-000-a1b2c3d4.png`

5. **Store URLs in database**
   - Build array of all thumbnail URLs
   - Update `posts.thumbnail_urls` field
   - Set `posts.thumbnail_url` to first image (backwards compat)

### For Import Post Feature:

1. **Parse gallery-dl JSON metadata**
   - Extract post_id, title, published_at from first JSON file
   - Count total image files (exclude ZIP/videos)

2. **Process each image file**
   - Generate UUID
   - Rename to our convention
   - Add to thumbnail_urls array

3. **Handle edge cases**
   - Posts with only ZIP files (no images)
   - Posts with videos
   - Posts with 100+ images (performance)

## Questions to Resolve

1. **Do we want to process ZIP files?**
   - Option A: Ignore them (just use the preview images)
   - Option B: Extract and process images inside ZIP
   - **Recommendation**: Ignore for now, just use preview images

2. **What about videos?**
   - Some posts might have `.mp4` files
   - Do we generate video thumbnails?
   - **Recommendation**: Skip videos for now, or use Patreon's thumbnail URL

3. **How many thumbnails to display?**
   - This post has 33 images
   - Do we show all 33 in the UI?
   - **Recommendation**: Show all, but lazy load

4. **File size concerns?**
   - PNG files are 1-2MB each
   - 33 images = ~50MB per post
   - CDN will help, but still significant
   - **Recommendation**: Consider converting to WebP or JPEG for smaller size

## Next Steps

1. ✅ Captured gallery-dl output and metadata
2. ✅ Analyzed structure and implications
3. [ ] Create thumbnail redownload script
4. [ ] Create database update script
5. [ ] Update import post feature
6. [ ] Design frontend for multiple thumbnails
7. [ ] Set up Cloudflare CDN

## Better Approach: Single info.json File

**Use `--write-info-json` instead of `--write-metadata`**

This creates a **single** `info.json` file with all post and file metadata, instead of one JSON per file.

### Structure of info.json:

```json
{
  "post_id": "129090487",
  "title": "Sailor pluto 481 pics",
  "published_at": "2025-01-20T18:17:36.000+00:00",
  "url": "https://www.patreon.com/posts/129090487",
  "images": [
    {
      "file_name": "00000-2698488310.png",
      "download_url": "https://c10.patreonusercontent.com/...",
      "metadata": {
        "dimensions": {"h": 1296, "w": 896}
      }
    },
    {
      "file_name": "00015-3963642330.png",
      "download_url": "https://...",
      "metadata": {
        "dimensions": {"h": 1296, "w": 896}
      }
    }
    // ... 31 more images
  ],
  "attachments_media": [
    {
      "file_name": "00488-1697752924.zip",
      "download_url": "https://..."
    }
  ]
}
```

**Key Benefits:**
- ✅ Single JSON file per post (not 34 separate files)
- ✅ All images in `images` array (33 items)
- ✅ All attachments in `attachments_media` array (1 ZIP)
- ✅ Easy to parse and iterate
- ✅ Post-level metadata included

**Command:**
```bash
gallery-dl --cookies-from-browser chrome:"Profile 1" \
  --write-info-json \
  --no-download \  # Optional: just get metadata without downloading
  https://www.patreon.com/posts/129090487
```

## Example Files Saved

- `docs/gallery-dl-info-example.json` - Single info.json with all post metadata
- `temp_gallery_test/gallery-dl/patreon/carza/` - Full download (34 files + 1 info.json)
