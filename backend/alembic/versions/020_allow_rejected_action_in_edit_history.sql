-- Migration 020: Allow REJECTED action in edit_history
-- This adds REJECTED as a valid action value to track rejected edits

DO $$
BEGIN
    -- Drop the existing constraint
    ALTER TABLE edit_history DROP CONSTRAINT IF EXISTS valid_history_action;
    
    -- Recreate the constraint with REJECTED included
    ALTER TABLE edit_history ADD CONSTRAINT valid_history_action
        CHECK (action IN ('ADD', 'DELETE', 'REJECTED'));
END $$;

-- Add index for faster filtering by action type (if not exists)
CREATE INDEX IF NOT EXISTS idx_edit_history_action ON edit_history(action);
