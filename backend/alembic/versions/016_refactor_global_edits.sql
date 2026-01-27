-- Migration: 008_refactor_global_edit_suggestions.sql
-- Description: Refactor global_edit_suggestions table to support both ADD and DELETE actions
-- Date: 2026-01-26

-- This migration is IDEMPOTENT and can be run multiple times safely

BEGIN;

-- ============================================================================
-- STEP 1: Add 'action' column with default value 'ADD'
-- ============================================================================
-- This column determines whether the global edit adds or deletes content
-- Default is 'ADD' to maintain backward compatibility with existing records

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' 
        AND column_name = 'action'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        ADD COLUMN action VARCHAR(10) NOT NULL DEFAULT 'ADD';
        
        RAISE NOTICE 'Added action column to global_edit_suggestions table';
    ELSE
        RAISE NOTICE 'Column action already exists in global_edit_suggestions table';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add CHECK constraint for action column
-- ============================================================================
-- Ensures action can only be 'ADD' or 'DELETE'

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'global_edit_suggestions' 
        AND constraint_name = 'global_edit_suggestions_action_check'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        ADD CONSTRAINT global_edit_suggestions_action_check 
        CHECK (action IN ('ADD', 'DELETE'));
        
        RAISE NOTICE 'Added CHECK constraint for action column';
    ELSE
        RAISE NOTICE 'CHECK constraint global_edit_suggestions_action_check already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Rename 'old_value' column to 'pattern'
-- ============================================================================
-- 'pattern' better describes the content being searched for

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' 
        AND column_name = 'old_value'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        RENAME COLUMN old_value TO pattern;
        
        RAISE NOTICE 'Renamed old_value column to pattern';
    ELSE
        RAISE NOTICE 'Column old_value does not exist (may already be renamed to pattern)';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Rename 'new_value' column to 'action_value'
-- ============================================================================
-- 'action_value' is more generic and works for both ADD and DELETE actions

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' 
        AND column_name = 'new_value'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        RENAME COLUMN new_value TO action_value;
        
        RAISE NOTICE 'Renamed new_value column to action_value';
    ELSE
        RAISE NOTICE 'Column new_value does not exist (may already be renamed to action_value)';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Make 'action_value' nullable
-- ============================================================================
-- For DELETE actions, action_value should be NULL (nothing to replace with)

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' 
        AND column_name = 'action_value'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        ALTER COLUMN action_value DROP NOT NULL;
        
        RAISE NOTICE 'Made action_value column nullable';
    ELSE
        RAISE NOTICE 'Column action_value is already nullable or does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Add CHECK constraint for action_value based on action type
-- ============================================================================
-- Business rule: 
-- - When action = 'ADD', action_value must NOT be NULL
-- - When action = 'DELETE', action_value must be NULL

DO $$
BEGIN
    -- First, drop the constraint if it exists (to allow re-running)
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'global_edit_suggestions' 
        AND constraint_name = 'global_edit_suggestions_action_value_check'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        DROP CONSTRAINT global_edit_suggestions_action_value_check;
        
        RAISE NOTICE 'Dropped existing global_edit_suggestions_action_value_check constraint';
    END IF;
    
    -- Add the new constraint
    ALTER TABLE global_edit_suggestions 
    ADD CONSTRAINT global_edit_suggestions_action_value_check 
    CHECK (
        (action = 'ADD' AND action_value IS NOT NULL) OR
        (action = 'DELETE' AND action_value IS NULL)
    );
    
    RAISE NOTICE 'Added CHECK constraint for action_value based on action type';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding action_value CHECK constraint: %', SQLERRM;
        RAISE;
END $$;

-- ============================================================================
-- STEP 7: Verify the migration
-- ============================================================================

DO $$
DECLARE
    v_action_exists BOOLEAN;
    v_pattern_exists BOOLEAN;
    v_action_value_exists BOOLEAN;
    v_action_value_nullable BOOLEAN;
BEGIN
    -- Check if all columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' AND column_name = 'action'
    ) INTO v_action_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' AND column_name = 'pattern'
    ) INTO v_pattern_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_edit_suggestions' AND column_name = 'action_value'
    ) INTO v_action_value_exists;
    
    SELECT is_nullable = 'YES' FROM information_schema.columns 
    WHERE table_name = 'global_edit_suggestions' AND column_name = 'action_value'
    INTO v_action_value_nullable;
    
    -- Report results
    RAISE NOTICE '=== Migration Verification ===';
    RAISE NOTICE 'action column exists: %', v_action_exists;
    RAISE NOTICE 'pattern column exists: %', v_pattern_exists;
    RAISE NOTICE 'action_value column exists: %', v_action_value_exists;
    RAISE NOTICE 'action_value is nullable: %', v_action_value_nullable;
    
    IF v_action_exists AND v_pattern_exists AND v_action_value_exists AND v_action_value_nullable THEN
        RAISE NOTICE 'Migration completed successfully!';
    ELSE
        RAISE WARNING 'Migration may be incomplete. Please review the results above.';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (for reference only - do not execute)
-- ============================================================================
-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- ALTER TABLE global_edit_suggestions DROP CONSTRAINT IF EXISTS global_edit_suggestions_action_value_check;
-- ALTER TABLE global_edit_suggestions DROP CONSTRAINT IF EXISTS global_edit_suggestions_action_check;
-- ALTER TABLE global_edit_suggestions ALTER COLUMN action_value SET NOT NULL;
-- ALTER TABLE global_edit_suggestions RENAME COLUMN action_value TO new_value;
-- ALTER TABLE global_edit_suggestions RENAME COLUMN pattern TO old_value;
-- ALTER TABLE global_edit_suggestions DROP COLUMN IF EXISTS action;
-- COMMIT;
