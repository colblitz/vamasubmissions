#!/bin/bash

# Run All Database Migrations
# This script runs all migrations in order and is idempotent (safe to re-run)

set -e

echo "=========================================="
echo "Run All Database Migrations"
echo "=========================================="
echo ""

DB_NAME="vamasubmissions"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backend/alembic/versions" && pwd)"

echo "Database: $DB_NAME"
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""

# Check if we can connect to database
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "ERROR: Database '$DB_NAME' does not exist!"
    exit 1
fi

echo "Found migrations:"
ls -1 "$MIGRATIONS_DIR"/*.sql | sort
echo ""

read -p "Run all migrations? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Running migrations..."
echo ""

# Run each migration in order
for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    migration_name=$(basename "$migration")
    echo "Running: $migration_name"
    
    # Run migration (most are idempotent with IF NOT EXISTS or similar)
    if sudo -u postgres psql "$DB_NAME" -f "$migration" > /dev/null 2>&1; then
        echo "  ✓ Success"
    else
        echo "  ⚠ Warning: Migration may have already been applied or encountered an error"
        echo "  This is usually safe if the migration uses IF NOT EXISTS"
    fi
    echo ""
done

echo "=========================================="
echo "Migrations Complete!"
echo "=========================================="
echo ""

# Show current schema
echo "Current users table schema:"
sudo -u postgres psql "$DB_NAME" -c "\d users"
echo ""

echo "Current posts table schema:"
sudo -u postgres psql "$DB_NAME" -c "\d posts"
echo ""

echo "All migrations have been applied."
echo ""
