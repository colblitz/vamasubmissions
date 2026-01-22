-- Migration: Add 'skipped' status to posts
-- Date: 2026-01-22
-- Description: Allow posts to be marked as 'skipped' for non-character content (announcements, etc.)

-- Drop the old constraint
ALTER TABLE posts 
DROP CONSTRAINT check_post_status;

-- Add new constraint with 'skipped' status
ALTER TABLE posts 
ADD CONSTRAINT check_post_status 
CHECK (status IN ('pending', 'published', 'skipped'));

-- Add comment for documentation
COMMENT ON COLUMN posts.status IS 'Post status: pending (awaiting review), published (visible in search), or skipped (non-character content, prevents re-import)';
