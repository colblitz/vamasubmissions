-- Add ai_tag_suggestions table for the AI auto-tagging pipeline.
--
-- Each row is a model- or rule-generated tag suggestion for a post.
-- Status lifecycle: pending → accepted | rejected
-- When accepted, the tag is written to posts.tags[] and an edit_history
-- entry is created (source='ai', approver=reviewing admin).

CREATE TABLE ai_tag_suggestions (
    id            SERIAL PRIMARY KEY,
    post_id       INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    tag           TEXT NOT NULL,
    confidence    FLOAT NOT NULL,
    source        VARCHAR(50) NOT NULL,   -- 'clip', 'title_rule', 'char_cooccurrence'
    model_version TEXT,                  -- e.g. 'clip-vit-b32-v1'; NULL for rule-based
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
    reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, tag)                -- one suggestion per tag per post
);

CREATE INDEX ON ai_tag_suggestions (post_id, status);
