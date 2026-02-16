-- Add reason column to edit_history table
-- This stores the rejection reason when an edit is rejected

-- Add the reason column (nullable since only rejections have reasons)
ALTER TABLE edit_history 
ADD COLUMN reason TEXT NULL;

-- Add index for querying rejections by reason
CREATE INDEX idx_edit_history_reason ON edit_history(reason) 
WHERE reason IS NOT NULL;
