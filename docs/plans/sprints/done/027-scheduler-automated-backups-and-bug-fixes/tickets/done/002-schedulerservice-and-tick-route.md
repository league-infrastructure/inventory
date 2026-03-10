---
id: "002"
title: "SchedulerService and Tick Route"
status: done
use-cases: [SUC-001]
depends-on: ["001"]
---

# SchedulerService and Tick Route

## Description

Create the SchedulerService that implements tick logic and the route that
exposes it.

### SchedulerService (`server/src/services/scheduler.service.ts`)

- `tick()`: Find jobs where `nextRunAt <= NOW()` and `enabled = true`.
  For each, attempt `SELECT ... FOR UPDATE SKIP LOCKED` in a transaction.
  If locked, execute the registered handler. On success, update `lastRunAt`,
  compute `nextRunAt`, clear `lastError`. On failure, write error to
  `lastError` and log via Pino. Always advance `nextRunAt`.
- `listJobs()`: Return all ScheduledJob records.
- `updateJob(id, { enabled })`: Toggle enabled state.
- `runJobNow(id)`: Execute a specific job immediately.
- Job dispatch map: `{ 'daily-backup': handler, 'weekly-backup': handler }`.
  Initially stubs until ticket 004 wires BackupRotationService.

### Next Run Computation

- `daily`: add 24h to `nextRunAt` (or set to tomorrow same time if behind)
- `weekly`: add 7 days to `nextRunAt`

### Scheduler Route (`server/src/routes/scheduler.ts`)

- `GET /api/scheduler/tick` — calls `tick()`, returns `{ executed: N }`.
- `GET /api/scheduler/jobs` — calls `listJobs()` (for admin panel).
- `PUT /api/scheduler/jobs/:id` — calls `updateJob()` (toggle enabled).
- `POST /api/scheduler/jobs/:id/run` — calls `runJobNow()`.
- Admin routes require `requireAdmin`; tick requires no auth.
- Register in `app.ts`.

### Wiring

Standalone — not in ServiceRegistry. Instantiated by the route module.

## Acceptance Criteria

- [x] SchedulerService created with tick(), listJobs(), updateJob(), runJobNow()
- [x] tick() uses FOR UPDATE SKIP LOCKED — concurrent calls skip locked jobs
- [x] Job errors captured in lastError and logged via Pino
- [x] nextRunAt always advances after execution (success or failure)
- [x] Route GET /api/scheduler/tick returns { executed: N }, no auth
- [x] Admin routes for list/update/run require requireAdmin
- [x] Routes registered in app.ts

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: tick() with due/not-due jobs, error capture,
  nextRunAt advancement, route response
- **Verification command**: `npm run test:server`
