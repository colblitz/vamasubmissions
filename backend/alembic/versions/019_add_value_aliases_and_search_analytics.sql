-- Migration 019: Add value_aliases and search_analytics tables
-- Created: 2026-02-04
-- Description: Add support for value aliases (e.g., FGO -> Fate/Grand Order) and track zero-result searches

-- Create value_aliases table
CREATE TABLE IF NOT EXISTS value_aliases (
    id SERIAL PRIMARY KEY,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('characters', 'series', 'tags')),
    canonical_value TEXT NOT NULL,
    alias_value TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_alias_per_field UNIQUE(field_type, alias_value)
);

-- Create indexes for value_aliases
CREATE INDEX IF NOT EXISTS idx_aliases_field_type ON value_aliases(field_type);
CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON value_aliases(canonical_value);
CREATE INDEX IF NOT EXISTS idx_aliases_alias_lower ON value_aliases(LOWER(alias_value));

-- Create search_analytics table to track zero-result searches
CREATE TABLE IF NOT EXISTS search_analytics (
    id SERIAL PRIMARY KEY,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('characters', 'series', 'tags')),
    search_term TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    searched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for search_analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_field_type ON search_analytics(field_type);
CREATE INDEX IF NOT EXISTS idx_search_analytics_result_count ON search_analytics(result_count);
CREATE INDEX IF NOT EXISTS idx_search_analytics_searched_at ON search_analytics(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_term_lower ON search_analytics(LOWER(search_term));

-- Create materialized view for zero-result search suggestions (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS zero_result_search_suggestions AS
SELECT 
    field_type,
    LOWER(search_term) as search_term_lower,
    search_term,
    COUNT(*) as search_count,
    MAX(searched_at) as last_searched
FROM search_analytics
WHERE result_count = 0
GROUP BY field_type, LOWER(search_term), search_term
HAVING COUNT(*) >= 2  -- Only show terms searched at least twice
ORDER BY COUNT(*) DESC, MAX(searched_at) DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_zero_result_suggestions_field ON zero_result_search_suggestions(field_type);
CREATE INDEX IF NOT EXISTS idx_zero_result_suggestions_count ON zero_result_search_suggestions(search_count DESC);

-- Add comment
COMMENT ON TABLE value_aliases IS 'Maps alias values to canonical values (e.g., FGO -> Fate/Grand Order)';
COMMENT ON TABLE search_analytics IS 'Tracks all searches to identify zero-result queries for alias suggestions';
COMMENT ON MATERIALIZED VIEW zero_result_search_suggestions IS 'Aggregated zero-result searches for suggesting new aliases';
