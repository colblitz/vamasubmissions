#!/usr/bin/env python3
"""
Unified Post Processing Script

This script handles both importing new posts and redownloading thumbnails for existing posts.
The core workflow is identical: get post IDs → gallery-dl → download thumbnails → sync to server.

Post ID Sources (choose one):
1. --from-patreon: Query server for latest post, then fetch new posts from Patreon API
2. --from-file: Read post IDs from file (one per line)
3. --from-db: Query local database for post IDs (requires DATABASE_URL)

All modes:
- Run gallery-dl for each post to get metadata
- Download thumbnails in parallel (1080x1080)
- Upload to server via rsync
- Generate SQL that handles INSERT (new) or UPDATE (existing)

Usage:
    # Import new posts from Patreon
    python3 scripts/process_posts.py --from-patreon --server deploy@SERVER

    # Redownload specific posts from file
    python3 scripts/process_posts.py --from-file post_ids.txt --server deploy@SERVER

    # Redownload all posts from database
    python3 scripts/process_posts.py --from-db --all --server deploy@SERVER

    # Redownload with limit
    python3 scripts/process_posts.py --from-db --limit 10 --server deploy@SERVER
"""

import argparse
import subprocess
import json
import sys
import requests
import hashlib
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Tuple, Optional

# Import shared utilities
from import_utils import (
    generate_thumbnail_filename,
    get_file_extension,
    find_chrome_profile_with_patreon_cookies,
    download_single_image,
    run_gallery_dl_for_post
)


# ============================================================================
# Post ID Sourcing
# ============================================================================

def fetch_latest_post_from_server(server: str) -> Optional[Dict]:
    """Fetch latest post date from production database via SSH."""
    print("[INFO] Fetching latest post date from production database...")
    
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
        
        if not output:
            print("[INFO] No posts in database yet")
            return {"latest_date": None, "post_id": None}
        
        parts = [p.strip() for p in output.split('|')]
        if len(parts) >= 2:
            post_id = parts[0]
            timestamp_str = parts[1]
            print(f"[INFO] Latest post: {post_id} at {timestamp_str}")
            return {"latest_date": timestamp_str, "post_id": post_id}
        
        return None
    
    except Exception as e:
        print(f"[ERROR] Failed to fetch latest date: {e}")
        return None


