-- Add OAuth token fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS patreon_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS patreon_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS patreon_token_expires_at TIMESTAMP;

-- Add index for token expiry checks
CREATE INDEX IF NOT EXISTS idx_users_token_expiry ON users(patreon_token_expires_at);
