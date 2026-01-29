"""
Patreon Service

Handles fetching posts from Patreon using gallery-dl.
Uses OAuth token for authentication.
"""

import requests
import subprocess
import json
import tempfile
import os
import sqlite3
import time
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request

from app.core.config import settings
from app.utils.thumbnail_utils import generate_thumbnail_filename, get_file_extension


class PatreonAPIError(Exception):
    """Custom exception for Patreon API errors"""

    pass


def find_chrome_profile_with_patreon_cookies() -> Optional[str]:
    """
    Auto-detect which Chrome profile has Patreon cookies.

    Returns:
        Chrome profile identifier (e.g., 'Default', 'Profile 1') or None
    """
    chrome_base = Path.home() / "Library/Application Support/Google/Chrome"

    if not chrome_base.exists():
        print("[COOKIE-DETECT] Chrome not found")
        return None

    # Check all profiles
    profiles_to_check = [
        ("Default", chrome_base / "Default/Cookies"),
        ("Profile 1", chrome_base / "Profile 1/Cookies"),
        ("Profile 2", chrome_base / "Profile 2/Cookies"),
        ("Profile 3", chrome_base / "Profile 3/Cookies"),
    ]

    for profile_name, cookies_path in profiles_to_check:
        if not cookies_path.exists():
            continue

        try:
            conn = sqlite3.connect(f"file:{cookies_path}?mode=ro", uri=True)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) 
                FROM cookies 
                WHERE host_key LIKE '%patreon.com%' AND name = 'session_id'
            """)
            count = cursor.fetchone()[0]
            conn.close()

            if count > 0:
                print(f"[COOKIE-DETECT] Found Patreon session_id in Chrome {profile_name}")
                return profile_name
        except Exception as e:
            print(f"[COOKIE-DETECT] Error checking {profile_name}: {e}")
            continue

    print("[COOKIE-DETECT] No Patreon session_id found in any Chrome profile")
    return None


class PatreonService:
    """Service for interacting with Patreon API"""

    BASE_URL = "https://www.patreon.com/api/oauth2/v2"

    def __init__(self, access_token: str):
        """
        Initialize Patreon service with access token.

        Args:
            access_token: Patreon OAuth access token
        """
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def get_identity(self) -> Dict:
        """
        Get current user identity (for testing token validity).

        Returns:
            Dict with user data

        Raises:
            PatreonAPIError: If API call fails
        """
        url = f"{self.BASE_URL}/identity"
        params = {"fields[user]": "email,full_name,is_email_verified"}

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as e:
            raise PatreonAPIError(f"Failed to get identity: {e.response.text}")

    def get_campaigns(self) -> List[Dict]:
        """
        Get all campaigns the user has access to.

        Returns:
            List of campaign data dicts

        Raises:
            PatreonAPIError: If API call fails
        """
        url = f"{self.BASE_URL}/campaigns"
        params = {"fields[campaign]": "creation_name,url,patron_count,published_at"}

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()

            data = response.json()
            return data.get("data", [])
        except requests.HTTPError as e:
            raise PatreonAPIError(f"Failed to get campaigns: {e.response.text}")

    def get_campaign_posts(
        self, campaign_id: str, since: Optional[datetime] = None, limit: int = 100
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Get posts from a campaign.

        Args:
            campaign_id: Patreon campaign ID
            since: Only fetch posts published after this date
            limit: Maximum number of posts to fetch (default 100)

        Returns:
            Tuple of (posts_data, included_media)

        Raises:
            PatreonAPIError: If API call fails
        """
        url = f"{self.BASE_URL}/campaigns/{campaign_id}/posts"

        # Use correct Patreon API v2 field names
        # Note: Patreon API v2 does NOT support fetching images/attachments
        # See: https://www.patreondevelopers.com/t/api-v2-cannot-retrieve-post-image-media-id-via-posts-id-endpoint/10639
        params = {
            "fields[post]": "title,content,published_at,url,is_paid,is_public,embed_data,embed_url",
            "page[count]": limit,
            "sort": "-published_at",  # Most recent first
        }

        if since:
            params["filter[published_at][gt]"] = since.isoformat()

        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()

            data = response.json()
            posts = data.get("data", [])
            included = data.get("included", [])

            return posts, included
        except requests.HTTPError as e:
            raise PatreonAPIError(f"Failed to get posts: {e.response.text}")

    def extract_post_data(self, post_json: Dict, included: List[Dict]) -> Dict:
        """
        Extract relevant data from Patreon API response.

        Note: Patreon API v2 doesn't provide direct image URLs in the posts endpoint.
        Images will need to be added manually or extracted from the post content.

        Args:
            post_json: Single post data from Patreon API
            included: Included media/attachments from API response

        Returns:
            Dict with extracted post data ready for database import
        """
        attributes = post_json.get("attributes", {})

        # Note: Image URLs are not available from the basic posts API
        # They would need to be extracted from post content or fetched separately
        # For now, we'll leave them empty and admin can add them manually if needed
        image_urls = []
        thumbnail_urls = []

        return {
            "post_id": post_json["id"],
            "title": attributes.get("title", "Untitled"),
            "url": attributes.get("url", ""),
            "timestamp": attributes.get("published_at"),
            "image_urls": image_urls,
            "thumbnail_urls": thumbnail_urls,
            "status": "pending",  # All imported posts start as pending
            "characters": [],  # To be filled in manually by admin
            "series": [],  # To be filled in manually by admin
            "tags": [],  # Will be auto-generated on publish
            "raw_patreon_json": post_json,  # Store raw JSON for debugging
        }

    def fetch_posts_with_gallery_dl(
        self,
        creator_username: str,
        since_date: Optional[datetime] = None,
        session_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        Fetch posts from Patreon using gallery-dl with --write-info-json.
        This gets complete post data including images array.

        Args:
            creator_username: Patreon creator username (e.g., 'vama')
            since_date: Only fetch posts after this date
            session_id: Patreon session_id cookie (required for patron-only content)

        Returns:
            List of post data dicts with images

        Raises:
            PatreonAPIError: If gallery-dl fails
        """
        print(f"[GALLERY-DL] Starting fetch for creator: {creator_username}")
        if since_date:
            print(f"[GALLERY-DL] Filtering posts since: {since_date}")
        print(f"[GALLERY-DL] Has session_id: {session_id is not None}")

        # Create temporary directory for metadata
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            print(f"[GALLERY-DL] Using temp directory: {temp_dir}")

            # Build gallery-dl command
            # Use --write-info-json + --no-download to get single JSON per post
            cmd = [
                "gallery-dl",
                "--write-info-json",  # Single info.json per post
                "--no-download",  # Do not download any files (but still write metadata)
                "--option",
                f"base-directory={temp_dir}",
            ]

            # Add session cookie if provided
            if session_id:
                # Create temporary cookie file with session_id
                cookie_file = temp_path / "cookies.txt"
                cookie_content = f"""# Netscape HTTP Cookie File
.patreon.com	TRUE	/	TRUE	0	session_id	{session_id}
"""
                with open(cookie_file, "w") as f:
                    f.write(cookie_content)

                cmd.extend(["--cookies", str(cookie_file)])
                print(f"[GALLERY-DL] Using session_id cookie from parameter")

            # Add date filter if provided
            if since_date:
                date_str = since_date.strftime("%Y-%m-%d")
                filter_expr = f"date >= datetime({since_date.year}, {since_date.month}, {since_date.day}) or abort()"
                cmd.extend(["--filter", filter_expr])
                print(f"[GALLERY-DL] Date filter: {filter_expr}")

            # Add Patreon URL
            patreon_url = f"https://www.patreon.com/{creator_username}/posts"
            cmd.append(patreon_url)

            # Log the full command (redact sensitive info)
            cmd_display = [arg if not str(cookie_file) in arg else "[COOKIES]" for arg in cmd]
            print(f"[GALLERY-DL] Command: {' '.join(cmd_display)}")
            print(f"[GALLERY-DL] Executing...")

            # Run gallery-dl
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=300  # 5 minute timeout
                )

                print(f"[GALLERY-DL] Return code: {result.returncode}")
                if result.stderr:
                    print(f"[GALLERY-DL] STDERR: {result.stderr[:500]}")

                if result.returncode != 0:
                    raise PatreonAPIError(f"gallery-dl failed: {result.stderr}")

            except subprocess.TimeoutExpired:
                print("[GALLERY-DL] ERROR: Timed out after 5 minutes")
                raise PatreonAPIError("gallery-dl timed out after 5 minutes")
            except FileNotFoundError:
                print("[GALLERY-DL] ERROR: gallery-dl not found in PATH")
                raise PatreonAPIError("gallery-dl not found. Install with: pip install gallery-dl")

            # Find all info.json files (one per post)
            info_json_files = []
            for root, dirs, files in os.walk(temp_dir):
                if "info.json" in files:
                    info_json_files.append(os.path.join(root, "info.json"))
            
            print(f"[GALLERY-DL] Found {len(info_json_files)} info.json files")

            posts = []
            for info_json_path in info_json_files:
                try:
                    with open(info_json_path, "r") as f:
                        metadata = json.load(f)
                        post_id = str(metadata.get("id", ""))
                        
                        if post_id:
                            posts.append(metadata)
                            print(f"[GALLERY-DL] Found post {post_id}: {metadata.get('title', 'Untitled')}")
                except json.JSONDecodeError as e:
                    print(f"[GALLERY-DL] Failed to parse {info_json_path}: {e}")
                    continue
                except Exception as e:
                    print(f"[GALLERY-DL] Error reading {info_json_path}: {e}")
                    continue

            print(f"[GALLERY-DL] Successfully parsed {len(posts)} posts")
            return posts

    def download_post_images(self, creator_username: str, post_id: str) -> List[str]:
        """
        Download images for a specific post using gallery-dl.

        Args:
            creator_username: Patreon creator username
            post_id: Patreon post ID

        Returns:
            List of downloaded image URLs/paths

        Raises:
            PatreonAPIError: If download fails
        """
        # Create temporary directory for downloads
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            cmd = [
                "gallery-dl",
                "--option",
                f"extractor.patreon.api-token={self.access_token}",
                "--option",
                f"base-directory={temp_dir}",
                "--filter",
                f'id == "{post_id}"',  # Only this post
                f"https://www.patreon.com/{creator_username}/posts",
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

                if result.returncode != 0:
                    raise PatreonAPIError(f"Image download failed: {result.stderr}")

            except subprocess.TimeoutExpired:
                raise PatreonAPIError("Image download timed out")

            # Collect downloaded image paths
            image_files = list(temp_path.rglob("*.*"))
            image_files = [
                f
                for f in image_files
                if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".gif", ".webp"]
            ]

            # Return list of image paths (caller will need to upload these somewhere)
            return [str(f) for f in image_files]

    def _download_single_image(self, url: str, output_path: str, timeout: int = 60) -> bool:
        """
        Download a single image from URL to output path.
        
        Args:
            url: Image URL
            output_path: Path to save file
            timeout: Download timeout in seconds
        
        Returns:
            True if successful, False otherwise
        """
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

    def _download_images_parallel(
        self,
        images_info: List[Dict],
        post_id: str,
        output_dir: Path,
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
        print(f"[IMPORT] Downloading {len(images_info)} images in parallel (max {max_workers} threads)...")
        
        successful_filenames = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all download tasks
            future_to_info = {}
            for info in images_info:
                output_path = output_dir / info['filename']
                future = executor.submit(self._download_single_image, info['url'], str(output_path))
                future_to_info[future] = info
            
            # Process completed downloads
            for future in as_completed(future_to_info):
                info = future_to_info[future]
                try:
                    success = future.result()
                    if success:
                        successful_filenames.append(info['filename'])
                        print(f"[IMPORT] Downloaded: {info['filename']}")
                except Exception as e:
                    print(f"[IMPORT] Exception downloading {info['filename']}: {e}")
        
        return successful_filenames

    def fetch_post_with_info_json(
        self,
        post_id: str,
        session_id: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Fetch a single post's metadata using gallery-dl --write-info-json.
        
        Args:
            post_id: Patreon post ID
            session_id: Patreon session_id cookie (required for patron-only content)
        
        Returns:
            Parsed info.json dict, or None on error
        
        Raises:
            PatreonAPIError: If gallery-dl fails
        """
        print(f"[IMPORT] Fetching metadata for post {post_id}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Build gallery-dl command
            cmd = [
                "gallery-dl",
                "--write-info-json",  # Single JSON per post
                "--no-download",  # Metadata only
                "--option",
                f"base-directory={temp_dir}",
            ]
            
            # Add session cookie if provided
            if session_id:
                cookie_file = temp_path / "cookies.txt"
                cookie_content = f"""# Netscape HTTP Cookie File
.patreon.com	TRUE	/	TRUE	0	session_id	{session_id}
"""
                with open(cookie_file, "w") as f:
                    f.write(cookie_content)
                
                cmd.extend(["--cookies", str(cookie_file)])
            
            # Add post URL
            post_url = f"https://www.patreon.com/posts/{post_id}"
            cmd.append(post_url)
            
            # Run gallery-dl
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=300
                )
                
                if result.returncode != 0:
                    print(f"[IMPORT] gallery-dl failed for post {post_id}: {result.stderr}")
                    return None
                
                # Find info.json file
                info_json_path = None
                for root, dirs, files in os.walk(temp_dir):
                    if "info.json" in files:
                        info_json_path = os.path.join(root, "info.json")
                        break
                
                if not info_json_path:
                    print(f"[IMPORT] info.json not found for post {post_id}")
                    return None
                
                # Parse info.json
                with open(info_json_path, 'r') as f:
                    info_data = json.load(f)
                
                print(f"[IMPORT] Successfully fetched metadata for post {post_id}")
                return info_data
            
            except subprocess.TimeoutExpired:
                print(f"[IMPORT] gallery-dl timed out for post {post_id}")
                return None
            except Exception as e:
                print(f"[IMPORT] Exception fetching post {post_id}: {e}")
                return None

    def extract_post_data_from_gallery_dl(self, gallery_dl_metadata: Dict) -> Dict:
        """
        Extract post data from gallery-dl info.json format.
        Downloads all images with new naming convention: [postid]-t-[ordinal]-[uuid].ext
        
        Args:
            gallery_dl_metadata: Metadata dict from gallery-dl info.json
        
        Returns:
            Dict with extracted post data ready for database import
        """
        start_time = time.time()
        
        # Extract basic post info
        post_id = str(gallery_dl_metadata.get("id", ""))
        title = gallery_dl_metadata.get("title", "Untitled")
        url = gallery_dl_metadata.get("url", "")
        
        print(f"[IMPORT] Processing post {post_id}: {title}")
        
        # Parse date (use published_at if available, fallback to date)
        date_str = gallery_dl_metadata.get("published_at") or gallery_dl_metadata.get("date")
        timestamp = None
        if date_str:
            try:
                # Handle both datetime objects and strings
                if isinstance(date_str, str):
                    timestamp = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                else:
                    timestamp = date_str
            except:
                timestamp = datetime.now()
        
        # Get images array from info.json
        images = gallery_dl_metadata.get('images', [])
        
        if not images:
            print(f"[IMPORT] WARNING: No images found for post {post_id}")
            return {
                "post_id": post_id,
                "title": title,
                "url": url,
                "timestamp": timestamp,
                "image_urls": [],
                "thumbnail_urls": [],
                "status": "pending",
                "characters": [],
                "series": [],
                "tags": [],
                "raw_patreon_json": gallery_dl_metadata,
            }
        
        print(f"[IMPORT] Found {len(images)} images for post {post_id}")
        
        # Prepare output directory
        thumbnails_dir = Path(__file__).parent.parent.parent / "static" / "thumbnails"
        thumbnails_dir.mkdir(parents=True, exist_ok=True)
        
        # Prepare download info for all images
        images_info = []
        for ordinal, image in enumerate(images):
            file_name = image.get('file_name', '')
            
            if not file_name:
                print(f"[IMPORT] WARNING: Image {ordinal} missing file_name, skipping")
                continue
            
            # Extract extension
            extension = get_file_extension(file_name)
            
            if not extension:
                print(f"[IMPORT] WARNING: Could not determine extension for {file_name}, skipping")
                continue
            
            # Get thumbnail URL from info.json (360x360 square, much smaller than original)
            # Prefer thumbnail over full download_url for better performance
            image_urls = image.get('image_urls', {})
            thumbnail_url = image_urls.get('thumbnail')
            
            if not thumbnail_url:
                print(f"[IMPORT] WARNING: Image {ordinal} missing thumbnail URL, trying download_url")
                thumbnail_url = image.get('download_url')
            
            if not thumbnail_url:
                print(f"[IMPORT] WARNING: Image {ordinal} missing both thumbnail and download_url, skipping")
                continue
            
            # Generate new filename with UUID
            new_filename = generate_thumbnail_filename(post_id, ordinal, extension)
            
            images_info.append({
                'ordinal': ordinal,
                'url': thumbnail_url,
                'filename': new_filename,
                'extension': extension
            })
        
        if not images_info:
            print(f"[IMPORT] ERROR: No valid images to download for post {post_id}")
            return {
                "post_id": post_id,
                "title": title,
                "url": url,
                "timestamp": timestamp,
                "image_urls": [],
                "thumbnail_urls": [],
                "status": "pending",
                "characters": [],
                "series": [],
                "tags": [],
                "raw_patreon_json": gallery_dl_metadata,
            }
        
        # Download all images in parallel
        download_start = time.time()
        successful_filenames = self._download_images_parallel(
            images_info, post_id, thumbnails_dir, max_workers=10
        )
        download_time = time.time() - download_start
        
        print(f"[IMPORT] Downloaded {len(successful_filenames)}/{len(images_info)} images in {download_time:.2f}s")
        
        # Build thumbnail URLs for database
        thumbnail_urls = [f"/static/thumbnails/{fn}" for fn in successful_filenames]
        
        # Archive JSON file
        try:
            archive_dir = Path(__file__).parent.parent.parent / "static" / "archive"
            archive_dir.mkdir(parents=True, exist_ok=True)
            
            archive_filename = f"{post_id}-metadata.json"
            archive_path = archive_dir / archive_filename
            
            with open(archive_path, "w") as f:
                json.dump(gallery_dl_metadata, f, indent=2, default=str)
            
            print(f"[IMPORT] Saved JSON for post {post_id}: {archive_filename}")
        except Exception as e:
            print(f"[IMPORT] ERROR saving JSON for post {post_id}: {e}")
        
        total_time = time.time() - start_time
        print(f"[IMPORT] Total processing time for post {post_id}: {total_time:.2f}s")
        
        return {
            "post_id": post_id,
            "title": title,
            "url": url,
            "timestamp": timestamp,
            "image_urls": [],  # Not storing full image URLs for now
            "thumbnail_urls": thumbnail_urls,
            "status": "pending",
            "characters": [],
            "series": [],
            "tags": [],
            "raw_patreon_json": gallery_dl_metadata,
        }

    @staticmethod
    def refresh_access_token(refresh_token: str) -> Dict:
        """
        Refresh an expired Patreon access token.

        Args:
            refresh_token: Patreon OAuth refresh token

        Returns:
            Dict with new token data (access_token, refresh_token, expires_in)

        Raises:
            PatreonAPIError: If token refresh fails
        """
        url = "https://www.patreon.com/api/oauth2/token"

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.PATREON_CLIENT_ID,
            "client_secret": settings.PATREON_CLIENT_SECRET,
        }

        try:
            response = requests.post(url, data=data)
            response.raise_for_status()
            return response.json()
        except requests.HTTPError as e:
            raise PatreonAPIError(f"Failed to refresh token: {e.response.text}")


def get_patreon_service(access_token: str) -> PatreonService:
    """
    Factory function to create a PatreonService instance.

    Args:
        access_token: Patreon OAuth access token

    Returns:
        PatreonService instance
    """
    return PatreonService(access_token)
