-- Migration: 013_update_community_requests
-- Description: Rename timestamp column to be more descriptive
-- Date: 2026-01-24

-- Rename timestamp to requested_timestamp for clarity (idempotent)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_requests' AND column_name = 'timestamp'
    ) THEN
        ALTER TABLE community_requests RENAME COLUMN timestamp TO requested_timestamp;
    END IF;
END $$;
