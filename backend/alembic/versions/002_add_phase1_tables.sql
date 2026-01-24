-- Phase 1: Community Features Tables
-- Migration: 002_add_phase1_tables.sql

-- Posts table (VAMA's existing Patreon posts)
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(255) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    characters TEXT[] DEFAULT '{}',
    series TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    image_urls TEXT[] DEFAULT '{}',
    thumbnail_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for posts
CREATE INDEX idx_posts_post_id ON posts(post_id);
CREATE INDEX idx_posts_timestamp ON posts(timestamp DESC);

-- GIN indexes for array fields (for faster array searches)
CREATE INDEX idx_posts_characters_gin ON posts USING GIN (characters);
CREATE INDEX idx_posts_series_gin ON posts USING GIN (series);
CREATE INDEX idx_posts_tags_gin ON posts USING GIN (tags);

-- Community Requests table (unofficial queue tracking)
CREATE TABLE community_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    character_name VARCHAR(255) NOT NULL,
    series VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL,  -- When user made the request to VAMA
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for community_requests
CREATE INDEX idx_requests_timestamp ON community_requests(timestamp);
CREATE INDEX idx_requests_user ON community_requests(user_id);
CREATE INDEX idx_requests_fulfilled ON community_requests(fulfilled);

-- Post Edits table (pending edit suggestions)
CREATE TABLE post_edits (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,  -- 'characters', 'series', 'tags'
    action VARCHAR(10) NOT NULL,      -- 'ADD', 'DELETE'
    value TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    CONSTRAINT valid_field_name CHECK (field_name IN ('characters', 'series', 'tags')),
    CONSTRAINT valid_action CHECK (action IN ('ADD', 'DELETE')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Indexes for post_edits
CREATE INDEX idx_edits_status ON post_edits(status);
CREATE INDEX idx_edits_post ON post_edits(post_id);
CREATE INDEX idx_edits_suggester ON post_edits(suggester_id);

-- Edit History table (audit log of all applied edits)
CREATE TABLE edit_history (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    suggester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_history_field CHECK (field_name IN ('characters', 'series', 'tags')),
    CONSTRAINT valid_history_action CHECK (action IN ('ADD', 'DELETE'))
);

-- Indexes for edit_history
CREATE INDEX idx_history_post ON edit_history(post_id);
CREATE INDEX idx_history_applied ON edit_history(applied_at DESC);
CREATE INDEX idx_history_suggester ON edit_history(suggester_id);
CREATE INDEX idx_history_approver ON edit_history(approver_id);
