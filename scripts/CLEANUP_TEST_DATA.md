# Cleanup Test Data

Commands to delete test posts and thumbnails from production.

## Delete Test Posts from Database

```bash
# SSH to server
ssh deploy@45.33.94.21

# Delete the 3 test posts
sudo -u postgres psql -d vamasubmissions -c "DELETE FROM posts WHERE post_id IN ('148930513', '148929179', '148928325');"

# Verify they're gone
sudo -u postgres psql -d vamasubmissions -c "SELECT COUNT(*) FROM posts WHERE post_id IN ('148930513', '148929179', '148928325');"
# Should return: 0
```

## Delete Test Thumbnails from Server

```bash
# SSH to server (if not already connected)
ssh deploy@45.33.94.21

# Delete thumbnails for these 3 posts
cd ~/vamasubmissions/backend/static/thumbnails/
rm -v 148930513-t-*.png 148929179-t-*.png 148928325-t-*.png

# Count remaining test thumbnails
ls -1 148930513-t-*.png 148929179-t-*.png 148928325-t-*.png 2>&1 | wc -l
# Should return: 0 (or error message if none found)
```

## Delete Local Session Directory

```bash
# On your local machine
rm -rf ~/.vamasubmissions_import/import_*

# Verify cleanup
ls -la ~/.vamasubmissions_import/
# Should be empty or not exist
```

## All-in-One Cleanup Command

```bash
# SSH to server and run all cleanup commands
ssh deploy@45.33.94.21 << 'EOF'
echo "=== Deleting test posts from database ==="
sudo -u postgres psql -d vamasubmissions -c "DELETE FROM posts WHERE post_id IN ('148930513', '148929179', '148928325');"

echo ""
echo "=== Deleting test thumbnails ==="
cd ~/vamasubmissions/backend/static/thumbnails/
rm -v 148930513-t-*.png 148929179-t-*.png 148928325-t-*.png 2>&1 | head -10

echo ""
echo "=== Verification ==="
echo "Test posts remaining in database:"
sudo -u postgres psql -d vamasubmissions -t -c "SELECT COUNT(*) FROM posts WHERE post_id IN ('148930513', '148929179', '148928325');"

echo "Test thumbnails remaining:"
ls -1 148930513-t-*.png 148929179-t-*.png 148928325-t-*.png 2>&1 | wc -l
EOF

# Clean up local session directory
rm -rf ~/.vamasubmissions_import/import_*
echo "Local session directory cleaned"
```

## Verify Cleanup

```bash
# Check database
ssh deploy@45.33.94.21 "sudo -u postgres psql -d vamasubmissions -c \"SELECT post_id, title FROM posts WHERE post_id IN ('148930513', '148929179', '148928325');\""
# Should return: (0 rows)

# Check thumbnails
ssh deploy@45.33.94.21 "ls ~/vamasubmissions/backend/static/thumbnails/148930513-t-*.png 2>&1"
# Should return: No such file or directory

# Check local
ls ~/.vamasubmissions_import/ 2>&1
# Should return: No such file or directory
```

## Notes

- The `DELETE` command will cascade to related tables (post_edits, edit_history) due to foreign key constraints
- Thumbnails must be deleted separately (they're just files on disk)
- Local session directory can be safely deleted anytime
- After cleanup, you can re-run the import script to test again
