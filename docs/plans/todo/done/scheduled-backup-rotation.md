---
status: pending
---

# Scheduled Backup Rotation (Daily + Weekly)

Implement automated database backups on a daily and weekly schedule with
retention policies.

## Daily Backups

- Run once per day automatically.
- Retain the last 6 daily backups.
- Filename includes both the date and day-of-week number so they sort
  chronologically. When creating a new daily backup, delete any existing
  backup with the same day-of-week number.
- Example naming: `daily-1-2026-03-10.sql.gz` (day 1 = Monday, includes
  full date for sort order).

## Weekly Backups

- Run once per week automatically, using the tick based scheduler. 
- Retain the last 4 weekly backups.
- Filename includes the date for chronological sorting.
- Delete the oldest when a 5th would be created.

## Manual Backups

- Backups created by clicking the backup button in the admin UI are never
  automatically deleted. They are retained indefinitely.

## Open Questions

- **Scheduling mechanism:** Use the /api/scheduler/tick system. 
- **Storage location:** Same S3 bucket as images, or separate? Local
  filesystem inside the container (risky if container restarts)? ( Yes, used S3)
