# Deployment Scripts

## Quick Start

To deploy the latest code to production:

```bash
ssh deploy@45.33.94.21
cd ~/vamasubmissions
bash deployment-scripts/deploy.sh
```

That's it! The script will:
1. Backup database
2. Pull latest code
3. Run all database migrations
4. Update dependencies
5. Rebuild frontend
6. Restart backend
7. Verify deployment

## Files

- **deploy.sh** - Main deployment script (run this)
- **vamasubmissions-backend.service** - Systemd service configuration
- **DEPLOY-PERFORMANCE-OPTIMIZATIONS.md** - Performance optimization notes

## Rollback

If deployment fails, rollback with:

```bash
cd ~/vamasubmissions
git reset --hard PREVIOUS_COMMIT_HASH
sudo -u postgres psql vamasubmissions < ~/vamasubmissions-backups/vamasubmissions-TIMESTAMP.sql
bash deployment-scripts/deploy.sh
```

## Logs

View backend logs:
```bash
sudo journalctl -u vamasubmissions-backend -f
```

Check service status:
```bash
sudo systemctl status vamasubmissions-backend
```
