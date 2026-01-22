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
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from app.core.config import settings


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
        Fetch posts from Patreon using gallery-dl.
        This gets complete post data including images.

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
            # Use --write-metadata + --no-download to save JSON files without downloading images
            cmd = [
                "gallery-dl",
                "--write-metadata",  # Write metadata to JSON files
                "--no-download",  # Do not download any files (but still write metadata)
                "--option",
                f"extractor.patreon.api-token={self.access_token}",
                "--option",
                f"base-directory={temp_dir}",
            ]

            # Add session cookie if provided
            if session_id:
                # Auto-detect which Chrome profile has Patreon cookies
                chrome_profile = find_chrome_profile_with_patreon_cookies()

                if chrome_profile:
                    browser_spec = (
                        f"chrome:{chrome_profile}" if chrome_profile != "Default" else "chrome"
                    )
                    cmd.extend(
                        [
                            "--cookies-from-browser",
                            browser_spec,
                        ]
                    )
                    print(f"[GALLERY-DL] Using cookies from Chrome {chrome_profile}")
                else:
                    # Fallback: try default Chrome profile anyway
                    cmd.extend(
                        [
                            "--cookies-from-browser",
                            "chrome",
                        ]
                    )
                    print(
                        f"[GALLERY-DL] WARNING: No Patreon cookies detected, trying default Chrome profile"
                    )

            # Add date filter if provided
            if since_date:
                date_str = since_date.strftime("%Y-%m-%d")
                filter_expr = f"date >= datetime({since_date.year}, {since_date.month}, {since_date.day}) or abort()"
                cmd.extend(["--filter", filter_expr])
                print(f"[GALLERY-DL] Date filter: {filter_expr}")

            # Add Patreon URL
            patreon_url = f"https://www.patreon.com/{creator_username}/posts"
            cmd.append(patreon_url)

            # Log the full command (with token redacted)
            cmd_display = []
            for i, arg in enumerate(cmd):
                if "api-token=" in arg:
                    cmd_display.append(f"--option extractor.patreon.api-token=***REDACTED***")
                elif arg == "--cookies-from-browser":
                    cmd_display.append(arg)
                    if i + 1 < len(cmd):
                        cmd_display.append(cmd[i + 1])
                elif arg.startswith("--"):
                    cmd_display.append(arg)
                elif arg.startswith("chrome:"):
                    continue  # Already added with --cookies-from-browser
                elif "=" in arg and not arg.startswith("http"):
                    cmd_display.append(arg)
                elif arg.startswith("http"):
                    cmd_display.append(arg)
                elif arg == "gallery-dl":
                    cmd_display.append(arg)

            print(f"[GALLERY-DL] Full command: {' '.join(cmd_display)}")
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

            # Parse JSON metadata files
            # --write-metadata creates one JSON per file, so we need to deduplicate by post_id
            json_files = list(temp_path.rglob("*.json"))
            print(f"[GALLERY-DL] Found {len(json_files)} JSON metadata files")

            posts_by_id = {}  # Deduplicate by post_id

            for json_file in json_files:
                try:
                    with open(json_file, "r") as f:
                        metadata = json.load(f)
                        post_id = str(metadata.get("id", ""))

                        # Only keep one metadata per post_id (first one we see)
                        if post_id and post_id not in posts_by_id:
                            posts_by_id[post_id] = metadata
                            print(
                                f"[GALLERY-DL] Found post {post_id}: {metadata.get('title', 'Untitled')}"
                            )
                except json.JSONDecodeError as e:
                    print(f"[GALLERY-DL] Failed to parse {json_file.name}: {e}")
                    continue
                except Exception as e:
                    print(f"[GALLERY-DL] Error reading {json_file.name}: {e}")
                    continue

            posts = list(posts_by_id.values())
            print(
                f"[GALLERY-DL] Successfully parsed {len(posts)} unique posts from {len(json_files)} files"
            )
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

    def extract_post_data_from_gallery_dl(self, gallery_dl_metadata: Dict) -> Dict:
        """
        Extract post data from gallery-dl metadata format.
        Only extracts metadata - no image downloads.

        Args:
            gallery_dl_metadata: Metadata dict from gallery-dl JSON

        Returns:
            Dict with extracted post data ready for database import
        """
        # Extract basic post info
        post_id = str(gallery_dl_metadata.get("id", ""))
        title = gallery_dl_metadata.get("title", "Untitled")
        url = gallery_dl_metadata.get("url", "")

        # Parse date
        date_str = gallery_dl_metadata.get("date")
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

        # TEMPORARY: Use test/placeholder thumbnails for development
        # TODO: For production, extract real thumbnail URLs and download them
        # thumbnail_url = gallery_dl_metadata.get('thumbnail', {}).get('thumbnail_large')

        # Use League of Legends placeholder thumbnails (cycling through test data)
        placeholder_thumbnails = [
            "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg",
            "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg",
            "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lux_0.jpg",
            "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/MissFortune_0.jpg",
            "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Akali_0.jpg",
        ]

        # Use post_id hash to consistently assign a placeholder
        post_id_int = int(post_id) if post_id.isdigit() else hash(post_id)
        placeholder_url = placeholder_thumbnails[post_id_int % len(placeholder_thumbnails)]

        thumbnail_urls = [placeholder_url]
        image_urls = thumbnail_urls  # For now, just use thumbnail

        return {
            "post_id": post_id,
            "title": title,
            "url": url,
            "timestamp": timestamp,
            "image_urls": image_urls,
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
