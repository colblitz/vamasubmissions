-- Migration: Add performance indices for text search and sorting
-- Created: 2026-01-24

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text search indices using GIN (Generalized Inverted Index) with trigram operators
-- These enable fast LIKE, ILIKE, and similarity searches on text columns
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_characters_trgm ON posts USING gin(characters gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_series_trgm ON posts USING gin(series gin_trgm_ops);

-- Sorting index for timestamp-based queries (DESC for most recent first)
CREATE INDEX IF NOT EXISTS idx_posts_timestamp_desc ON posts(timestamp DESC);

-- Composite index for pending edits queries
-- Optimizes queries that filter by post_id and status together
CREATE INDEX IF NOT EXISTS idx_post_edits_post_id_status ON post_edits(post_id, status);
