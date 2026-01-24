-- Migration: Add tier_name column to users table
-- Date: 2026-01-23
-- Description: Add tier_name column to display actual Patreon tier names instead of numbers

-- Add tier_name column
ALTER TABLE users 
ADD COLUMN tier_name VARCHAR(100);

-- Update existing users with tier names based on their current tier
UPDATE users SET tier_name = CASE 
    WHEN tier = 1 THEN 'Free Tier'
    WHEN tier = 2 THEN 'NSFW Art! Tier 1'
    WHEN tier = 3 THEN 'NSFW Art! Tier 2'
    WHEN tier = 4 THEN 'NSFW Art! Tier 3'
    WHEN tier = 5 THEN 'NSFW Art! Support'
    ELSE 'Free Tier'
END;

-- Add comment for documentation
COMMENT ON COLUMN users.tier_name IS 'Display name for the user''s Patreon tier';
