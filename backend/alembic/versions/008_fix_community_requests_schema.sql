-- Fix community_requests schema to match model
-- Migration: 008_fix_community_requests_schema.sql

-- Drop old columns and add new array columns
ALTER TABLE community_requests 
    DROP COLUMN IF EXISTS character_name,
    DROP COLUMN IF EXISTS series;

ALTER TABLE community_requests
    ADD COLUMN IF NOT EXISTS characters TEXT[] DEFAULT '{}' NOT NULL,
    ADD COLUMN IF NOT EXISTS series TEXT[] DEFAULT '{}' NOT NULL;

-- Add GIN indexes for array fields
CREATE INDEX IF NOT EXISTS idx_community_requests_characters_gin ON community_requests USING GIN (characters);
CREATE INDEX IF NOT EXISTS idx_community_requests_series_gin ON community_requests USING GIN (series);
