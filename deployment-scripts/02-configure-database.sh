#!/bin/bash
# Database Configuration Script
# Run as DEPLOY user
# Usage: bash 02-configure-database.sh

set -e

echo "=== PostgreSQL Database Setup ==="
echo ""

# Prompt for database password
read -sp "Enter password for database user 'patreon_user': " DB_PASSWORD
echo ""
read -sp "Confirm password: " DB_PASSWORD_CONFIRM
echo ""

if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
    echo "ERROR: Passwords do not match!"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: Password cannot be empty!"
    exit 1
fi

echo "[1/3] Creating database and user..."

# Create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE patreon_submissions;

-- Create user
CREATE USER patreon_user WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE patreon_submissions TO patreon_user;

-- Grant schema privileges (for PostgreSQL 15+)
\c patreon_submissions
GRANT ALL ON SCHEMA public TO patreon_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO patreon_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO patreon_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO patreon_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO patreon_user;

\q
EOF

echo "[2/3] Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql -U patreon_user -d patreon_submissions -h localhost -c "SELECT version();" > /dev/null

if [ $? -eq 0 ]; then
    echo "✓ Database connection successful!"
else
    echo "✗ Database connection failed!"
    exit 1
fi

echo "[3/3] Saving database password to file..."
mkdir -p ~/deployment-config
echo "$DB_PASSWORD" > ~/deployment-config/db_password.txt
chmod 600 ~/deployment-config/db_password.txt

echo ""
echo "=== Database Setup Complete! ==="
echo ""
echo "Database password saved to: ~/deployment-config/db_password.txt"
echo ""
echo "Next steps:"
echo "1. Run: bash 03-deploy-application.sh"
echo ""
