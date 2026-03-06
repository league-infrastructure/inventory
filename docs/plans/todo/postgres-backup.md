---
status: todo
---
# Postgres backup and restore

## Summary

Add database backup and restore capabilities using `pg_dump`, with
admin UI controls.

1. **Shared volume** — add a volume in docker-compose mounted by both
   the `db` and `server` services.
   - Dev: host-mounted directory.
   - Prod: named Docker volume.
2. **BACKUP_PATH env var** — add to dev and prod secrets, pointing to
   the backup mount.
3. **Backup service** — implement backup using `pg_dump` writing to the
   shared volume.
4. **Admin UI** — add backup management to the admin interface (trigger
   backup, list backups, restore from backup).
