-- Migration: Add status and raw_patreon_json to posts table
-- Date: 2026-01-22
-- Description: Add status field for pending/published posts and store raw Patreon API JSON

-- Add status column (default 'published' for existing posts)
ALTER TABLE posts 
ADD COLUMN status VARCHAR(20) DEFAULT 'published' NOT NULL;

-- Add raw Patreon JSON storage
ALTER TABLE posts 
ADD COLUMN raw_patreon_json JSONB;

-- Add check constraint for status values
ALTER TABLE posts 
ADD CONSTRAINT check_post_status 
CHECK (status IN ('pending', 'published'));

-- Add index for filtering by status (used in search queries)
CREATE INDEX idx_posts_status ON posts(status);

-- Add comment for documentation
COMMENT ON COLUMN posts.status IS 'Post status: pending (awaiting review) or published (visible in search)';
COMMENT ON COLUMN posts.raw_patreon_json IS 'Raw Patreon API response for debugging and reprocessing';

-- Verify existing posts are set to 'published'
UPDATE posts SET status = 'published' WHERE status IS NULL;
