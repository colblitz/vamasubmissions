-- Migration: 014_update_global_edit_suggestions
-- Description: Remove redundant columns and add data integrity constraint
-- Date: 2026-01-24

-- Remove affected_post_ids column (redundant tracking)
ALTER TABLE global_edit_suggestions DROP COLUMN IF EXISTS affected_post_ids;

-- Remove affected_count column (can be calculated if needed)
ALTER TABLE global_edit_suggestions DROP COLUMN IF EXISTS affected_count;

-- Add constraint to ensure old_value and new_value are different
-- This prevents meaningless edit suggestions where nothing actually changes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_values_different' 
        AND conrelid = 'global_edit_suggestions'::regclass
    ) THEN
        ALTER TABLE global_edit_suggestions 
        ADD CONSTRAINT check_values_different 
        CHECK (old_value != new_value);
    END IF;
END $$;
