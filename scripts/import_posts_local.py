#!/usr/bin/env python3
"""
Local Import Script for VAMA Posts

This script runs locally (where gallery-dl works with --cookies-from-browser)
and syncs results to the production server.

Workflow:
1. Fetch latest post date from prod API
2. Run gallery-dl locally with --cookies-from-browser
3. Download thumbnails with UUID naming
4. SCP thumbnails to server staging area
5. SSH to server and run ingest script
6. Report results

Requirements:
- gallery-dl installed: pip install gallery-dl
- SSH access to production server configured
- Chrome with Patreon login

Usage:
    python scripts/import_posts_local.py --server deploy@YOUR_SERVER_IP

    # Or with custom settings:
    python scripts/import_posts_local.py --server deploy@YOUR_SERVER_IP --creator vama --days 7
"""

import argparse
import subprocess
import json
import tempfile
import os
import sys
import requests
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from app.utils.thumbnail_utils import generate_thumbnail_filename, get_file_extension


def fetch_latest_post_date(server: str) -> dict:
    """
    Fetch the latest post date from production database via SSH.

    Args:
        server: Server address (e.g., deploy@hostname)

    Returns:
        Dict with latest_date and post_id, or None if no posts exist
    """
    print("[1/6] Fetching latest post date from production database...")

    try:
        ssh_cmd = [
            "ssh", server,
            "sudo -u postgres psql -d vamasubmissions -t -c \"SELECT post_id, timestamp FROM posts WHERE status='published' ORDER BY timestamp DESC LIMIT 1;\""
        ]
        
        result = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            print(f"[ERROR] Database query failed: {result.stderr}")
            return None
        
        output = result.stdout.strip()
        
        if not output or output == "":
            print("[INFO] No posts in database yet")
            return {"latest_date": None, "post_id": None}
        
        # Parse output: "post_id | timestamp"
        parts = [p.strip() for p in output.split('|')]
        if len(parts) >= 2:
            post_id = parts[0]
            timestamp_str = parts[1]
            print(f"[INFO] Latest post: {post_id} at {timestamp_str}")
            return {"latest_date": timestamp_str, "post_id": post_id}
        else:
            print("[WARNING] Unexpected database output format")
            return None

    except Exception as e:
        print(f"[ERROR] Failed to fetch latest date: {e}")
        return None


def find_chrome_profile_with_patreon_cookies() -> tuple:
    """
    Auto-detect which Chrome profile has Patreon cookies.
    
    Returns:
        Tuple of (profile_name, cookie_file_path) or (None, None) if not found
    """
    import platform
    import sqlite3
    
    system = platform.system()
    
    # Get Chrome user data directory
    if system == "Darwin":  # macOS
        chrome_dir = Path.home() / "Library/Application Support/Google/Chrome"
    elif system == "Linux":
        chrome_dir = Path.home() / ".config/google-chrome"
    elif system == "Windows":
        chrome_dir = Path.home() / "AppData/Local/Google/Chrome/User Data"
    else:
        return None, None
    
    if not chrome_dir.exists():
        return None, None
    
    # Common profile names to check
    profile_names = ["Default", "Profile 1", "Profile 2", "Profile 3", "Profile 4", "Profile 5"]
    
    for profile_name in profile_names:
        cookie_file = chrome_dir / profile_name / "Cookies"
        
        if not cookie_file.exists():
            continue
        
        # Try to check if this profile has Patreon cookies
        try:
            # Make a copy to avoid locking issues
            import tempfile
            import shutil
            
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp_path = tmp.name
            
            shutil.copy2(cookie_file, tmp_path)
            
            conn = sqlite3.connect(tmp_path)
            cursor = conn.cursor()
            
            # Check for patreon.com cookies
            cursor.execute("SELECT COUNT(*) FROM cookies WHERE host_key LIKE '%patreon.com%'")
            count = cursor.fetchone()[0]
            
            conn.close()
            Path(tmp_path).unlink()
            
            if count > 0:
                print(f"[INFO] Found Patreon cookies in Chrome profile: {profile_name}")
                return profile_name, cookie_file
        
        except Exception as e:
            # Skip profiles we can't read
            continue
    
    return None, None


