#!/usr/bin/env python3
"""
Redownload thumbnails for all posts with new naming convention.

This script:
1. Fetches posts from database
2. Downloads all images using gallery-dl
3. Renames with UUID format: [postid]-thumbnail-square-[ordinal]-[uuid].ext
4. Outputs to output/ directory for deployment

Dependencies: Only Python stdlib + gallery-dl (command line tool) + psycopg2

Usage:
    python scripts/redownload_thumbnails.py --all
    python scripts/redownload_thumbnails.py --post-id 129090487
    python scripts/redownload_thumbnails.py --limit 10 --dry-run
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Dict, Optional
from urllib.request import urlopen, Request


# ============================================================================
# Utility Functions (copied from backend/app/utils/thumbnail_utils.py)
# ============================================================================

def generate_thumbnail_filename(post_id: str, ordinal: int, extension: str) -> str:
    """Generate thumbnail filename with UUID."""
    short_uuid = uuid.uuid4().hex[:8]
    ordinal_str = f"{ordinal:03d}"
    extension = extension.lstrip(".")
    return f"{post_id}-t-{ordinal_str}-{short_uuid}.{extension}"


def get_file_extension(filename: str) -> str:
    """Extract file extension from filename (without dot)."""
    ext = Path(filename).suffix.lstrip(".")
    return ext.lower()


def build_thumbnail_url(filename: str, base_url: str = "https://vamarequests.com") -> str:
    """Build full thumbnail URL from filename."""
    return f"{base_url}/static/thumbnails/{filename}"


# ============================================================================
# Browser Cookie Detection
# ============================================================================

def detect_browser_with_patreon_cookies() -> Optional[str]:
    """
    Auto-detect which browser profile has Patreon cookies.
    
    Returns:
        Browser string for gallery-dl (e.g., "chrome:Profile 1") or None
    """
    print("[INFO] Auto-detecting browser with Patreon cookies...")
    
    # Try Chrome profiles
    chrome_profiles = ["Profile 1", "Profile 2", "Default", "Profile 3"]
    for profile in chrome_profiles:
        browser_str = f"chrome:{profile}"
        if test_browser_cookies(browser_str):
            print(f"[SUCCESS] Found Patreon cookies in Chrome {profile}")
            return browser_str
    
    # Try Firefox
    if test_browser_cookies("firefox"):
        print("[SUCCESS] Found Patreon cookies in Firefox")
        return "firefox"
    
    # Try Safari
    if test_browser_cookies("safari"):
        print("[SUCCESS] Found Patreon cookies in Safari")
        return "safari"
    
    print("[ERROR] Could not find Patreon cookies in any browser")
    return None


def test_browser_cookies(browser_str: str) -> bool:
    """
    Test if browser profile has valid Patreon cookies.
    
    Args:
        browser_str: Browser string for gallery-dl (e.g., "chrome:Profile 1")
    
    Returns:
        True if cookies found, False otherwise
    """
    try:
        # Run gallery-dl with --cookies-from-browser to test
        result = subprocess.run(
            ["gallery-dl", "--cookies-from-browser", browser_str, "--list-keywords", 
             "https://www.patreon.com/posts/129090487"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # If no error and cookies were extracted, it worked
        return "Extracted" in result.stderr and "cookies" in result.stderr
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        return False


# ============================================================================
# Database Functions
# ============================================================================

def get_database_connection_string() -> str:
    """Get database connection string from environment or default."""
    return os.environ.get('DATABASE_URL', 'postgresql://localhost/vamasubmissions')


def fetch_posts_from_db(post_id: Optional[str] = None, limit: Optional[int] = None, post_ids: Optional[List[str]] = None) -> List[Dict]:
    """
    Fetch posts from database.
    
    Args:
        post_id: Specific post ID to fetch (optional)
        limit: Limit number of posts (optional)
        post_ids: List of post IDs to fetch (optional)
    
    Returns:
        List of post dicts with keys: id, post_id, title
    """
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("[ERROR] psycopg2 not installed. Install with: pip install psycopg2-binary")
        sys.exit(1)
    
    db_url = get_database_connection_string()
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if post_id:
            cur.execute("SELECT id, post_id, title FROM posts WHERE post_id = %s", (post_id,))
        elif post_ids:
            # Fetch multiple specific post IDs
            placeholders = ','.join(['%s'] * len(post_ids))
            cur.execute(f"SELECT id, post_id, title FROM posts WHERE post_id IN ({placeholders}) ORDER BY id", post_ids)
        elif limit:
            cur.execute("SELECT id, post_id, title FROM posts ORDER BY id LIMIT %s", (limit,))
        else:
            cur.execute("SELECT id, post_id, title FROM posts ORDER BY id")
        
        posts = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(post) for post in posts]
    
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        sys.exit(1)


def dump_post_ids_to_file(output_file: str, limit: Optional[int] = None):
    """
    Dump all post IDs from database to a file (one per line).
    
    Args:
        output_file: Path to output file
        limit: Optional limit on number of post IDs
    """
    try:
        import psycopg2
    except ImportError:
        print("[ERROR] psycopg2 not installed. Install with: pip install psycopg2-binary")
        sys.exit(1)
    
    db_url = get_database_connection_string()
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        if limit:
            cur.execute("SELECT post_id FROM posts ORDER BY id LIMIT %s", (limit,))
        else:
            cur.execute("SELECT post_id FROM posts ORDER BY id")
        
        post_ids = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        
        # Write to file
        with open(output_file, 'w') as f:
            for post_id in post_ids:
                f.write(f"{post_id}\n")
        
        print(f"[SUCCESS] Dumped {len(post_ids)} post IDs to {output_file}")
        return len(post_ids)
    
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        sys.exit(1)


def read_post_ids_from_file(input_file: str) -> List[str]:
    """
    Read post IDs from file (one per line).
    
    Args:
        input_file: Path to input file
    
    Returns:
        List of post IDs (strings)
    """
    try:
        with open(input_file, 'r') as f:
            post_ids = [line.strip() for line in f if line.strip()]
        
        print(f"[INFO] Read {len(post_ids)} post IDs from {input_file}")
        return post_ids
    
    except FileNotFoundError:
        print(f"[ERROR] File not found: {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Error reading file: {e}")
        sys.exit(1)


# ============================================================================
# Parallel Download Functions
# ============================================================================

def download_single_image(url: str, output_path: str, timeout: int = 60) -> bool:
    """
    Download a single image from URL to output path.
    Skips if file already exists (idempotent/resumable).
    
    Args:
        url: Image URL
        output_path: Path to save file
        timeout: Download timeout in seconds
    
    Returns:
        True if successful or already exists, False otherwise
    """
    # Check if file already exists (idempotent/resumable)
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        print(f"[SKIP] Already exists: {os.path.basename(output_path)}")
        return True
    
    try:
        # Create request with user agent to avoid blocks
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        with urlopen(req, timeout=timeout) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        
        return True
    
    except Exception as e:
        print(f"[ERROR] Failed to download {os.path.basename(output_path)}: {e}")
        return False


def download_images_parallel(
    images_info: List[Dict],
    post_id: str,
    output_dir: str,
    max_workers: int = 10
) -> List[str]:
    """
    Download multiple images in parallel.
    
    Args:
        images_info: List of dicts with keys: ordinal, url, filename, extension
        post_id: Post ID
        output_dir: Output directory
        max_workers: Number of parallel download threads
    
    Returns:
        List of successfully downloaded filenames
    """
    print(f"[INFO] Downloading {len(images_info)} images in parallel (max {max_workers} threads)...")
    
    successful_filenames = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all download tasks
        future_to_info = {}
        for info in images_info:
            output_path = os.path.join(output_dir, info['filename'])
            future = executor.submit(download_single_image, info['url'], output_path)
            future_to_info[future] = info
        
        # Process completed downloads
        for future in as_completed(future_to_info):
            info = future_to_info[future]
            try:
                success = future.result()
                if success:
                    successful_filenames.append(info['filename'])
                    print(f"[SUCCESS] Downloaded: {info['filename']}")
            except Exception as e:
                print(f"[ERROR] Exception downloading {info['filename']}: {e}")
    
    return successful_filenames


# ============================================================================
# Gallery-dl Functions
# ============================================================================

def download_post_with_gallery_dl(
    post_id: str,
    browser_str: str,
    temp_dir: str,
    dry_run: bool = False
) -> Optional[Dict]:
    """
    Fetch post metadata using gallery-dl (metadata only, no image downloads).
    
    Args:
        post_id: Patreon post ID
        browser_str: Browser string for cookies (e.g., "chrome:Profile 1")
        temp_dir: Temporary directory for metadata
        dry_run: If True, only fetch metadata without downloading
    
    Returns:
        Parsed info.json dict, or None on error
    """
    url = f"https://www.patreon.com/posts/{post_id}"
    
    cmd = [
        "gallery-dl",
        "--cookies-from-browser", browser_str,
        "--write-info-json",
        "--no-download",  # Always skip downloads, we'll do them in parallel
        "--dest", temp_dir,
        url
    ]
    
    try:
        print(f"[INFO] Running gallery-dl for post {post_id}...")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"[ERROR] gallery-dl failed for post {post_id}")
            print(f"[ERROR] stderr: {result.stderr}")
            return None
        
        # Find info.json file
        info_json_path = None
        for root, dirs, files in os.walk(temp_dir):
            if "info.json" in files:
                info_json_path = os.path.join(root, "info.json")
                break
        
        if not info_json_path:
            print(f"[ERROR] info.json not found for post {post_id}")
            return None
        
        # Parse info.json
        with open(info_json_path, 'r') as f:
            info_data = json.load(f)
        
        return info_data
    
    except subprocess.TimeoutExpired:
        print(f"[ERROR] gallery-dl timed out for post {post_id}")
        return None
    except Exception as e:
        print(f"[ERROR] Exception downloading post {post_id}: {e}")
        return None


def process_post_images(
    post_id: str,
    info_data: Dict,
    temp_dir: str,
    output_dir: str,
    dry_run: bool = False,
    max_workers: int = 10
) -> List[str]:
    """
    Process images from info.json and download in parallel.
    
    Args:
        post_id: Post ID
        info_data: Parsed info.json data
        temp_dir: Temporary directory (unused now, kept for compatibility)
        output_dir: Output directory for renamed files
        dry_run: If True, don't actually download files
        max_workers: Number of parallel download threads
    
    Returns:
        List of new filenames
    """
    images = info_data.get('images', [])
    
    if not images:
        print(f"[WARNING] No images found for post {post_id}")
        return []
    
    print(f"[INFO] Processing {len(images)} images for post {post_id}")
    
    # Prepare download info for all images
    images_info = []
    for ordinal, image in enumerate(images):
        file_name = image.get('file_name', '')
        
        if not file_name:
            print(f"[WARNING] Image {ordinal} missing file_name, skipping")
            continue
        
        # Extract extension
        extension = get_file_extension(file_name)
        
        if not extension:
            print(f"[WARNING] Could not determine extension for {file_name}, skipping")
            continue
        
        # Get download URL from info.json
        download_url = image.get('download_url')
        if not download_url:
            print(f"[WARNING] Image {ordinal} missing download_url, skipping")
            continue
        
        # Generate new filename
        new_filename = generate_thumbnail_filename(post_id, ordinal, extension)
        
        if dry_run:
            print(f"[DRY-RUN] Would download: {new_filename} from {download_url[:50]}...")
        else:
            images_info.append({
                'ordinal': ordinal,
                'url': download_url,
                'filename': new_filename,
                'extension': extension
            })
    
    if dry_run:
        # Return filenames that would be created
        return [info['filename'] for info in images_info]
    
    # Download all images in parallel
    if images_info:
        successful_filenames = download_images_parallel(
            images_info, post_id, output_dir, max_workers=max_workers
        )
        return successful_filenames
    
    return []


def find_downloaded_file(temp_dir: str, post_id: str, ordinal: int, extension: str) -> Optional[str]:
    """
    Find downloaded file in temp directory.
    
    Gallery-dl names files: [post_id]_[title]_[ordinal].[ext]
    Example: 129090487_Sailor pluto 481 pics_01.png
    
    Args:
        temp_dir: Directory to search
        post_id: Post ID
        ordinal: Ordinal (1-indexed from gallery-dl)
        extension: File extension
    
    Returns:
        Full path to file, or None if not found
    """
    # Pattern: [post_id]_*_[ordinal].[ext]
    ordinal_str = f"{ordinal:02d}"  # gallery-dl uses 2-digit padding
    
    for root, dirs, files in os.walk(temp_dir):
        for file in files:
            if file.startswith(post_id) and file.endswith(f"_{ordinal_str}.{extension}"):
                return os.path.join(root, file)
    
    return None


# ============================================================================
# Output Generation
# ============================================================================

def generate_sql_update_script(thumbnail_mapping: Dict[str, List[str]], output_file: str):
    """
    Generate SQL script to update database with new thumbnail URLs.
    
    Args:
        thumbnail_mapping: Dict mapping post_id to list of filenames
        output_file: Path to output SQL file
    """
    with open(output_file, 'w') as f:
        f.write("-- One-time script to update posts table with new thumbnail URLs\n")
        f.write("-- Generated by redownload_thumbnails.py\n\n")
        f.write("BEGIN;\n\n")
        
        for post_id, filenames in thumbnail_mapping.items():
            if not filenames:
                continue
            
            # Build array of URLs
            urls = [build_thumbnail_url(fn) for fn in filenames]
            urls_sql = "ARRAY[" + ", ".join(f"'{url}'" for url in urls) + "]"
            
            # First URL for thumbnail_url (backwards compat)
            first_url = urls[0]
            
            f.write(f"-- Post {post_id}: {len(filenames)} thumbnails\n")
            f.write(f"UPDATE posts SET\n")
            f.write(f"  thumbnail_urls = {urls_sql},\n")
            f.write(f"  thumbnail_url = '{first_url}'\n")
            f.write(f"WHERE post_id = '{post_id}';\n\n")
        
        f.write("COMMIT;\n")
    
    print(f"[SUCCESS] Generated SQL script: {output_file}")


def save_thumbnail_mapping(thumbnail_mapping: Dict[str, List[str]], output_file: str):
    """Save thumbnail mapping to JSON file."""
    with open(output_file, 'w') as f:
        json.dump(thumbnail_mapping, f, indent=2)
    
    print(f"[SUCCESS] Saved thumbnail mapping: {output_file}")


# ============================================================================
# Main Script
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Redownload thumbnails with new naming convention"
    )
    parser.add_argument(
        "--post-id",
        help="Process specific post ID"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all posts"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of posts to process"
    )
    parser.add_argument(
        "--from-file",
        help="Read post IDs from file (one per line)"
    )
    parser.add_argument(
        "--dump-post-ids",
        help="Dump post IDs to file and exit (one per line)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without downloading"
    )
    parser.add_argument(
        "--browser",
        help="Override browser detection (e.g., 'chrome:Profile 1')"
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Output directory (default: output/)"
    )
    
    args = parser.parse_args()
    
    # Handle dump-post-ids mode
    if args.dump_post_ids:
        print(f"[INFO] Dumping post IDs to {args.dump_post_ids}")
        dump_post_ids_to_file(args.dump_post_ids, limit=args.limit)
        sys.exit(0)
    
    # Validate arguments
    if not args.all and not args.post_id and not args.limit and not args.from_file:
        parser.error("Must specify --all, --post-id, --limit, or --from-file")
    
    # Check gallery-dl is installed
    try:
        subprocess.run(["gallery-dl", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[ERROR] gallery-dl not found. Install with: brew install gallery-dl")
        sys.exit(1)
    
    # Detect browser or use override
    if args.browser:
        browser_str = args.browser
        print(f"[INFO] Using specified browser: {browser_str}")
    else:
        browser_str = detect_browser_with_patreon_cookies()
        if not browser_str:
            print("[ERROR] Could not detect browser with Patreon cookies")
            print("[ERROR] Try specifying manually with --browser 'chrome:Profile 1'")
            sys.exit(1)
    
    # Fetch posts from database
    print("[INFO] Fetching posts from database...")
    
    if args.from_file:
        # Read post IDs from file
        post_ids = read_post_ids_from_file(args.from_file)
        posts = fetch_posts_from_db(post_ids=post_ids)
    else:
        posts = fetch_posts_from_db(post_id=args.post_id, limit=args.limit)
    
    if not posts:
        print("[ERROR] No posts found")
        sys.exit(1)
    
    print(f"[INFO] Found {len(posts)} posts to process")
    
    # Create output directories
    output_dir = args.output_dir
    thumbnails_dir = os.path.join(output_dir, "thumbnails")
    os.makedirs(thumbnails_dir, exist_ok=True)
    
    # Process each post
    thumbnail_mapping = {}
    success_count = 0
    error_count = 0
    
    script_start_time = time.time()
    
    for i, post in enumerate(posts, 1):
        post_id = post['post_id']
        title = post['title']
        
        post_start_time = time.time()
        print(f"\n[{i}/{len(posts)}] Processing post {post_id}: {title}")
        
        # Create temp directory for this post
        with tempfile.TemporaryDirectory() as temp_dir:
            # Fetch metadata with gallery-dl
            metadata_start = time.time()
            info_data = download_post_with_gallery_dl(
                post_id, browser_str, temp_dir, dry_run=args.dry_run
            )
            metadata_time = time.time() - metadata_start
            print(f"[TIMING] Metadata fetch: {metadata_time:.2f}s")
            
            if not info_data:
                print(f"[ERROR] Failed to download post {post_id}")
                error_count += 1
                continue
            
            # Download images in parallel
            download_start = time.time()
            new_filenames = process_post_images(
                post_id, info_data, temp_dir, thumbnails_dir, dry_run=args.dry_run
            )
            download_time = time.time() - download_start
            
            if new_filenames:
                thumbnail_mapping[post_id] = new_filenames
                success_count += 1
                post_time = time.time() - post_start_time
                print(f"[TIMING] Image downloads: {download_time:.2f}s")
                print(f"[TIMING] Total post time: {post_time:.2f}s ({len(new_filenames)} images)")
            else:
                error_count += 1
    
    script_time = time.time() - script_start_time
    
    # Generate output files
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total posts: {len(posts)}")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Total time: {script_time:.2f}s ({script_time/60:.2f} minutes)")
    if success_count > 0:
        avg_time = script_time / success_count
        print(f"Average time per post: {avg_time:.2f}s")
    
    if not args.dry_run:
        # Save thumbnail mapping
        mapping_file = os.path.join(output_dir, "thumbnail_mapping.json")
        save_thumbnail_mapping(thumbnail_mapping, mapping_file)
        
        # Generate SQL script
        sql_file = os.path.join(output_dir, "update_database.sql")
        generate_sql_update_script(thumbnail_mapping, sql_file)
        
        print("\n" + "="*60)
        print("DEPLOYMENT INSTRUCTIONS")
        print("="*60)
        print(f"1. Zip thumbnails:")
        print(f"   cd {output_dir} && zip -r thumbnails.zip thumbnails/")
        print(f"\n2. SCP to server:")
        print(f"   scp thumbnails.zip update_database.sql user@server:/tmp/")
        print(f"\n3. On server:")
        print(f"   unzip /tmp/thumbnails.zip -d /path/to/backend/static/")
        print(f"   psql vamasubmissions < /tmp/update_database.sql")
        print("="*60)
    else:
        print("\n[DRY-RUN] No files created")


if __name__ == "__main__":
    main()
