#!/bin/bash

# Clean Test Data Script
# Removes test edits, requests, and users (except specified user)

set -e

echo "=========================================="
echo "Clean Test Data Script"
echo "=========================================="
echo ""

# Check if user ID is provided
if [ -z "$1" ]; then
    echo "ERROR: Please provide your user ID as an argument"
    echo ""
    echo "Usage: ./clean_test_data.sh YOUR_USER_ID"
    echo ""
    echo "To find your user ID, run:"
    echo "  psql vamasubmissions -c \"SELECT id, email, patreon_id FROM users;\""
    echo ""
    exit 1
fi

YOUR_USER_ID=$1

echo "This script will:"
echo "  - Delete ALL edit suggestions and edit history"
echo "  - Delete ALL community requests"
echo "  - Delete ALL users EXCEPT user ID: $YOUR_USER_ID"
echo "  - Keep ALL posts (real data)"
echo ""

# Show current user info
echo "Your user info:"
psql vamasubmissions -c "SELECT id, email, patreon_id, tier FROM users WHERE id = $YOUR_USER_ID;"
echo ""

read -p "Are you sure you want to continue? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Creating backups..."

# Create backup directory
BACKUP_DIR="$HOME/vamasubmissions-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Backup tables
psql vamasubmissions -c "\copy users TO '$BACKUP_DIR/users-$TIMESTAMP.csv' CSV HEADER;"
psql vamasubmissions -c "\copy edit_suggestions TO '$BACKUP_DIR/edit_suggestions-$TIMESTAMP.csv' CSV HEADER;"
psql vamasubmissions -c "\copy community_requests TO '$BACKUP_DIR/community_requests-$TIMESTAMP.csv' CSV HEADER;"

echo "✓ Backups created in: $BACKUP_DIR"
echo ""

echo "Cleaning test data..."

# Clean test data
psql vamasubmissions << EOF
-- Delete all edit suggestions and history
DELETE FROM edit_suggestions;
DELETE FROM edit_history;

-- Delete all community requests
DELETE FROM community_requests;

-- Delete all users except the specified one
DELETE FROM users WHERE id != $YOUR_USER_ID;

-- Show what's left
SELECT 'Users remaining:' as info, COUNT(*) as count FROM users;
SELECT 'Posts remaining:' as info, COUNT(*) as count FROM posts;
SELECT 'Edits remaining:' as info, COUNT(*) as count FROM edit_suggestions;
SELECT 'Requests remaining:' as info, COUNT(*) as count FROM community_requests;
EOF

echo ""
echo "=========================================="
echo "Test Data Cleaned Successfully!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Backups saved to: $BACKUP_DIR"
echo "  - Kept user ID: $YOUR_USER_ID"
echo "  - Deleted all test edits, requests, and other users"
echo "  - Kept all posts (real data)"
echo ""
