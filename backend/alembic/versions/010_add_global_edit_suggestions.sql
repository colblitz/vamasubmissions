-- Migration: Add global_edit_suggestions table for bulk rename functionality
-- Created: 2026-01-24

-- Global edit suggestions table
-- Allows users to suggest bulk changes across multiple posts (e.g., fix typo in character name)
CREATE TABLE global_edit_suggestions (
    id SERIAL PRIMARY KEY,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,  -- 'characters', 'series', or 'tags'
    old_value TEXT NOT NULL,          -- Value to replace (e.g., "Naruto Uzamaki")
    new_value TEXT NOT NULL,          -- New value (e.g., "Naruto Uzumaki")
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    affected_post_ids INTEGER[] DEFAULT '{}',  -- List of post IDs that will be affected
    affected_count INTEGER DEFAULT 0,  -- Number of posts affected (for quick display)
    previous_values JSONB,             -- Store previous state for undo: {post_id: [old_array]}
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    applied_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_field_name CHECK (field_name IN ('characters', 'series', 'tags')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT check_different_values CHECK (old_value != new_value)
);

-- Indices for performance
CREATE INDEX idx_global_edits_status ON global_edit_suggestions(status);
CREATE INDEX idx_global_edits_suggester ON global_edit_suggestions(suggester_id);
CREATE INDEX idx_global_edits_created ON global_edit_suggestions(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE global_edit_suggestions IS 'Bulk edit suggestions for fixing typos or renaming values across multiple posts';
COMMENT ON COLUMN global_edit_suggestions.affected_post_ids IS 'Array of post IDs that contain the old_value in the specified field';
COMMENT ON COLUMN global_edit_suggestions.previous_values IS 'JSONB map of post_id to previous array values, used for undo functionality';
COMMENT ON COLUMN global_edit_suggestions.affected_count IS 'Cached count of affected posts for quick display without array length calculation';
