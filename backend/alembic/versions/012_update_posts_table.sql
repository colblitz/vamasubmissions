-- Migration: 012_update_posts_table
-- Description: Simplify posts table by removing redundant data and renaming columns
-- Date: 2026-01-24

-- Replace image_urls array with single thumbnail_url
-- Drop the old array column
ALTER TABLE posts DROP COLUMN IF EXISTS image_urls;

-- Add new thumbnail_url column for single image reference
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Rename url to patreon_url for clarity (idempotent)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'url'
    ) THEN
        ALTER TABLE posts RENAME COLUMN url TO patreon_url;
    END IF;
END $$;

-- Remove raw_patreon_json column (redundant data storage)
ALTER TABLE posts DROP COLUMN IF EXISTS raw_patreon_json;
