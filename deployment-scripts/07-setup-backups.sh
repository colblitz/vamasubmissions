#!/bin/bash
# Backup Setup Script
# Run as DEPLOY user
# Usage: bash 07-setup-backups.sh

set -e

echo "=== Backup Setup ==="
echo ""

# Get database password
if [ -f ~/deployment-config/db_password.txt ]; then
    DB_PASSWORD=$(cat ~/deployment-config/db_password.txt)
else
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
fi

echo "[1/4] Creating backup directory..."
mkdir -p ~/backups
chmod 700 ~/backups

echo "[2/4] Creating database backup script..."
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Get database password
if [ -f ~/deployment-config/db_password.txt ]; then
    export PGPASSWORD=$(cat ~/deployment-config/db_password.txt)
else
    echo "ERROR: Database password file not found!"
    exit 1
fi

# Backup database
pg_dump -U patreon_user -h localhost patreon_submissions > $BACKUP_DIR/db_$DATE.sql

if [ $? -eq 0 ]; then
    gzip $BACKUP_DIR/db_$DATE.sql
    echo "✓ Database backup created: db_$DATE.sql.gz"
else
    echo "✗ Database backup failed!"
    exit 1
fi

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

# Backup uploads directory
rsync -a /home/deploy/vamasubmissions/uploads/ $BACKUP_DIR/uploads/ 2>/dev/null || true

echo "✓ Backup complete"
EOF

chmod +x ~/backup-db.sh

echo "[3/4] Testing backup script..."
~/backup-db.sh

if [ $? -eq 0 ]; then
    echo "✓ Backup test successful"
else
    echo "✗ Backup test failed"
    exit 1
fi

echo "[4/4] Setting up automatic daily backups..."
# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null | grep -v backup-db.sh; echo "0 2 * * * /home/deploy/backup-db.sh >> /home/deploy/backups/backup.log 2>&1") | crontab -

echo ""
echo "=== Backup Setup Complete! ==="
echo ""
echo "Backup configuration:"
echo "  - Backup directory: ~/backups"
echo "  - Backup script: ~/backup-db.sh"
echo "  - Schedule: Daily at 2:00 AM"
echo "  - Retention: 7 days"
echo ""
echo "Manual backup: ~/backup-db.sh"
echo "View backups: ls -lh ~/backups/"
echo "View backup log: tail -f ~/backups/backup.log"
echo ""
echo "=== DEPLOYMENT COMPLETE! ==="
echo ""
echo "Your application is now deployed and running!"
echo ""
echo "Final checklist:"
echo "  ✓ Database configured"
echo "  ✓ Application deployed"
echo "  ✓ Services running"
echo "  ✓ SSL certificates installed"
echo "  ✓ Firewall enabled"
echo "  ✓ Backups configured"
echo ""
echo "Access your site:"
echo "  - Frontend: https://yourdomain.com"
echo "  - API: https://api.yourdomain.com"
echo ""
echo "Useful commands:"
echo "  - Check backend: sudo systemctl status patreon-backend"
echo "  - View logs: sudo journalctl -u patreon-backend -f"
echo "  - Manual backup: ~/backup-db.sh"
echo ""
