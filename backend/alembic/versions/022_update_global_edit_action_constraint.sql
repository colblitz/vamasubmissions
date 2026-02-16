-- Update global_edit_suggestions action check constraint to allow REPLACE
-- This adds REPLACE as a valid action alongside ADD and DELETE

DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'global_edit_suggestions' 
        AND constraint_name = 'global_edit_suggestions_action_check'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        DROP CONSTRAINT global_edit_suggestions_action_check;
        
        RAISE NOTICE 'Dropped existing global_edit_suggestions_action_check constraint';
    END IF;
    
    -- Add the updated constraint with REPLACE included
    ALTER TABLE global_edit_suggestions 
    ADD CONSTRAINT global_edit_suggestions_action_check 
    CHECK (action IN ('ADD', 'DELETE', 'REPLACE'));
    
    RAISE NOTICE 'Added updated CHECK constraint for action column including REPLACE';
END $$;

-- Also update the action_value constraint to include REPLACE
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'global_edit_suggestions' 
        AND constraint_name = 'global_edit_suggestions_action_value_check'
    ) THEN
        ALTER TABLE global_edit_suggestions 
        DROP CONSTRAINT global_edit_suggestions_action_value_check;
        
        RAISE NOTICE 'Dropped existing global_edit_suggestions_action_value_check constraint';
    END IF;
    
    -- Add the updated constraint with REPLACE included (REPLACE requires action_value like ADD)
    ALTER TABLE global_edit_suggestions 
    ADD CONSTRAINT global_edit_suggestions_action_value_check 
    CHECK (
        (action = 'ADD' AND action_value IS NOT NULL) OR
        (action = 'REPLACE' AND action_value IS NOT NULL) OR
        (action = 'DELETE' AND action_value IS NULL)
    );
    
    RAISE NOTICE 'Added updated CHECK constraint for action_value including REPLACE';
END $$;
