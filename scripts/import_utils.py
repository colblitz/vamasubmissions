"""
Shared utility functions for Patreon post import scripts.

This module contains common functionality used by:
- import_posts_local.py
- redownload_thumbnails.py

Functions:
- Thumbnail filename generation
- Browser cookie detection
- Image downloading
- Gallery-dl execution
"""

import json
import os
import platform
import shutil
import sqlite3
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Dict, Optional, Tuple
from urllib.request import urlopen, Request


# ============================================================================
# Thumbnail Filename Utilities
# ============================================================================

def generate_thumbnail_filename(post_id: str, ordinal: int, extension: str) -> str:
    """
    Generate thumbnail filename with UUID.
    
    Format: [postid]-t-[ordinal]-[uuid].[ext]
    Example: 129090487-t-000-a1b2c3d4.png
    
    Args:
        post_id: Patreon post ID
        ordinal: Image ordinal (0-indexed)
        extension: File extension (without dot)
    
    Returns:
        Filename string
    """
    short_uuid = uuid.uuid4().hex[:8]
    ordinal_str = f"{ordinal:03d}"
    extension = extension.lstrip(".")
    return f"{post_id}-t-{ordinal_str}-{short_uuid}.{extension}"


def get_file_extension(filename: str) -> str:
    """
    Extract file extension from filename (without dot).
    
    Args:
        filename: Filename or path
    
    Returns:
        Extension in lowercase (e.g., "png", "jpg")
    """
    ext = Path(filename).suffix.lstrip(".")
    return ext.lower()


# ============================================================================
# Browser Cookie Detection
# ============================================================================

def find_chrome_profile_with_patreon_cookies() -> Tuple[Optional[str], Optional[Path]]:
    """
    Auto-detect which Chrome profile has Patreon cookies.
    
    Returns:
        Tuple of (profile_name, cookie_file_path) or (None, None) if not found
    """
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
        
        except Exception:
            # Skip profiles we can't read
            continue
    
    return None, None


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


# ============================================================================
# Image Downloading
# ============================================================================

def download_single_image(url: str, output_path: str, timeout: int = 60) -> bool:
    """
    Download a single image from URL to output path.
    Skips if file already exists (idempotent/resumable).
    
    Args:
        url: Image URL
        output_path: Path to save file (string or Path)
        timeout: Download timeout in seconds
    
    Returns:
        True if successful or already exists, False otherwise
    """
    # Convert to Path if string
    output_path = Path(output_path) if isinstance(output_path, str) else output_path
    
    # Check if file already exists (idempotent/resumable)
    if output_path.exists() and output_path.stat().st_size > 0:
        print(f"[SKIP] Already exists: {output_path.name}")
        return True
    
    try:
        # Create request with user agent to avoid blocks
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        with urlopen(req, timeout=timeout) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        
        return True
    
    except Exception as e:
        print(f"[ERROR] Failed to download {output_path.name}: {e}")
        return False


# ============================================================================
# Gallery-dl Execution
# ============================================================================

def run_gallery_dl_for_post(
    post_id: str,
    chrome_profile: str,
    temp_dir: Path
) -> Optional[Dict]:
    """
    Run gallery-dl for a single post URL to fetch metadata.
    
    Args:
        post_id: Patreon post ID
        chrome_profile: Chrome profile name (e.g., "Profile 1") or browser string (e.g., "chrome:Profile 1")
        temp_dir: Temporary directory for output
    
    Returns:
        Post metadata dict from info.json or None on error
    """
    post_url = f"https://www.patreon.com/posts/{post_id}"
    post_temp_dir = temp_dir / f"post_{post_id}"
    post_temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Handle both profile name and full browser string
    if ":" in chrome_profile:
        browser_str = chrome_profile
    else:
        browser_str = f"chrome:{chrome_profile}"
    
    cmd = [
        "gallery-dl",
        "--write-info-json",  # Creates one info.json per post
        "--no-download",
        "--option", f"base-directory={post_temp_dir}",
        "--cookies-from-browser", browser_str,
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
    
    except subprocess.TimeoutExpired:
        print(f"[WARNING] gallery-dl timed out for post {post_id}")
        return None
    except Exception as e:
        print(f"[WARNING] Error processing post {post_id}: {e}")
        return None