def fetch_post_ids_from_patreon(since_date: datetime, chrome_profile: Optional[str] = None) -> Tuple[List[Dict], str]:
    """Fetch post IDs from Patreon API using Chrome cookies."""
    print(f"[INFO] Fetching post list from Patreon API...")
    
    try:
        from pycookiecheat import chrome_cookies
    except ImportError:
        print("[ERROR] pycookiecheat not installed. Install with: pip install pycookiecheat")
        return [], None
    
    try:
        # Auto-detect Chrome profile if not specified
        if chrome_profile is None:
            print("[INFO] Auto-detecting Chrome profile with Patreon cookies...")
            chrome_profile, cookie_file = find_chrome_profile_with_patreon_cookies()
            
            if chrome_profile is None:
                print("[ERROR] Could not find Chrome profile with Patreon cookies")
                return [], None
        else:
            # Use specified profile
            import platform
            system = platform.system()
            
            if system == "Darwin":
                cookie_file = Path.home() / "Library/Application Support/Google/Chrome" / chrome_profile / "Cookies"
            elif system == "Linux":
                cookie_file = Path.home() / ".config/google-chrome" / chrome_profile / "Cookies"
            elif system == "Windows":
                cookie_file = Path.home() / "AppData/Local/Google/Chrome/User Data" / chrome_profile / "Cookies"
            else:
                print(f"[ERROR] Unsupported OS: {system}")
                return [], None
            
            if not cookie_file.exists():
                print(f"[ERROR] Chrome cookies file not found: {cookie_file}")
                return [], None
        
        # Get cookies from Chrome
        cookies_dict = chrome_cookies('https://www.patreon.com', browser='chrome', cookie_file=str(cookie_file))
        
        # Make since_date timezone-aware
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
            
            url = "https://www.patreon.com/api/posts"
            params = {
                "include": "campaign",
                "fields[post]": "published_at,title,url,patreon_url",
                "fields[campaign]": "name",
                "filter[campaign_id]": "13637777",  # VAMA's campaign ID
                "filter[contains_exclusive_posts]": "true",
                "filter[is_draft]": "false",
                "sort": "-published_at",
                "page[count]": "50",
                "json-api-version": "1.0"
            }
            
            if cursor:
                params["page[cursor]"] = cursor
            
            response = requests.get(url, params=params, cookies=cookies_dict, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            posts = data.get("data", [])
            
            if not posts:
                break
            
            # Process posts
            stop_pagination = False
            for post in posts:
                post_id = post.get("id")
                attributes = post.get("attributes", {})
                title = attributes.get("title", "Untitled")
                published_at = attributes.get("published_at")
                url = attributes.get("url", "")
                
                if not post_id or not published_at:
                    continue
                
                try:
                    post_date = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                    
                    if post_date > since_date_aware:
                        new_posts.append({
                            "id": post_id,
                            "title": title,
                            "published_at": published_at,
                            "url": url
                        })
                        print(f"[INFO]   - Post {post_id}: {title} ({published_at})")
                    else:
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
                break
            
            # Extract cursor
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


def fetch_post_ids_from_file(file_path: str) -> List[Dict]:
    """Read post IDs from file (one per line)."""
    print(f"[INFO] Reading post IDs from file: {file_path}")
    
    try:
        with open(file_path, 'r') as f:
            post_ids = [line.strip() for line in f if line.strip()]
        
        posts = [{"id": pid, "title": f"Post {pid}", "published_at": None, "url": ""} for pid in post_ids]
        print(f"[INFO] Read {len(posts)} post IDs from file")
        return posts
    
    except FileNotFoundError:
        print(f"[ERROR] File not found: {file_path}")
        return []
    except Exception as e:
        print(f"[ERROR] Error reading file: {e}")
        return []


def fetch_post_ids_from_db(limit: Optional[int] = None, all_posts: bool = False) -> List[Dict]:
    """Fetch post IDs from local database."""
    print(f"[INFO] Fetching post IDs from local database...")
    
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("[ERROR] psycopg2 not installed. Install with: pip install psycopg2-binary")
        return []
    
    import os
    db_url = os.environ.get('DATABASE_URL', 'postgresql://localhost/vamasubmissions')
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if limit:
            cur.execute("SELECT id, post_id, title, timestamp FROM posts ORDER BY id LIMIT %s", (limit,))
        else:
            cur.execute("SELECT id, post_id, title, timestamp FROM posts ORDER BY id")
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        posts = [{
            "id": str(row['post_id']),
            "title": row['title'],
            "published_at": row['timestamp'].isoformat() if row['timestamp'] else None,
            "url": ""
        } for row in rows]
        
        print(f"[INFO] Found {len(posts)} posts from database")
        return posts
    
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        return []


# ============================================================================
# Core Processing
# ============================================================================

def process_posts_parallel(post_infos: List[Dict], chrome_profile: str, max_workers: int = 5) -> List[Dict]:
    """Run gallery-dl for multiple posts in parallel."""
    print(f"[INFO] Processing {len(post_infos)} posts with gallery-dl (parallel, {max_workers} workers)...")
    
    posts_metadata = []
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_post = {
                executor.submit(run_gallery_dl_for_post, info['id'], chrome_profile, temp_path): info
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
    
    print(f"[INFO] Successfully fetched metadata for {len(posts_metadata)} out of {len(post_infos)} posts")
    return posts_metadata


def download_thumbnails_parallel(posts_metadata: List[Dict], output_dir: Path, max_workers: int = 10) -> Dict[str, List[str]]:
    """Download thumbnails for all posts in parallel."""
    print(f"[INFO] Downloading thumbnails for {len(posts_metadata)} posts (parallel, {max_workers} threads)...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    post_thumbnails = {}
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
            
            # Get thumbnail URL (360x360 square)
            image_urls = image.get('image_urls', {})
            thumbnail_url = image_urls.get('thumbnail')
            
            if not thumbnail_url:
                thumbnail_url = image.get('download_url')
            
            if not thumbnail_url:
                continue
            
            filename = generate_thumbnail_filename(post_id, ordinal, extension)
            output_path = output_dir / filename
            
            download_tasks.append({
                'post_id': post_id,
                'url': thumbnail_url,
                'output_path': output_path,
                'filename': filename
            })
    
    print(f"[INFO] Downloading {len(download_tasks)} thumbnails...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_task = {
            executor.submit(download_single_image, task['url'], str(task['output_path'])): task
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


# ============================================================================
# SQL Generation
# ============================================================================

def create_upsert_sql(posts_metadata: List[Dict], post_thumbnails: Dict[str, List[str]], output_path: Path):
    """Create SQL that inserts new posts or updates existing ones."""
    print("[INFO] Creating SQL file...")
    
    sql_lines = [
        "-- Upsert posts (insert new or update existing)",
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
        
        # Escape single quotes
        title = metadata.get("title", "Untitled").replace("'", "''")
        patreon_url = metadata.get("url", "").replace("'", "''")
        
        # Build thumbnail_urls array
        thumbnail_urls = [f"/static/thumbnails/{filename}" for filename in post_thumbnails[post_id]]
        thumbnail_urls_str = "ARRAY[" + ",".join(f"'{url}'" for url in thumbnail_urls) + "]"
        thumbnail_url = thumbnail_urls[0] if thumbnail_urls else ""
        
        # UPSERT: Insert if new, update thumbnails if exists
        sql = f"""
-- Post: {title}
INSERT INTO posts (post_id, title, patreon_url, timestamp, thumbnail_url, thumbnail_urls, status, characters, series, tags, created_at, updated_at)
VALUES (
    '{post_id}',
    '{title}',
    '{patreon_url}',
    '{timestamp}',
    '{thumbnail_url}',
    {thumbnail_urls_str}::text[],
    'pending',
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    NOW(),
    NOW()
)
ON CONFLICT (post_id) DO UPDATE SET
    thumbnail_url = EXCLUDED.thumbnail_url,
    thumbnail_urls = EXCLUDED.thumbnail_urls,
    updated_at = NOW();
"""
        sql_lines.append(sql)
    
    sql_lines.append("")
    sql_lines.append("COMMIT;")
    sql_lines.append("")
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"[INFO] Saved SQL for {len(posts_metadata)} posts")


# ============================================================================
# Server Operations
# ============================================================================

def rsync_to_server(local_dir: Path, server: str, remote_path: str) -> bool:
    """Rsync files to server staging area."""
    print(f"[INFO] Uploading to server...")
    
    # Create staging directory
    mkdir_cmd = ["ssh", server, f"mkdir -p {remote_path}"]
    result = subprocess.run(mkdir_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Failed to create staging directory: {result.stderr}")
        return False
    
    files_to_upload = list(local_dir.glob('*'))
    if not files_to_upload:
        print(f"[ERROR] No files to upload")
        return False
    
    print(f"[INFO] Uploading {len(files_to_upload)} items with rsync...")
    print()
    
    rsync_cmd = ["rsync", "-avz", "--progress", f"{local_dir}/", f"{server}:{remote_path}/"]
    result = subprocess.run(rsync_cmd)
    
    if result.returncode != 0:
        print(f"[ERROR] Rsync failed with exit code {result.returncode}")
        return False
    
    print()
    print(f"[INFO] Successfully uploaded {len(files_to_upload)} items")
    return True


def run_server_ingest(server: str, staging_path: str) -> bool:
    """SSH to server to move thumbnails and apply SQL."""
    print(f"[INFO] Ingesting on server...")
    print()
    
    # Move thumbnails
    print("[INFO] Moving thumbnails to production...")
    move_cmd = ["ssh", server, f"mv -v {staging_path}/thumbnails/* ~/vamasubmissions/backend/static/thumbnails/"]
    result = subprocess.run(move_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Failed to move thumbnails: {result.stderr}")
        return False
    
    print("[SUCCESS] Thumbnails moved")
    print()
    
    # Apply SQL
    print("[INFO] Applying SQL to database...")
    sql_cmd = ["ssh", server, f"sudo -u postgres psql -d vamasubmissions -f {staging_path}/upsert_posts.sql"]
    result = subprocess.run(sql_cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[ERROR] Failed to apply SQL: {result.stderr}")
        return False
    
    print(result.stdout)
    print("[SUCCESS] SQL applied")
    print()
    
    # Verify
    print("[INFO] Verifying posts in database...")
    verify_cmd = ["ssh", server, "sudo -u postgres psql -d vamasubmissions -c \"SELECT post_id, title, status FROM posts ORDER BY updated_at DESC LIMIT 5;\""]
    result = subprocess.run(verify_cmd, capture_output=True, text=True)
    print(result.stdout)
    
    # Cleanup
    print("[INFO] Cleaning up staging area...")
    cleanup_cmd = ["ssh", server, f"rm -rf {staging_path}"]
    subprocess.run(cleanup_cmd, capture_output=True, text=True)
    print("[SUCCESS] Staging area cleaned up")
    
    return True


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Unified post processing script")
    
    # Post ID source (mutually exclusive)
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--from-patreon", action="store_true", help="Fetch new posts from Patreon API")
    source_group.add_argument("--from-file", metavar="FILE", help="Read post IDs from file")
    source_group.add_argument("--from-db", action="store_true", help="Fetch posts from local database")
    
    # Common options
    parser.add_argument("--server", required=True, help="Server address (e.g., deploy@hostname)")
    parser.add_argument("--chrome-profile", help="Chrome profile name (auto-detected if not specified)")
    parser.add_argument("--staging-path", default="~/vamasubmissions/import-staging", help="Remote staging path")
    parser.add_argument("--skip-confirmations", action="store_true", help="Skip all confirmation prompts")
    
    # Database options (for --from-db)
    parser.add_argument("--all", action="store_true", help="Process all posts from database")
    parser.add_argument("--limit", type=int, help="Limit number of posts")
    
    # Patreon options (for --from-patreon)
    parser.add_argument("--days", type=int, default=7, help="Fallback days if no posts exist (default: 7)")
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("Unified Post Processing Script")
    print("=" * 70)
    print()
    
    # Step 1: Get post IDs
    post_infos = []
    chrome_profile = args.chrome_profile
    
    if args.from_patreon:
        # Fetch latest from server, then query Patreon API
        latest_data = fetch_latest_post_from_server(args.server)
        
        if latest_data and latest_data.get("latest_date"):
            since_date = datetime.fromisoformat(latest_data["latest_date"].replace("Z", "+00:00"))
            print(f"[INFO] Latest post in database: {latest_data['post_id']} at {latest_data['latest_date']}")
        else:
            since_date = datetime.now(timezone.utc) - timedelta(days=args.days)
            print(f"[INFO] No posts in database, using fallback: {args.days} days ago")
        
        print()
        post_infos, chrome_profile = fetch_post_ids_from_patreon(since_date, chrome_profile)
    
    elif args.from_file:
        post_infos = fetch_post_ids_from_file(args.from_file)
        # For file mode, detect chrome profile if not specified
        if not chrome_profile:
            chrome_profile, _ = find_chrome_profile_with_patreon_cookies()
            if not chrome_profile:
                print("[ERROR] Could not detect Chrome profile. Specify with --chrome-profile")
                return
    
    elif args.from_db:
        if not args.all and not args.limit:
            print("[ERROR] --from-db requires either --all or --limit")
            return
        
        post_infos = fetch_post_ids_from_db(limit=args.limit, all_posts=args.all)
        # For db mode, detect chrome profile if not specified
        if not chrome_profile:
            chrome_profile, _ = find_chrome_profile_with_patreon_cookies()
            if not chrome_profile:
                print("[ERROR] Could not detect Chrome profile. Specify with --chrome-profile")
                return
    
    if not post_infos:
        print("[INFO] No posts to process")
        return
    
    print()
    print("=" * 70)
    print(f"[INFO] Found {len(post_infos)} posts to process")
    for info in post_infos[:10]:  # Show first 10
        print(f"  - {info['id']}: {info['title']}")
    if len(post_infos) > 10:
        print(f"  ... and {len(post_infos) - 10} more")
    print("=" * 70)
    print()
    
    if not args.skip_confirmations:
        confirm = input(f"Continue processing {len(post_infos)} posts? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("[INFO] Cancelled")
            return
    
    print()
    
    # Step 2: Process posts with gallery-dl
    posts_metadata = process_posts_parallel(post_infos, chrome_profile)
    
    if not posts_metadata:
        print("[INFO] No metadata fetched")
        return
    
    print()
    
    # Step 3: Download thumbnails
    work_dir = Path.home() / ".vamasubmissions_import"
    work_dir.mkdir(exist_ok=True)
    
    post_ids_hash = hashlib.md5(",".join([p['id'] for p in post_infos]).encode()).hexdigest()[:8]
    session_dir = work_dir / f"session_{post_ids_hash}"
    session_dir.mkdir(exist_ok=True)
    
    thumbnails_dir = session_dir / "thumbnails"
    sql_file = session_dir / "upsert_posts.sql"
    
    post_thumbnails = download_thumbnails_parallel(posts_metadata, thumbnails_dir)
    
    if not post_thumbnails:
        print("[ERROR] No thumbnails downloaded")
        return
    
    print()
    
    # Step 4: Create SQL
    create_upsert_sql(posts_metadata, post_thumbnails, sql_file)
    print()
    
    # Step 5: Verify thumbnails
    if not args.skip_confirmations:
        print("=" * 70)
        print("[INFO] Thumbnails downloaded to: {thumbnails_dir}")
        print(f"[INFO] Total thumbnails: {len(list(thumbnails_dir.glob('*')))}")
        print("=" * 70)
        print()
        confirm = input("Continue with upload to server? (yes/no): ").strip().lower()
        if confirm != "yes":
            print(f"[INFO] Cancelled. Files saved at: {session_dir}")
            return
        print()
    
    # Step 6: Upload to server
    success = rsync_to_server(session_dir, args.server, args.staging_path)
    
    if not success:
        print(f"[ERROR] Upload failed. Files saved at: {session_dir}")
        return
    
    print()
    
    # Step 7: Ingest on server
    if not args.skip_confirmations:
        print("=" * 70)
        print("[INFO] Ready to ingest on server")
        print(f"[INFO] Posts: {len(post_thumbnails)}")
        print(f"[INFO] Thumbnails: {len(list(thumbnails_dir.glob('*')))}")
        print("=" * 70)
        print()
        confirm = input("Continue with ingest? (yes/no): ").strip().lower()
        if confirm != "yes":
            print(f"[INFO] Cancelled. Files on server: {args.server}:{args.staging_path}")
            return
        print()
    
    success = run_server_ingest(args.server, args.staging_path)
    
    if success:
        print()
        print("=" * 70)
        print("[SUCCESS] Processing complete!")
        print("=" * 70)
        
        # Cleanup local session
        import shutil
        shutil.rmtree(session_dir)
        print(f"[INFO] Removed local session: {session_dir}")
    else:
        print()
        print("=" * 70)
        print("[ERROR] Ingest failed")
        print(f"[INFO] Server: {args.server}:{args.staging_path}")
        print(f"[INFO] Local: {session_dir}")
        print("=" * 70)


if __name__ == "__main__":
    main()
