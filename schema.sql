-- Patreon Character Submission Site - Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    patreon_id VARCHAR(255) UNIQUE NOT NULL,
    patreon_username VARCHAR(255),
    email VARCHAR(255),
    tier INTEGER NOT NULL DEFAULT 1, -- 1=free, 2/3/4=paid tiers
    credits INTEGER NOT NULL DEFAULT 0,
    role VARCHAR(50) NOT NULL DEFAULT 'patron', -- patron, creator, admin
    last_credit_refresh TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_patreon_id ON users(patreon_id);
CREATE INDEX idx_users_tier ON users(tier);

-- Credit transactions (for audit trail)
CREATE TABLE credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for additions, negative for spending
    transaction_type VARCHAR(50) NOT NULL, -- 'monthly_refresh', 'submission_cost', 'refund', 'adjustment'
    description TEXT,
    submission_id INTEGER, -- nullable, links to submission if applicable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_submission ON credit_transactions(submission_id);

-- Submissions table
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Character details
    character_name VARCHAR(255) NOT NULL,
    series VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Request modifiers (each costs +1 credit)
    is_large_image_set BOOLEAN DEFAULT FALSE,
    is_double_character BOOLEAN DEFAULT FALSE,
    
    -- Queue management
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    queue_type VARCHAR(50) NOT NULL, -- 'paid' or 'free'
    queue_position INTEGER, -- position in queue (null if completed/cancelled)
    vote_count INTEGER DEFAULT 0, -- for tier 1 submissions
    
    -- Timestamps
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP, -- when creator marks as in_progress
    completed_at TIMESTAMP,
    
    -- Completion details
    patreon_post_link VARCHAR(500),
    creator_notes TEXT, -- internal notes for creator/admin
    
    -- Metadata
    credit_cost INTEGER NOT NULL DEFAULT 1, -- base 1 + modifiers
    estimated_completion_date TIMESTAMP,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_queue_type ON submissions(queue_type);
CREATE INDEX idx_submissions_queue_position ON submissions(queue_position);
CREATE INDEX idx_submissions_series ON submissions(series); -- for autocomplete
CREATE INDEX idx_submissions_character_name ON submissions(character_name); -- for search

-- Images table
CREATE TABLE submission_images (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL, -- in bytes
    mime_type VARCHAR(100),
    upload_order INTEGER NOT NULL, -- order images were uploaded
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submission_images_submission ON submission_images(submission_id);

-- Votes table (for tier 1 submissions)
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, submission_id) -- one vote per user per submission
);

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_submission ON votes(submission_id);

-- User votes allocation (tracks monthly vote allowance)
CREATE TABLE user_vote_allowance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- format: YYYY-MM
    votes_available INTEGER NOT NULL DEFAULT 0,
    votes_used INTEGER NOT NULL DEFAULT 0,
    
    UNIQUE(user_id, month_year)
);

CREATE INDEX idx_user_vote_allowance_user ON user_vote_allowance(user_id);

-- Sessions table (for JWT token management)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- System configuration table (for admin settings)
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO system_config (key, value, description) VALUES
    ('tier1_votes_per_month', '3', 'Number of votes tier 1 users get per month'),
    ('session_expiry_days', '30', 'Number of days before session expires'),
    ('avg_completion_days', '7', 'Average days to complete a request (for estimates)'),
    ('max_image_size_mb', '10', 'Maximum image file size in MB'),
    ('max_images_per_submission', '20', 'Maximum number of images per submission');

-- Views for easier querying

-- Active queue view (paid queue)
CREATE VIEW paid_queue AS
SELECT 
    s.*,
    u.patreon_username,
    u.tier
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'pending' 
  AND s.queue_type = 'paid'
ORDER BY s.queue_position ASC;

-- Active queue view (free queue, ordered by votes)
CREATE VIEW free_queue AS
SELECT 
    s.*,
    u.patreon_username,
    u.tier
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'pending' 
  AND s.queue_type = 'free'
ORDER BY s.vote_count DESC, s.submitted_at ASC;

-- Completed submissions view
CREATE VIEW completed_submissions AS
SELECT 
    s.*,
    u.patreon_username,
    u.tier
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'completed'
ORDER BY s.completed_at DESC;

-- User statistics view
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.patreon_username,
    u.tier,
    u.credits,
    COUNT(CASE WHEN s.status = 'pending' THEN 1 END) as pending_submissions,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_submissions,
    COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_submissions
FROM users u
LEFT JOIN submissions s ON u.id = s.user_id
GROUP BY u.id, u.patreon_username, u.tier, u.credits;
