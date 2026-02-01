#!/usr/bin/env python3
"""
Server-Side Ingest Script for VAMA Posts

This script runs on the production server and ingests posts from the staging area.

Workflow:
1. Read import_metadata.json from staging area
2. Move thumbnails to production directory
3. Insert posts into database
4. Clean up staging area on success

Requirements:
- Run on production server
- Staging directory with import_metadata.json and thumbnails

Usage:
    python3 scripts/ingest_imports.py --staging-dir ~/vamasubmissions/import-staging
"""

import argparse
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.database import SessionLocal
from app.models.post import Post


def ingest_posts(staging_dir: Path, thumbnails_dir: Path, archive_dir: Path) -> dict:
    """
    Ingest posts from staging area into database.

    Args:
        staging_dir: Staging directory with import_metadata.json and thumbnails
        thumbnails_dir: Production thumbnails directory
        archive_dir: Production archive directory for metadata JSON

    Returns:
        Dict with import statistics
    """
    metadata_file = staging_dir / "import_metadata.json"

    if not metadata_file.exists():
        print(f"[ERROR] Metadata file not found: {metadata_file}")
        return {"success": False, "error": "Metadata file not found"}

    # Read metadata
    try:
        with open(metadata_file, 'r') as f:
            import_data = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to read metadata: {e}")
        return {"success": False, "error": str(e)}

    posts_data = import_data.get("posts", [])
    print(f"[INFO] Found {len(posts_data)} posts in metadata")

    # Create directories
    thumbnails_dir.mkdir(parents=True, exist_ok=True)
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Open database session
    db = SessionLocal()

    try:
        imported_count = 0
        skipped_count = 0
        errors = []

        for post_data in posts_data:
            post_id = post_data.get("post_id")
            thumbnail_filenames = post_data.get("thumbnail_filenames", [])

            try:
                # Check if post already exists
                existing = db.query(Post).filter(Post.post_id == post_id).first()

                if existing:
                    print(f"[INFO] Post {post_id} already exists, skipping")
                    skipped_count += 1
                    continue

                # Move thumbnails from staging to production
                thumbnail_urls = []
                thumbnails_subdir = staging_dir / "thumbnails"

                for filename in thumbnail_filenames:
                    src = thumbnails_subdir / filename
                    dst = thumbnails_dir / filename

                    if src.exists():
                        shutil.move(str(src), str(dst))
                        thumbnail_urls.append(f"/static/thumbnails/{filename}")
                        print(f"[INFO]   Moved: {filename}")
                    else:
                        print(f"[WARNING] Thumbnail not found: {filename}")

                if not thumbnail_urls:
                    print(f"[WARNING] No thumbnails for post {post_id}, skipping")
                    errors.append({"post_id": post_id, "error": "No thumbnails"})
                    continue

                # Parse timestamp
                timestamp_str = post_data.get("timestamp")
                timestamp = None
                if timestamp_str:
                    try:
                        timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                    except:
                        timestamp = datetime.now()

                # Create post in database
                new_post = Post(
                    post_id=post_id,
                    title=post_data.get("title", "Untitled"),
                    patreon_url=post_data.get("patreon_url", ""),
                    timestamp=timestamp,
                    thumbnail_url=thumbnail_urls[0] if thumbnail_urls else None,
                    thumbnail_urls=thumbnail_urls,
                    status="pending",
                    characters=[],
                    series=[],
                    tags=[],
                    raw_patreon_json=post_data.get("raw_patreon_json", {})
                )

                db.add(new_post)
                imported_count += 1
                print(f"[SUCCESS] Imported post {post_id}: {post_data.get('title', 'Untitled')}")

                # Archive metadata JSON
                try:
                    archive_filename = f"{post_id}-metadata.json"
                    archive_path = archive_dir / archive_filename

                    with open(archive_path, 'w') as f:
                        json.dump(post_data.get("raw_patreon_json", {}), f, indent=2, default=str)

                    print(f"[INFO]   Archived: {archive_filename}")
                except Exception as e:
                    print(f"[WARNING] Failed to archive metadata: {e}")

            except Exception as e:
                errors.append({"post_id": post_id, "error": str(e)})
                print(f"[ERROR] Failed to import post {post_id}: {e}")

        # Commit all changes
        db.commit()
        print(f"[INFO] Committed {imported_count} posts to database")

        return {
            "success": True,
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors,
            "total": len(posts_data)
        }

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database error: {e}")
        return {"success": False, "error": str(e)}

    finally:
        db.close()


def cleanup_staging(staging_dir: Path, keep_on_error: bool = True):
    """
    Clean up staging directory after successful ingest.

    Args:
        staging_dir: Staging directory to clean
        keep_on_error: Keep files if there were errors
    """
    try:
        # Remove metadata file
        metadata_file = staging_dir / "import_metadata.json"
        if metadata_file.exists():
            metadata_file.unlink()
            print("[INFO] Removed metadata file")

        # Remove thumbnails directory (should be empty after moving files)
        thumbnails_subdir = staging_dir / "thumbnails"
        if thumbnails_subdir.exists():
            shutil.rmtree(thumbnails_subdir)
            print("[INFO] Removed thumbnails directory")

        # Remove staging directory if empty
        if not any(staging_dir.iterdir()):
            staging_dir.rmdir()
            print("[INFO] Removed staging directory")

    except Exception as e:
        print(f"[WARNING] Cleanup failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Ingest imported posts from staging area")
    parser.add_argument("--staging-dir", default="~/vamasubmissions/import-staging", help="Staging directory path")

    args = parser.parse_args()

    staging_dir = Path(args.staging_dir).expanduser()

    print("=" * 70)
    print("VAMA Posts Ingest Script (Server-Side)")
    print("=" * 70)
    print()

    if not staging_dir.exists():
        print(f"[ERROR] Staging directory not found: {staging_dir}")
        sys.exit(1)

    # Get production directories
    backend_dir = Path(__file__).parent.parent / "backend"
    thumbnails_dir = backend_dir / "static" / "thumbnails"
    archive_dir = backend_dir / "static" / "archive"

    print(f"[INFO] Staging directory: {staging_dir}")
    print(f"[INFO] Thumbnails directory: {thumbnails_dir}")
    print(f"[INFO] Archive directory: {archive_dir}")
    print()

    # Ingest posts
    result = ingest_posts(staging_dir, thumbnails_dir, archive_dir)

    print()
    print("=" * 70)

    if result["success"]:
        print(f"[SUCCESS] Imported {result['imported']} posts")
        print(f"[INFO] Skipped {result['skipped']} existing posts")

        if result["errors"]:
            print(f"[WARNING] {len(result['errors'])} errors occurred")
            for error in result["errors"]:
                print(f"  - Post {error['post_id']}: {error['error']}")

        print()
        print("[INFO] Cleaning up staging area...")
        cleanup_staging(staging_dir)
        print("[SUCCESS] Ingest complete!")
    else:
        print(f"[ERROR] Ingest failed: {result.get('error', 'Unknown error')}")
        print(f"[INFO] Files remain in staging area: {staging_dir}")
        sys.exit(1)

    print("=" * 70)


if __name__ == "__main__":
    main()
