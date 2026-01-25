-- Migration: 015_drop_admin_settings
-- Description: Remove admin_settings table (no longer needed)
-- Date: 2026-01-24

-- Drop the admin_settings table entirely
DROP TABLE IF EXISTS admin_settings;