def fetch_post_ids_from_patreon(creator_username: str, since_date: datetime, chrome_profile: str = None) -> tuple:
    """
    Fetch post IDs from Patreon API using cookies from Chrome.
    Paginates through all posts until hitting the since_date.
    
    Args:
        creator_username: Patreon creator username (not used, we use campaign_id directly)
        since_date: Fetch posts since this date
        chrome_profile: Chrome profile name (auto-detected if None)
    
    Returns:
        Tuple of (post_infos, chrome_profile) where:
        - post_infos: List of dicts with post_id, title, published_at, url
        - chrome_profile: Detected or specified Chrome profile name
    """
    print(f"[2/6] Fetching post list from Patreon API...")
    
    try:
        from pycookiecheat import chrome_cookies
    except ImportError:
        print("[ERROR] pycookiecheat not installed. Install with: pip install pycookiecheat")
        return []
    
    try:
        # Auto-detect Chrome profile if not specified
        if chrome_profile is None:
            print("[INFO] Auto-detecting Chrome profile with Patreon cookies...")
            chrome_profile, cookie_file = find_chrome_profile_with_patreon_cookies()
            
            if chrome_profile is None:
                print("[ERROR] Could not find Chrome profile with Patreon cookies")
                print("[INFO] Make sure you're logged into Patreon in Chrome")
                return []
        else:
            # Use specified profile
            import platform
            system = platform.system()
            
            if system == "Darwin":  # macOS
                cookie_file = Path.home() / "Library/Application Support/Google/Chrome" / chrome_profile / "Cookies"
            elif system == "Linux":
                cookie_file = Path.home() / ".config/google-chrome" / chrome_profile / "Cookies"
            elif system == "Windows":
                cookie_file = Path.home() / "AppData/Local/Google/Chrome/User Data" / chrome_profile / "Cookies"
            else:
                print(f"[ERROR] Unsupported OS: {system}")
                return []
            
            if not cookie_file.exists():
                print(f"[ERROR] Chrome cookies file not found: {cookie_file}")
                print(f"[INFO] Make sure Chrome is closed and you're logged into Patreon")
                return []
        
        # Get cookies from Chrome
        cookies_dict = chrome_cookies(
            'https://www.patreon.com',
            browser='chrome',
            cookie_file=str(cookie_file)
        )
        
        # Make since_date timezone-aware if it isn't
        if since_date.tzinfo is None:
            since_date_aware = since_date.replace(tzinfo=timezone.utc)
        else:
            since_date_aware = since_date
        
        # Paginate through posts
        new_posts = []
        cursor = None
        page_num = 0
        
        while True:
            page_num += 1
            print(f"[INFO] Fetching page {page_num}...")
            
            # Build API request
            url = "https://www.patreon.com/api/posts"
            params = {
                "include": "campaign",
                "fields[post]": "published_at,title,url,patreon_url",
                "fields[campaign]": "name",
                "filter[campaign_id]": "13637777",  # VAMA's campaign ID
                "filter[contains_exclusive_posts]": "true",
                "filter[is_draft]": "false",
                "sort": "-published_at",
                "page[count]": "50",  # 50 posts per page
                "json-api-version": "1.0"
            }
            
            if cursor:
                params["page[cursor]"] = cursor
            
            response = requests.get(url, params=params, cookies=cookies_dict, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            posts = data.get("data", [])
            
            if not posts:
                print(f"[INFO] No more posts on page {page_num}")
                break
            
            # Process posts on this page
            stop_pagination = False
            for post in posts:
                post_id = post.get("id")
                attributes = post.get("attributes", {})
                title = attributes.get("title", "Untitled")
                published_at = attributes.get("published_at")
                url = attributes.get("url", "")
                
                if not post_id or not published_at:
                    continue
                
                # Parse date
                try:
                    post_date = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                    
                    # Only include posts newer than since_date
                    if post_date > since_date_aware:
                        new_posts.append({
                            "id": post_id,
                            "title": title,
                            "published_at": published_at,
                            "url": url
                        })
                        print(f"[INFO]   - Post {post_id}: {title} ({published_at})")
                    else:
                        # Hit old post, stop pagination
                        print(f"[INFO] Hit old post {post_id} ({published_at}), stopping pagination")
                        stop_pagination = True
                        break
                
                except Exception as e:
                    print(f"[WARNING] Failed to parse date for post {post_id}: {e}")
            
            if stop_pagination:
                break
            
            # Check for next page
            links = data.get("links", {})
            next_url = links.get("next")
            
            if not next_url:
                print(f"[INFO] No more pages")
                break
            
            # Extract cursor from next URL
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(next_url)
            query_params = parse_qs(parsed.query)
            cursor = query_params.get("page[cursor]", [None])[0]
            
            if not cursor:
                break
        
        print(f"[INFO] Found {len(new_posts)} new posts across {page_num} pages")
        return new_posts, chrome_profile
    
    except Exception as e:
        print(f"[ERROR] Failed to fetch post IDs: {e}")
        import traceback
        traceback.print_exc()
        return [], None


def run_gallery_dl_for_single_post(post_id: str, chrome_profile: str, temp_dir: Path) -> dict:
    """
    Run gallery-dl for a single post URL.
    
    Args:
        post_id: Patreon post ID
        chrome_profile: Chrome profile name
        temp_dir: Temporary directory for output
    
    Returns:
        Post metadata dict or None on error
    """
    post_url = f"https://www.patreon.com/posts/{post_id}"
    post_temp_dir = temp_dir / f"post_{post_id}"
    post_temp_dir.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        "gallery-dl",
        "--write-info-json",  # Creates one info.json per post
        "--no-download",
        "--option", f"base-directory={post_temp_dir}",
        "--cookies-from-browser", f"chrome:{chrome_profile}",
        post_url
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            print(f"[WARNING] gallery-dl failed for post {post_id}: {result.stderr[:200]}")
            return None
        
        # Find info.json
        info_json = post_temp_dir / "patreon" / "carza" / "info.json"
        if not info_json.exists():
            # Try finding it anywhere
            info_files = list(post_temp_dir.rglob("info.json"))
            if info_files:
                info_json = info_files[0]
            else:
                print(f"[WARNING] No info.json found for post {post_id}")
                return None
        
        # Read and return metadata
        with open(info_json, 'r') as f:
            metadata = json.load(f)
            return metadata
    
    except Exception as e:
        print(f"[WARNING] Error processing post {post_id}: {e}")
        return None


def run_gallery_dl_for_posts(post_infos: list, chrome_profile: str = "Profile 1") -> list:
    """
    Run gallery-dl for each individual post URL to get full metadata.
    Parallelizes if >10 posts.
    
    Args:
        post_infos: List of dicts with id, title, published_at, url
        chrome_profile: Chrome profile name
    
    Returns:
        List of post metadata dicts with images
    """
    print(f"[3/6] Running gallery-dl for {len(post_infos)} individual posts...")
    
    # TESTING: Limit to last 3 posts (oldest) to avoid chronological gaps
    if len(post_infos) > 3:
        print(f"[DEBUG] TESTING MODE: Limiting to last 3 posts (oldest) out of {len(post_infos)}")
        print(f"[DEBUG] This avoids chronological gaps - we'll import oldest first")
        post_infos = post_infos[-3:]
    
    print()
    print(f"[INFO] Will fetch metadata for {len(post_infos)} posts:")
    for info in post_infos:
        print(f"  - {info['id']}: {info['title']}")
    print()
    
    confirm = input(f"Continue fetching metadata for {len(post_infos)} posts? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("[INFO] Cancelled")
        return []
    
    print()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Decide whether to parallelize
        use_parallel = len(post_infos) > 10
        
        if use_parallel:
            print(f"[INFO] Using parallel execution ({len(post_infos)} posts)...")
            posts_metadata = []
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_post = {
                    executor.submit(run_gallery_dl_for_single_post, info['id'], chrome_profile, temp_path): info
                    for info in post_infos
                }
                
                for future in as_completed(future_to_post):
                    post_info = future_to_post[future]
                    try:
                        metadata = future.result()
                        if metadata:
                            posts_metadata.append(metadata)
                            print(f"[INFO]   ✓ {post_info['id']}: {post_info['title']}")
                        else:
                            print(f"[WARNING]   ✗ {post_info['id']}: Failed to fetch metadata")
                    except Exception as e:
                        print(f"[WARNING]   ✗ {post_info['id']}: Exception: {e}")
        
        else:
            print(f"[INFO] Using sequential execution ({len(post_infos)} posts)...")
            posts_metadata = []
            
            for info in post_infos:
                metadata = run_gallery_dl_for_single_post(info['id'], chrome_profile, temp_path)
                if metadata:
                    posts_metadata.append(metadata)
                    print(f"[INFO]   ✓ {info['id']}: {info['title']}")
                else:
                    print(f"[WARNING]   ✗ {info['id']}: Failed to fetch metadata")
        
        print()
        print(f"[INFO] Successfully fetched metadata for {len(posts_metadata)} out of {len(post_infos)} posts")
        
        return posts_metadata


def download_single_thumbnail(url: str, output_path: Path) -> bool:
    """Download a single thumbnail."""
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            f.write(response.content)

        return True

    except Exception as e:
        print(f"[WARNING] Failed to download {output_path.name}: {e}")
        return False


def download_thumbnails(posts_metadata: list, output_dir: Path, max_workers: int = 10) -> dict:
    """
    Download thumbnails for all posts with UUID naming (parallelized).

    Args:
        posts_metadata: List of post metadata dicts from gallery-dl
        output_dir: Directory to save thumbnails
        max_workers: Number of parallel download threads

    Returns:
        Dict mapping post_id to list of thumbnail filenames
    """
    print(f"[3/6] Downloading thumbnails for {len(posts_metadata)} posts (parallel, {max_workers} threads)...")

    output_dir.mkdir(parents=True, exist_ok=True)
    post_thumbnails = {}

    # Collect all download tasks
    download_tasks = []

    for metadata in posts_metadata:
        post_id = str(metadata.get("id", ""))
        images = metadata.get("images", [])

        if not images:
            print(f"[WARNING] Post {post_id} has no images, skipping")
            continue

        for ordinal, image in enumerate(images):
            file_name = image.get('file_name', '')
            if not file_name:
                continue

            extension = get_file_extension(file_name)
            if not extension:
                continue

            # Get thumbnail URL (prefer thumbnail over full download_url)
            image_urls = image.get('image_urls', {})
            thumbnail_url = image_urls.get('thumbnail') or image.get('download_url')

            if not thumbnail_url:
                continue

            # Generate filename with UUID
            filename = generate_thumbnail_filename(post_id, ordinal, extension)
            output_path = output_dir / filename

            download_tasks.append({
                'post_id': post_id,
                'url': thumbnail_url,
                'output_path': output_path,
                'filename': filename
            })

    # Download in parallel
    print(f"[INFO] Downloading {len(download_tasks)} thumbnails...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_task = {
            executor.submit(download_single_thumbnail, task['url'], task['output_path']): task
            for task in download_tasks
        }

        for future in as_completed(future_to_task):
            task = future_to_task[future]
            try:
                success = future.result()
                if success:
                    post_id = task['post_id']
                    filename = task['filename']

                    if post_id not in post_thumbnails:
                        post_thumbnails[post_id] = []
                    post_thumbnails[post_id].append(filename)

                    print(f"[INFO]   Downloaded: {filename}")
            except Exception as e:
                print(f"[WARNING] Exception downloading {task['filename']}: {e}")

    print(f"[INFO] Downloaded thumbnails for {len(post_thumbnails)} posts")
    return post_thumbnails


def rsync_to_server(local_dir: Path, server: str, remote_path: str) -> bool:
    """
    Rsync thumbnails to server staging area.

    Args:
        local_dir: Local directory with thumbnails
        server: Server address (e.g., deploy@hostname)
        remote_path: Remote staging path

    Returns:
        True if successful
    """
    print(f"[4/6] Uploading thumbnails to server...")

    # Create staging directory on server
    mkdir_cmd = ["ssh", server, f"mkdir -p {remote_path}"]
    result = subprocess.run(mkdir_cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[ERROR] Failed to create staging directory: {result.stderr}")
        return False

    # Get list of files to upload
    files_to_upload = list(local_dir.glob('*'))
    
    if not files_to_upload:
        print(f"[ERROR] No files to upload in {local_dir}")
        return False
    
    print(f"[INFO] Uploading {len(files_to_upload)} items with rsync...")
    
    # Use rsync for faster, more reliable transfer
    # -a: archive mode (recursive, preserve permissions, etc.)
    # -v: verbose
    # -z: compress during transfer
    # --progress: show progress
    # Trailing slash on source means "copy contents" not "copy directory itself"
    rsync_cmd = [
        "rsync",
        "-avz",
        "--progress",
        f"{local_dir}/",  # Trailing slash = copy contents
        f"{server}:{remote_path}/"
    ]
    
    result = subprocess.run(rsync_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Rsync failed: {result.stderr}")
        return False
    
    # Show summary from rsync output
    print(result.stdout)
    print(f"[INFO] Successfully uploaded {len(files_to_upload)} items")
    return True


def create_sql_file(posts_metadata: list, post_thumbnails: dict, output_path: Path):
    """
    Create SQL file to insert posts into database.

    Args:
        posts_metadata: List of post metadata from gallery-dl
        post_thumbnails: Dict mapping post_id to thumbnail filenames
        output_path: Path to save insert_posts.sql
    """
    print("[INFO] Creating SQL file...")

    sql_lines = [
        "-- Insert posts from import",
        "-- Generated: " + datetime.now(timezone.utc).isoformat(),
        "",
        "BEGIN;",
        ""
    ]

    for metadata in posts_metadata:
        post_id = str(metadata.get("id", ""))

        if post_id not in post_thumbnails:
            continue

        # Parse timestamp
        date_str = metadata.get("published_at") or metadata.get("date")
        timestamp = None
        if date_str:
            try:
                if isinstance(date_str, str):
                    timestamp = datetime.fromisoformat(date_str.replace("Z", "+00:00")).isoformat()
                else:
                    timestamp = date_str.isoformat()
            except:
                timestamp = datetime.now().isoformat()

        # Escape single quotes in strings
        title = metadata.get("title", "Untitled").replace("'", "''")
        patreon_url = metadata.get("url", "").replace("'", "''")
        
        # Build thumbnail_urls array
        thumbnail_urls = [f"/static/thumbnails/{filename}" for filename in post_thumbnails[post_id]]
        thumbnail_urls_str = "{" + ",".join(f'"{url}"' for url in thumbnail_urls) + "}"
        
        # First thumbnail as thumbnail_url
        thumbnail_url = thumbnail_urls[0] if thumbnail_urls else ""

        # Generate INSERT statement
        sql = f"""
-- Post: {title}
INSERT INTO posts (post_id, title, patreon_url, timestamp, thumbnail_url, thumbnail_urls, status, characters, series, tags, created_at, updated_at)
VALUES (
    '{post_id}',
    '{title}',
    '{patreon_url}',
    '{timestamp}',
    '{thumbnail_url}',
    ARRAY{thumbnail_urls_str}::text[],
    'pending',
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    NOW(),
    NOW()
)
ON CONFLICT (post_id) DO NOTHING;
"""
        sql_lines.append(sql)

    sql_lines.append("")
    sql_lines.append("COMMIT;")
    sql_lines.append("")

    with open(output_path, 'w') as f:
        f.write('\n'.join(sql_lines))

    print(f"[INFO] Saved SQL for {len(posts_metadata)} posts")


def run_server_ingest(server: str, staging_path: str) -> bool:
    """
    SSH to server to move thumbnails and apply SQL.

    Args:
        server: Server address
        staging_path: Remote staging path

    Returns:
        True if successful
    """
    print(f"[6/6] Ingesting posts on server...")

    # Step 1: Move thumbnails to production directory
    print("[INFO] Moving thumbnails to production...")
    move_cmd = [
        "ssh", server,
        f"mv {staging_path}/thumbnails/* ~/vamasubmissions/backend/static/thumbnails/"
    ]
    
    result = subprocess.run(move_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Failed to move thumbnails: {result.stderr}")
        return False
    
    print("[INFO] Thumbnails moved successfully")

    # Step 2: Apply SQL to database
    print("[INFO] Applying SQL to database...")
    sql_cmd = [
        "ssh", server,
        f"sudo -u postgres psql -d vamasubmissions -f {staging_path}/insert_posts.sql"
    ]
    
    result = subprocess.run(sql_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Failed to apply SQL: {result.stderr}")
        return False
    
    print(result.stdout)
    print("[INFO] SQL applied successfully")

    # Step 3: Clean up staging area
    print("[INFO] Cleaning up staging area...")
    cleanup_cmd = [
        "ssh", server,
        f"rm -rf {staging_path}"
    ]
    
    result = subprocess.run(cleanup_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[WARNING] Failed to clean up staging area: {result.stderr}")
        # Don't fail on cleanup error
    else:
        print("[INFO] Staging area cleaned up")

    return True


def main():
    parser = argparse.ArgumentParser(description="Import VAMA posts from local machine to production")
    parser.add_argument("--server", required=True, help="Server address (e.g., deploy@hostname)")
    parser.add_argument("--api-url", default="https://vamarequests.com", help="API base URL")
    parser.add_argument("--creator", default="vama", help="Patreon creator username")
    parser.add_argument("--days", type=int, default=7, help="Fallback days if no posts exist")
    parser.add_argument("--chrome-profile", default="Profile 1", help="Chrome profile name")
    parser.add_argument("--staging-path", default="~/vamasubmissions/import-staging", help="Remote staging path")
    parser.add_argument("--max-posts", type=int, default=None, help="Maximum number of posts to import (for testing)")

    args = parser.parse_args()

    print("=" * 70)
    print("VAMA Posts Import Script (Local → Production)")
    print("=" * 70)
    print()

    # Step 1: Get latest post date from database
    latest_data = fetch_latest_post_date(args.server)

    if latest_data and latest_data.get("latest_date"):
        since_date = datetime.fromisoformat(latest_data["latest_date"].replace("Z", "+00:00"))
        print(f"[INFO] Latest post in database: {latest_data['post_id']} at {latest_data['latest_date']}")
    else:
        since_date = datetime.now(timezone.utc) - timedelta(days=args.days)
        print(f"[INFO] No posts in database, using fallback: {args.days} days ago")

    print()

    # Step 2: Fetch post IDs from Patreon API
    # Pass None to auto-detect Chrome profile, or use --chrome-profile to specify
    chrome_profile_arg = None if args.chrome_profile == "Profile 1" else args.chrome_profile
    post_infos, detected_chrome_profile = fetch_post_ids_from_patreon(args.creator, since_date, chrome_profile_arg)

    if not post_infos:
        print("[INFO] No new posts found")
        return

    print()
    print("=" * 70)
    print(f"[INFO] Found {len(post_infos)} new posts from Patreon API")
    for info in post_infos:
        print(f"  - {info['id']}: {info['title']} ({info['published_at']})")
    print("=" * 70)
    print()
    
    confirm = input(f"Continue fetching metadata for {len(post_infos)} posts? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("[INFO] Import cancelled")
        return
    
    print()

    # Step 3: Run gallery-dl for each post to get full metadata
    posts_metadata = run_gallery_dl_for_posts(post_infos, detected_chrome_profile)

    if not posts_metadata:
        print("[INFO] No metadata fetched, aborting")
        return

    print()

    # Step 4: Download thumbnails
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        thumbnails_dir = temp_path / "thumbnails"

        post_thumbnails = download_thumbnails(posts_metadata, thumbnails_dir)

        if not post_thumbnails:
            print("[ERROR] No thumbnails downloaded, aborting")
            return

        print()

        # Create SQL file
        sql_file = temp_path / "insert_posts.sql"
        create_sql_file(posts_metadata, post_thumbnails, sql_file)

        print()

        # Step 5: Rsync to server
        success = rsync_to_server(temp_path, args.server, args.staging_path)

        if not success:
            print("[ERROR] Failed to upload to server")
            return

        print()

        # Step 6: Confirm before running ingest
        print("[6/6] Ready to ingest posts on server")
        print(f"[INFO] This will:")
        print(f"  - Move {len(list(thumbnails_dir.glob('*')))} thumbnails to production")
        print(f"  - Insert {len(post_thumbnails)} posts into database")
        print(f"  - Clean up staging area on success")
        print()

        confirm = input("Continue with ingest? (yes/no): ").strip().lower()

        if confirm != "yes":
            print("[INFO] Ingest cancelled. Files remain in staging area:")
            print(f"[INFO]   {args.server}:{args.staging_path}")
            print(f"[INFO] You can manually run:")
            print(f"[INFO]   ssh {args.server}")
            print(f"[INFO]   mv {args.staging_path}/thumbnails/* ~/vamasubmissions/backend/static/thumbnails/")
            print(f"[INFO]   sudo -u postgres psql -d vamasubmissions -f {args.staging_path}/insert_posts.sql")
            return

        print()

        # Step 7: Run ingest on server
        success = run_server_ingest(args.server, args.staging_path)

        if success:
            print()
            print("=" * 70)
            print("[SUCCESS] Import complete!")
            print("=" * 70)
        else:
            print()
            print("=" * 70)
            print("[ERROR] Import failed. Files remain in staging area for review.")
            print(f"[INFO] Staging path: {args.server}:{args.staging_path}")
            print("=" * 70)


if __name__ == "__main__":
    main()
