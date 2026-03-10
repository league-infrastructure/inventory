---
id: "007"
title: "Admin Scheduled Jobs Panel"
status: done
use-cases: [SUC-001]
depends-on: ["002"]
---

# Admin Scheduled Jobs Panel

## Description

Add an admin page to view and manage scheduled jobs. Shows job status, last
run, next run, errors, and provides controls to enable/disable and trigger
manual runs.

### Frontend (`client/src/pages/admin/ScheduledJobsPanel.tsx`)

- Table columns: Name, Description, Frequency, Last Run, Next Run, Last
  Error, Enabled, Actions.
- Last Error: displayed in red if non-null, truncated with tooltip for
  full text.
- Enabled: toggle switch that calls `PUT /api/admin/scheduler/jobs/:id`.
- Actions: "Run Now" button that calls
  `POST /api/admin/scheduler/jobs/:id/run`.
- Auto-refresh data every 30 seconds.

### Admin sidebar

Add "Scheduled Jobs" link to the admin sidebar navigation in
`client/src/pages/admin/AdminLayout.tsx`.

### Admin route wiring

The scheduler admin routes (list, update, run) were added in ticket 002
under `/api/scheduler/jobs`. These need `requireAdmin` middleware. The
frontend calls these endpoints.

## Acceptance Criteria

- [x] ScheduledJobsPanel page created and renders job table
- [x] Shows all fields: name, description, frequency, timestamps, error
- [x] Errors highlighted in red
- [x] Toggle enabled/disabled works via API
- [x] "Run Now" button triggers job execution via API
- [x] Page linked from admin sidebar
- [x] Data auto-refreshes

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Component renders with mock data, toggle and
  run buttons fire correct API calls
- **Verification command**: `npm run test:client`
