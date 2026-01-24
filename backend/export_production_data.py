#!/usr/bin/env python3
"""
Export production-ready data from local database.

This script:
1. Exports all posts from local database
2. Updates thumbnail URLs to use static format
3. Exports your user account (cleans test users)
4. Creates a SQL dump ready for production import

Usage:
    python3 export_production_data.py --user-email your@email.com
"""
import os
import sys
from pathlib import Path
import argparse

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("ERROR: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)


def export_production_data(
    db_url: str,
    user_email: str,
    static_thumbnail_base: str,
    output_file: Path
):
    """Export production-ready data from local database."""
    
    print("=" * 60)
    print("Export Production Data")
    print("=" * 60)
    print()
    print(f"Database: {db_url}")
    print(f"User email: {user_email}")
    print(f"Static thumbnail base: {static_thumbnail_base}")
    print(f"Output file: {output_file}")
    print()
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Open output file
    with open(output_file, 'w') as f:
        f.write("-- Production Data Export\n")
        f.write(f"-- Generated: {os.popen('date').read().strip()}\n")
        f.write("-- This file contains:\n")
        f.write("--   1. Your user account\n")
        f.write("--   2. All posts with static thumbnail URLs\n")
        f.write("--   3. Clean data (no test edits/requests)\n")
        f.write("\n")
        f.write("BEGIN;\n\n")
        
        # Export user
        print("[1/2] Exporting user account...")
        cursor.execute("""
            SELECT * FROM users WHERE email = %s
        """, (user_email,))
        
        user = cursor.fetchone()
        if not user:
            print(f"ERROR: User with email '{user_email}' not found!")
            sys.exit(1)
        
        print(f"  Found user: {user['email']} (ID: {user['id']})")
        
        # Write user insert
        f.write("-- User account\n")
        f.write("INSERT INTO users (")
        f.write(", ".join(user.keys()))
        f.write(") VALUES (")
        
        values = []
        for key, value in user.items():
            if value is None:
                values.append("NULL")
            elif isinstance(value, str):
                # Escape single quotes by doubling them
                escaped = value.replace("'", "''")
                values.append(f"'{escaped}'")
            elif isinstance(value, bool):
                values.append("TRUE" if value else "FALSE")
            elif hasattr(value, 'isoformat'):
                # Handle datetime/date objects
                values.append(f"'{value.isoformat()}'")
            else:
                values.append(str(value))
        
        f.write(", ".join(values))
        f.write(")\n")
        f.write("ON CONFLICT (patreon_id) DO UPDATE SET\n")
        f.write("  email = EXCLUDED.email,\n")
        f.write("  tier = EXCLUDED.tier,\n")
        f.write("  tier_name = EXCLUDED.tier_name,\n")
        f.write("  last_login = EXCLUDED.last_login;\n\n")
        
        # Export posts
        print("[2/2] Exporting posts with updated thumbnail URLs...")
        cursor.execute("SELECT COUNT(*) as count FROM posts")
        post_count = cursor.fetchone()['count']
        print(f"  Found {post_count} posts")
        
        cursor.execute("""
            SELECT 
                post_id,
                timestamp,
                url,
                title,
                characters,
                series,
                tags,
                image_urls,
                thumbnail_urls,
                status
            FROM posts
            ORDER BY timestamp DESC
        """)
        
        f.write("-- Posts\n")
        
        posts_exported = 0
        for post in cursor:
            # Update thumbnail URLs to static format
            # Format: https://vamarequests.com/static/thumbnails/{post_id}-thumbnail-square.jpg
            static_thumbnail_url = f"{static_thumbnail_base}/{post['post_id']}-thumbnail-square.jpg"
            
            # Build INSERT statement
            f.write("INSERT INTO posts (")
            f.write("post_id, timestamp, url, title, characters, series, tags, ")
            f.write("image_urls, thumbnail_urls, status")
            f.write(") VALUES (")
            
            # post_id
            f.write(f"'{post['post_id']}', ")
            
            # timestamp
            if hasattr(post['timestamp'], 'isoformat'):
                f.write(f"'{post['timestamp'].isoformat()}', ")
            else:
                f.write(f"'{post['timestamp']}', ")
            
            # url
            url_escaped = post['url'].replace("'", "''")
            f.write(f"'{url_escaped}', ")
            
            # title
            title_escaped = post['title'].replace("'", "''")
            f.write(f"'{title_escaped}', ")
            
            # characters (array)
            if post['characters']:
                chars_escaped = []
                for c in post['characters']:
                    escaped = c.replace("'", "''")
                    chars_escaped.append(f"'{escaped}'")
                f.write(f"ARRAY[{', '.join(chars_escaped)}]::text[], ")
            else:
                f.write("ARRAY[]::text[], ")
            
            # series (array)
            if post['series']:
                series_escaped = []
                for s in post['series']:
                    escaped = s.replace("'", "''")
                    series_escaped.append(f"'{escaped}'")
                f.write(f"ARRAY[{', '.join(series_escaped)}]::text[], ")
            else:
                f.write("ARRAY[]::text[], ")
            
            # tags (array)
            if post['tags']:
                tags_escaped = []
                for t in post['tags']:
                    escaped = t.replace("'", "''")
                    tags_escaped.append(f"'{escaped}'")
                f.write(f"ARRAY[{', '.join(tags_escaped)}]::text[], ")
            else:
                f.write("ARRAY[]::text[], ")
            
            # image_urls (array)
            if post['image_urls']:
                imgs_escaped = []
                for i in post['image_urls']:
                    escaped = i.replace("'", "''")
                    imgs_escaped.append(f"'{escaped}'")
                f.write(f"ARRAY[{', '.join(imgs_escaped)}]::text[], ")
            else:
                f.write("ARRAY[]::text[], ")
            
            # thumbnail_urls (array) - USE STATIC URL
            f.write(f"ARRAY['{static_thumbnail_url}']::text[], ")
            
            # status (last field, no comma)
            f.write(f"'{post['status']}'")
            
            f.write(")\n")
            f.write("ON CONFLICT (post_id) DO UPDATE SET\n")
            f.write("  title = EXCLUDED.title,\n")
            f.write("  characters = EXCLUDED.characters,\n")
            f.write("  series = EXCLUDED.series,\n")
            f.write("  tags = EXCLUDED.tags,\n")
            f.write("  thumbnail_urls = EXCLUDED.thumbnail_urls;\n\n")
            
            posts_exported += 1
            if posts_exported % 100 == 0:
                print(f"  Exported {posts_exported}/{post_count} posts...")
        
        f.write("COMMIT;\n")
        
        print(f"  Exported {posts_exported} posts")
    
    cursor.close()
    conn.close()
    
    print()
    print("=" * 60)
    print("Export Complete!")
    print("=" * 60)
    print()
    print(f"Output file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")
    print()
    print("To import on production server:")
    print(f"  1. Upload file: rsync -avz {output_file} deploy@45.33.94.21:~/")
    print(f"  2. SSH to server: ssh deploy@45.33.94.21")
    print(f"  3. Import: sudo -u postgres psql vamasubmissions < ~/{output_file.name}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description='Export production-ready data from local database',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export with your email
  python3 export_production_data.py --user-email your@email.com
  
  # Custom database URL
  python3 export_production_data.py \\
    --user-email your@email.com \\
    --db-url postgresql://user:pass@localhost/vamasubmissions
  
  # Custom output file
  python3 export_production_data.py \\
    --user-email your@email.com \\
    --output production_data.sql
        """
    )
    
    parser.add_argument(
        '--user-email',
        required=True,
        help='Your email address (to identify your user account)'
    )
    
    parser.add_argument(
        '--db-url',
        default=os.environ.get('DATABASE_URL', 'postgresql://localhost/vamasubmissions'),
        help='Database URL (default: postgresql://localhost/vamasubmissions)'
    )
    
    parser.add_argument(
        '--static-thumbnail-base',
        default='https://vamarequests.com/static/thumbnails',
        help='Base URL for static thumbnails (default: https://vamarequests.com/static/thumbnails)'
    )
    
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('production_data.sql'),
        help='Output SQL file (default: production_data.sql)'
    )
    
    args = parser.parse_args()
    
    export_production_data(
        db_url=args.db_url,
        user_email=args.user_email,
        static_thumbnail_base=args.static_thumbnail_base,
        output_file=args.output
    )


if __name__ == '__main__':
    main()
