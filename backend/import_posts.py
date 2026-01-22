#!/usr/bin/env python3
"""
Import posts from vama_posts_initial.csv and all-post-api/ JSON files.

This script:
1. Reads character/series data from CSV
2. Reads metadata (url, timestamp, images) from JSON files
3. Auto-generates tags based on rules
4. Inserts into posts table
"""
import csv
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)


def load_json_data(post_id: str, json_dir: Path) -> Optional[Dict]:
    """Load JSON data for a post ID from the all-post-api directory."""
    # Find JSON file matching this post ID
    json_files = list(json_dir.glob(f"{post_id} - *.json"))
    
    if not json_files:
        print(f"  WARNING: No JSON file found for post {post_id}")
        return None
    
    json_file = json_files[0]
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        post_data = data['data']
        attrs = post_data['attributes']
        
        # Extract basic fields
        url = attrs.get('url', '')
        published_at = attrs.get('published_at', '')
        title = attrs.get('title', '')
        
        # Extract media (images only, skip zip files)
        included = data.get('included', [])
        # Filter for actual images (media_type == "image"), not zip files
        media_items = [
            i for i in included 
            if i.get('type') == 'media' and i.get('attributes', {}).get('media_type') == 'image'
        ]
        
        # Get image URLs from media
        image_urls = []
        thumbnail_urls = []
        
        for media in media_items:
            media_attrs = media.get('attributes', {})
            image_url_obj = media_attrs.get('image_urls', {})
            
            # Get default image URL
            if 'default' in image_url_obj:
                image_urls.append(image_url_obj['default'])
            elif 'url' in image_url_obj:
                image_urls.append(image_url_obj['url'])
            
            # Get thumbnail URL
            if 'thumbnail' in image_url_obj:
                thumbnail_urls.append(image_url_obj['thumbnail'])
            elif 'thumbnail_large' in image_url_obj:
                thumbnail_urls.append(image_url_obj['thumbnail_large'])
        
        return {
            'url': url,
            'published_at': published_at,
            'title': title,
            'image_urls': image_urls,
            'thumbnail_urls': thumbnail_urls
        }
    
    except Exception as e:
        print(f"  ERROR: Failed to parse JSON for post {post_id}: {e}")
        return None


def generate_tags(title: str, characters: List[str], series: List[str]) -> List[str]:
    """Generate tags based on rules."""
    tags = []
    
    # Rule 1: "clone" tag if "clone" in title
    if 'clone' in title.lower():
        tags.append('clone')
    
    # Rule 2: "yuri" and "lesbian" tags if multiple characters AND multiple series
    # (indicates a crossover pairing)
    if len(characters) >= 2 and len(series) >= 2:
        tags.extend(['yuri', 'lesbian'])
    
    return tags


def import_posts(csv_path: Path, json_dir: Path, dry_run: bool = False):
    """Import posts from CSV and JSON files."""
    
    print(f"Starting import from {csv_path}")
    print(f"JSON directory: {json_dir}")
    print(f"Dry run: {dry_run}")
    print()
    
    # Read CSV
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"Found {len(rows)} posts in CSV")
    print()
    
    # Process each row
    posts_to_insert = []
    errors = []
    
    for i, row in enumerate(rows, 1):
        post_id = row['id']
        character1 = row.get('character 1', '').strip()
        series1 = row.get('series 1', '').strip()
        character2 = row.get('character 2', '').strip()
        series2 = row.get('series 2', '').strip()
        original_title = row.get('original_title', '').strip()
        
        # Load JSON data
        json_data = load_json_data(post_id, json_dir)
        
        if not json_data:
            errors.append(f"Post {post_id}: Missing JSON data")
            continue
        
        # Build character and series arrays
        characters = [c for c in [character1, character2] if c]
        series = [s for s in [series1, series2] if s]
        
        # Generate tags (pass arrays, not individual values)
        tags = generate_tags(json_data['title'], characters, series)
        
        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(json_data['published_at'].replace('Z', '+00:00'))
        except Exception as e:
            print(f"  WARNING: Invalid timestamp for post {post_id}: {e}")
            timestamp = datetime.now()
        
        post = {
            'post_id': post_id,
            'timestamp': timestamp,
            'url': json_data['url'],
            'title': json_data['title'],
            'characters': characters,
            'series': series,
            'tags': tags,
            'image_urls': json_data['image_urls'],
            'thumbnail_urls': json_data['thumbnail_urls']
        }
        
        posts_to_insert.append(post)
        
        # Progress indicator
        if i % 100 == 0:
            print(f"Processed {i}/{len(rows)} posts...")
    
    print()
    print(f"Successfully processed {len(posts_to_insert)} posts")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\nErrors encountered:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
    
    if dry_run:
        print("\n[DRY RUN] Would insert posts into database")
        print("\nSample post:")
        if posts_to_insert:
            sample = posts_to_insert[0]
            print(f"  Post ID: {sample['post_id']}")
            print(f"  Title: {sample['title']}")
            print(f"  URL: {sample['url']}")
            print(f"  Timestamp: {sample['timestamp']}")
            print(f"  Characters: {sample['characters']}")
            print(f"  Series: {sample['series']}")
            print(f"  Tags: {sample['tags']}")
            print(f"  Image URLs: {len(sample['image_urls'])} found")
            print(f"  Thumbnail URLs: {len(sample['thumbnail_urls'])} found")
        return
    
    # Insert into database
    print("\nInserting into database...")
    
    # Get database URL from environment or use default
    db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres@localhost/vamasubmissions')
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        for i, post in enumerate(posts_to_insert, 1):
            try:
                cursor.execute(
                    """
                    INSERT INTO posts (
                        post_id, timestamp, url, title, 
                        characters, series, tags, 
                        image_urls, thumbnail_urls
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        post['post_id'],
                        post['timestamp'],
                        post['url'],
                        post['title'],
                        post['characters'],
                        post['series'],
                        post['tags'],
                        post['image_urls'],
                        post['thumbnail_urls']
                    )
                )
                
                if i % 100 == 0:
                    print(f"Inserted {i}/{len(posts_to_insert)} posts...")
                    conn.commit()
            
            except Exception as e:
                print(f"  ERROR inserting post {post['post_id']}: {e}")
                errors.append(f"Post {post['post_id']}: Insert failed - {e}")
                conn.rollback()
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print()
        print(f"[SUCCESS] Imported {len(posts_to_insert)} posts")
        if errors:
            print(f"[WARNING] {len(errors)} errors encountered")
    
    except Exception as e:
        print(f"[ERROR] Database connection failed: {e}")
        sys.exit(1)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Import VAMA posts from CSV and JSON')
    parser.add_argument('--csv', default='vama_posts_initial.csv', help='Path to CSV file')
    parser.add_argument('--json-dir', default='all-post-api', help='Path to JSON directory')
    parser.add_argument('--dry-run', action='store_true', help='Test without inserting')
    
    args = parser.parse_args()
    
    csv_path = Path(args.csv)
    json_dir = Path(args.json_dir)
    
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}")
        sys.exit(1)
    
    if not json_dir.exists():
        print(f"ERROR: JSON directory not found: {json_dir}")
        sys.exit(1)
    
    import_posts(csv_path, json_dir, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
