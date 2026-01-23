#!/usr/bin/env python3
"""
Download thumbnails from Patreon URLs in JSON files.

This script:
1. Reads all JSON files from all-post-api/
2. Extracts thumbnail URLs
3. Downloads thumbnails to backend/static/thumbnails/
4. Names them as {post_id}-thumbnail.jpg
"""
import json
import requests
from pathlib import Path
import time
import sys

def download_thumbnails(json_dir: Path, output_dir: Path, dry_run: bool = False):
    """Download thumbnails from JSON files."""
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get all JSON files
    json_files = list(json_dir.glob('*.json'))
    print(f"Found {len(json_files)} JSON files")
    print(f"Output directory: {output_dir}")
    print(f"Dry run: {dry_run}")
    print()
    
    downloaded = 0
    skipped = 0
    errors = 0
    
    for i, json_file in enumerate(json_files, 1):
        # Extract post ID from filename (format: "129090487 - title.json")
        try:
            post_id = json_file.name.split(' - ')[0]
        except:
            print(f"[{i}/{len(json_files)}] ERROR: Could not extract post ID from {json_file.name}")
            errors += 1
            continue
        
        # Output filename
        output_file = output_dir / f"{post_id}-thumbnail.jpg"
        
        # Skip if already exists
        if output_file.exists():
            print(f"[{i}/{len(json_files)}] SKIP {post_id} (already exists)")
            skipped += 1
            continue
        
        # Load JSON
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
        except Exception as e:
            print(f"[{i}/{len(json_files)}] ERROR: Could not parse JSON for {post_id}: {e}")
            errors += 1
            continue
        
        # Find first thumbnail URL
        thumbnail_url = None
        for item in data.get('included', []):
            if item.get('type') == 'media':
                img_urls = item.get('attributes', {}).get('image_urls', {})
                
                # Prefer thumbnail, fallback to thumbnail_large
                if 'thumbnail' in img_urls:
                    thumbnail_url = img_urls['thumbnail']
                    break
                elif 'thumbnail_large' in img_urls:
                    thumbnail_url = img_urls['thumbnail_large']
                    break
        
        if not thumbnail_url:
            print(f"[{i}/{len(json_files)}] WARN: No thumbnail URL for {post_id}")
            errors += 1
            continue
        
        if dry_run:
            print(f"[{i}/{len(json_files)}] WOULD DOWNLOAD {post_id} from {thumbnail_url[:60]}...")
            continue
        
        # Download thumbnail
        try:
            response = requests.get(thumbnail_url, timeout=30)
            response.raise_for_status()
            
            with open(output_file, 'wb') as f:
                f.write(response.content)
            
            file_size = len(response.content) / 1024  # KB
            print(f"[{i}/{len(json_files)}] DOWNLOADED {post_id} ({file_size:.1f} KB)")
            downloaded += 1
            
            # Be nice to Patreon's servers
            time.sleep(0.5)
        
        except requests.exceptions.RequestException as e:
            print(f"[{i}/{len(json_files)}] ERROR: Failed to download {post_id}: {e}")
            errors += 1
            
            # If file was partially created, remove it
            if output_file.exists():
                output_file.unlink()
    
    print()
    print("=" * 60)
    print("Summary:")
    print(f"  Downloaded: {downloaded}")
    print(f"  Skipped (already exist): {skipped}")
    print(f"  Errors: {errors}")
    print(f"  Total: {len(json_files)}")
    print("=" * 60)
    
    if dry_run:
        print("\n[DRY RUN] No files were actually downloaded")
        print("Run without --dry-run to download thumbnails")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Download thumbnails from Patreon JSON files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (test without downloading)
  python3 download_thumbnails.py --dry-run
  
  # Download thumbnails
  python3 download_thumbnails.py
  
  # Custom directories
  python3 download_thumbnails.py --json-dir /path/to/json --output-dir /path/to/output
        """
    )
    
    parser.add_argument(
        '--json-dir',
        type=Path,
        default=Path('all-post-api'),
        help='Directory containing JSON files (default: all-post-api)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('backend/static/thumbnails'),
        help='Output directory for thumbnails (default: backend/static/thumbnails)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Test without actually downloading'
    )
    
    args = parser.parse_args()
    
    # Validate input directory
    if not args.json_dir.exists():
        print(f"ERROR: JSON directory not found: {args.json_dir}")
        print("Please specify the correct path with --json-dir")
        sys.exit(1)
    
    # Check for JSON files
    json_files = list(args.json_dir.glob('*.json'))
    if not json_files:
        print(f"ERROR: No JSON files found in {args.json_dir}")
        sys.exit(1)
    
    # Run download
    download_thumbnails(args.json_dir, args.output_dir, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
