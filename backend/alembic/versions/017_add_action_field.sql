-- Add action_field column to global_edit_suggestions
-- This allows separate condition and action fields for global edits

-- Add the action_field column with a default value equal to field_name
ALTER TABLE global_edit_suggestions 
ADD COLUMN action_field VARCHAR(50) NOT NULL DEFAULT '';

-- Update existing rows to set action_field equal to field_name
UPDATE global_edit_suggestions 
SET action_field = field_name;

-- Now we can remove the default since all rows have values
ALTER TABLE global_edit_suggestions 
ALTER COLUMN action_field DROP DEFAULT;
