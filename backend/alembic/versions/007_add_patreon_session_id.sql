-- Add patreon_session_id column to admin_settings table
-- This allows admins to paste their Patreon session cookie for gallery-dl authentication

ALTER TABLE admin_settings ADD COLUMN patreon_session_id TEXT;
