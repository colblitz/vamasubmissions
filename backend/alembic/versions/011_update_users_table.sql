-- Migration: 011_update_users_table
-- Description: Update users table to use Patreon tier_id and add patron status tracking
-- Date: 2026-01-24

-- Drop legacy views that depend on the tier column
DROP VIEW IF EXISTS paid_queue CASCADE;
DROP VIEW IF EXISTS free_queue CASCADE;
DROP VIEW IF EXISTS completed_submissions CASCADE;
DROP VIEW IF EXISTS user_stats CASCADE;

-- Remove email column (no longer needed)
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- Remove old tier INTEGER column (replaced by tier_id)
ALTER TABLE users DROP COLUMN IF EXISTS tier;

-- Remove tier_name column (tier information now comes from tier_id reference)
ALTER TABLE users DROP COLUMN IF EXISTS tier_name;

-- Add tier_id to reference Patreon tier information
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_id VARCHAR(50);

-- Add campaign_id to track which Patreon campaign the user belongs to
ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(50);

-- Add patron_status to track patron lifecycle (e.g., "active_patron", "former_patron")
ALTER TABLE users ADD COLUMN IF NOT EXISTS patron_status VARCHAR(50);
