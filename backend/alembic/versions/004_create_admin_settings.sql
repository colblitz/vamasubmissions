-- Migration: Create admin_settings table
-- Date: 2026-01-22
-- Description: Store Patreon OAuth tokens for admin users separately from User model

CREATE TABLE admin_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    patreon_access_token TEXT,
    patreon_refresh_token TEXT,
    patreon_token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookup by user_id
CREATE INDEX idx_admin_settings_user ON admin_settings(user_id);

-- Add comments for documentation
COMMENT ON TABLE admin_settings IS 'Stores Patreon OAuth tokens for admin users to fetch new posts';
COMMENT ON COLUMN admin_settings.patreon_access_token IS 'Patreon OAuth access token (encrypted in production)';
COMMENT ON COLUMN admin_settings.patreon_refresh_token IS 'Patreon OAuth refresh token for renewing expired access tokens';
COMMENT ON COLUMN admin_settings.patreon_token_expires_at IS 'When the access token expires (typically 1 month)';
