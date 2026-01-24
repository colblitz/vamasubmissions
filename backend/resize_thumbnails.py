#!/usr/bin/env python3
"""
Thumbnail Resize Script

This script resizes all thumbnails in backend/static/thumbnails/ from 360x360 to 192x192.
It backs up originals to backend/static/thumbnails_original/ before resizing.

Usage:
    python resize_thumbnails.py [--dry-run]

Options:
    --dry-run    Show what would be done without actually resizing files
"""

import argparse
import shutil
from pathlib import Path
from PIL import Image


def resize_thumbnails(dry_run=False):
    """
    Resize all thumbnails from 360x360 to 192x192.
    
    Args:
        dry_run: If True, only show what would be done without actually doing it
    """
    # Define paths
    thumbnails_dir = Path(__file__).parent / "static" / "thumbnails"
    backup_dir = Path(__file__).parent / "static" / "thumbnails_original"
    
    # Check if thumbnails directory exists
    if not thumbnails_dir.exists():
        print(f"Error: Thumbnails directory not found: {thumbnails_dir}")
        return
    
    # Find all WebP files
    thumbnail_files = list(thumbnails_dir.glob("*.webp"))
    total_files = len(thumbnail_files)
    
    if total_files == 0:
        print(f"No WebP files found in {thumbnails_dir}")
        return
    
    print(f"Found {total_files} thumbnail files")
    
    if dry_run:
        print("\n=== DRY RUN MODE ===")
        print(f"Would backup originals to: {backup_dir}")
        print(f"Would resize {total_files} thumbnails from 360x360 to 192x192")
        print(f"Would use WebP quality=80, method=6")
        return
    
    # Create backup directory if it doesn't exist
    backup_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nBacking up originals to: {backup_dir}")
    
    # Process each thumbnail
    for idx, thumbnail_path in enumerate(thumbnail_files, start=1):
        try:
            # Backup original
            backup_path = backup_dir / thumbnail_path.name
            if not backup_path.exists():  # Only backup if not already backed up
                shutil.copy2(thumbnail_path, backup_path)
            
            # Open and resize image
            with Image.open(thumbnail_path) as img:
                # Resize to 192x192 using high-quality Lanczos resampling
                resized_img = img.resize((192, 192), Image.Resampling.LANCZOS)
                
                # Save as WebP with quality=80, method=6
                resized_img.save(
                    thumbnail_path,
                    format="WEBP",
                    quality=80,
                    method=6
                )
            
            # Show progress every 100 files or at the end
            if idx % 100 == 0 or idx == total_files:
                print(f"Resized {idx}/{total_files}...")
        
        except Exception as e:
            print(f"Error processing {thumbnail_path.name}: {e}")
            continue
    
    print(f"\n✓ Successfully resized {total_files} thumbnails")
    print(f"✓ Originals backed up to: {backup_dir}")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Resize thumbnails from 360x360 to 192x192"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually doing it"
    )
    
    args = parser.parse_args()
    
    print("Thumbnail Resize Script")
    print("=" * 50)
    
    resize_thumbnails(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
