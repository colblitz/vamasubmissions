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


def fetch_latest_post_date(api_url: str) -> dict:
    """
    Fetch the latest post date from production API.

    Args:
        api_url: Base API URL (e.g., https://vamarequests.com)

    Returns:
        Dict with latest_date and post_id, or None if no posts exist
    """
    print("[1/6] Fetching latest post date from production...")

    try:
        response = requests.get(urljoin(api_url, "/api/posts/latest-date"), timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("latest_date"):
            print(f"[INFO] Latest post: {data['post_id']} at {data['latest_date']}")
        else:
            print("[INFO] No posts in database yet, will use fallback date")

        return data

    except Exception as e:
        print(f"[ERROR] Failed to fetch latest date: {e}")
        return None


def run_gallery_dl(creator_username: str, since_date: datetime, chrome_profile: str = "Profile 1") -> list:
    """
    Run gallery-dl locally with --cookies-from-browser.

    Args:
        creator_username: Patreon creator username
        since_date: Fetch posts since this date
        chrome_profile: Chrome profile name

    Returns:
        List of post metadata dicts
    """
    print(f"[2/6] Running gallery-dl for {creator_username} since {since_date.date()}...")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Build gallery-dl command
        cmd = [
            "gallery-dl",
            "--write-info-json",
            "--no-download",
            "--option", f"base-directory={temp_dir}",
            "--cookies-from-browser", f"chrome:{chrome_profile}",
            "--filter", f"date >= datetime({since_date.year}, {since_date.month}, {since_date.day}) or abort()",
            f"https://www.patreon.com/{creator_username}/posts"
        ]

        print(f"[INFO] Command: {' '.join(cmd)}")
        print(f"[INFO] This may take a few minutes...")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode != 0:
                print(f"[ERROR] gallery-dl failed: {result.stderr}")
                return []

            # Find all info.json files
            info_files = list(temp_path.rglob("info.json"))
            print(f"[INFO] Found {len(info_files)} posts")

            posts = []
            for info_file in info_files:
                try:
                    with open(info_file, 'r') as f:
                        metadata = json.load(f)
                        post_id = str(metadata.get("id", ""))
                        if post_id:
                            posts.append(metadata)
                            print(f"[INFO]   - Post {post_id}: {metadata.get('title', 'Untitled')}")
                except Exception as e:
                    print(f"[WARNING] Failed to parse {info_file}: {e}")

            return posts

        except subprocess.TimeoutExpired:
            print("[ERROR] gallery-dl timed out after 5 minutes")
            return []
        except FileNotFoundError:
            print("[ERROR] gallery-dl not found. Install with: pip install gallery-dl")
            return []


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


def scp_to_server(local_dir: Path, server: str, remote_path: str) -> bool:
    """
    SCP thumbnails to server staging area.

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

    # SCP all files
    scp_cmd = ["scp", "-r", f"{local_dir}/*", f"{server}:{remote_path}/"]
    result = subprocess.run(scp_cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[ERROR] SCP failed: {result.stderr}")
        return False

    print(f"[INFO] Uploaded {len(list(local_dir.glob('*')))} files")
    return True


def create_metadata_file(posts_metadata: list, post_thumbnails: dict, output_path: Path):
    """
    Create metadata JSON file with post data and thumbnail mappings.

    Args:
        posts_metadata: List of post metadata from gallery-dl
        post_thumbnails: Dict mapping post_id to thumbnail filenames
        output_path: Path to save metadata.json
    """
    print("[INFO] Creating metadata file...")

    import_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "posts": []
    }

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

        post_data = {
            "post_id": post_id,
            "title": metadata.get("title", "Untitled"),
            "patreon_url": metadata.get("url", ""),
            "timestamp": timestamp,
            "thumbnail_filenames": post_thumbnails[post_id],
            "raw_patreon_json": metadata
        }

        import_data["posts"].append(post_data)

    with open(output_path, 'w') as f:
        json.dump(import_data, f, indent=2, default=str)

    print(f"[INFO] Saved metadata for {len(import_data['posts'])} posts")


def run_server_ingest(server: str, staging_path: str) -> bool:
    """
    SSH to server and run ingest script.

    Args:
        server: Server address
        staging_path: Remote staging path

    Returns:
        True if successful
    """
    print(f"[5/6] Running ingest script on server...")

    ssh_cmd = [
        "ssh", server,
        f"cd ~/vamasubmissions && python3 scripts/ingest_imports.py --staging-dir {staging_path}"
    ]

    result = subprocess.run(ssh_cmd, capture_output=True, text=True)

    print(result.stdout)

    if result.returncode != 0:
        print(f"[ERROR] Ingest script failed: {result.stderr}")
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="Import VAMA posts from local machine to production")
    parser.add_argument("--server", required=True, help="Server address (e.g., deploy@hostname)")
    parser.add_argument("--api-url", default="https://vamarequests.com", help="API base URL")
    parser.add_argument("--creator", default="vama", help="Patreon creator username")
    parser.add_argument("--days", type=int, default=7, help="Fallback days if no posts exist")
    parser.add_argument("--chrome-profile", default="Profile 1", help="Chrome profile name")
    parser.add_argument("--staging-path", default="~/vamasubmissions/import-staging", help="Remote staging path")

    args = parser.parse_args()

    print("=" * 70)
    print("VAMA Posts Import Script (Local → Production)")
    print("=" * 70)
    print()

    # Step 1: Get latest post date
    latest_data = fetch_latest_post_date(args.api_url)

    if latest_data and latest_data.get("latest_date"):
        since_date = datetime.fromisoformat(latest_data["latest_date"].replace("Z", "+00:00"))
    else:
        since_date = datetime.now(timezone.utc) - timedelta(days=args.days)
        print(f"[INFO] Using fallback: {args.days} days ago")

    print()

    # Step 2: Run gallery-dl
    posts_metadata = run_gallery_dl(args.creator, since_date, args.chrome_profile)

    if not posts_metadata:
        print("[INFO] No new posts found")
        return

    print()

    # Step 3: Download thumbnails
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        thumbnails_dir = temp_path / "thumbnails"

        post_thumbnails = download_thumbnails(posts_metadata, thumbnails_dir)

        if not post_thumbnails:
            print("[ERROR] No thumbnails downloaded, aborting")
            return

        print()

        # Create metadata file
        metadata_file = temp_path / "import_metadata.json"
        create_metadata_file(posts_metadata, post_thumbnails, metadata_file)

        print()

        # Step 4: SCP to server
        success = scp_to_server(temp_path, args.server, args.staging_path)

        if not success:
            print("[ERROR] Failed to upload to server")
            return

        print()

        # Step 5: Confirm before running ingest
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
            print(f"[INFO] You can manually run: ssh {args.server} 'cd ~/vamasubmissions && python3 scripts/ingest_imports.py'")
            return

        print()

        # Step 6: Run ingest on server
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
