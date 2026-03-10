---
status: pending
---

# Internal Job Scheduler System

A lightweight job scheduling system to trigger periodic tasks (starting with
the scheduled backup rotation). Related to the scheduled-backup-rotation TODO.

## Architecture

### Tick Route: `GET /api/scheduler/tick`

- Does not need authentication (returns no sensitive data).
- On each call, queries the `ScheduledJob` table for any jobs past due.
- Runs due jobs, then returns the count of jobs executed (just a number).
- Can be called externally (e.g., cron, monitoring) or internally.

### ScheduledJob Table

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| name | string | Unique job identifier (e.g., `daily-backup`, `weekly-backup`) |
| frequency | string/interval | How often the job runs |
| lastRunAt | datetime | When the job last ran |
| nextRunAt | datetime | When the job should next run |
| lastError | text (nullable) | Error output from the most recent run (for diagnostics) |
| enabled | boolean | Whether the job is active |

### Row-Level Locking

When the tick runs, it uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim a
job row. If another process already holds the lock (e.g., a concurrent tick),
that job is skipped — no contention, no waiting. After the job completes,
update `lastRunAt`, compute `nextRunAt`, and clear or set `lastError`.

### Error Handling

- Job errors are logged via the normal application logger (Pino).
- The error message is also written to the `lastError` field on the job
  record so failures are visible in the admin UI without checking logs.

### Internal Trigger: Request-Piggyback Timer

The primary trigger mechanism piggybacks on incoming HTTP requests to keep
it computationally cheap:

- A shared in-memory variable stores `nextTickTime` (a timestamp).
- On each incoming request (via middleware), check: is `Date.now() >=
  nextTickTime`?
- If yes: reset `nextTickTime` to `now + interval` (e.g., 5 minutes),
  then fire an async internal HTTP request to `/api/scheduler/tick`
  (fire-and-forget, don't block the user's request).
- If no: do nothing (just a single timestamp comparison — very cheap).
- The interval is configurable (1–5 minutes, TBD).

This means the tick is not called on a precise clock — it's called
"roughly every N minutes, as long as the app is receiving traffic." For
backup scheduling with hour-level granularity, this is plenty accurate.

### External Trigger (Optional)

The tick route can also be called from outside (cron job, uptime monitor,
etc.) for environments where guaranteed timing matters or as a belt-and-
suspenders approach alongside the internal trigger.
