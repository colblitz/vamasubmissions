-- Migration: Remove OAuth tokens and legacy credit columns
-- Description: Removes Patreon OAuth token fields and legacy credit system columns
--              from the users table as these features are no longer in use.
--
-- Columns being removed:
--   - patreon_access_token: OAuth access token (no longer needed)
--   - patreon_refresh_token: OAuth refresh token (no longer needed)
--   - patreon_token_expires_at: Token expiration timestamp (no longer needed)
--   - last_credit_refresh: Credit refresh tracking (legacy feature removed)
--   - credits: User credit balance (legacy feature removed)
--
-- Index being removed:
--   - idx_users_token_expiry: Index on token expiration (no longer needed)
--
-- This migration is idempotent and safe to run multiple times.

-- Drop the token expiry index if it exists
DROP INDEX IF EXISTS idx_users_token_expiry;

-- Remove Patreon OAuth token columns
ALTER TABLE users DROP COLUMN IF EXISTS patreon_access_token;
ALTER TABLE users DROP COLUMN IF EXISTS patreon_refresh_token;
ALTER TABLE users DROP COLUMN IF EXISTS patreon_token_expires_at;

-- Remove legacy credit system columns
ALTER TABLE users DROP COLUMN IF EXISTS last_credit_refresh;
ALTER TABLE users DROP COLUMN IF EXISTS credits;
