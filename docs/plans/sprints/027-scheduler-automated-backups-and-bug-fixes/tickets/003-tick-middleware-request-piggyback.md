---
id: "003"
title: "Tick Middleware (Request Piggyback)"
status: todo
use-cases: [SUC-002]
depends-on: ["002"]
---

# Tick Middleware (Request Piggyback)

## Description

Create middleware that piggybacks on incoming HTTP requests to trigger the
scheduler tick at configurable intervals.

### Implementation (`server/src/middleware/schedulerTick.ts`)

- Module-level `let nextTickTime = 0` (fires on first request).
- On each request: if `Date.now() >= nextTickTime`, reset timer to
  `Date.now() + TICK_INTERVAL_MS`, then fire
  `fetch(\`http://localhost:\${port}/api/scheduler/tick\`)` as
  fire-and-forget (no await, catch errors silently).
- Port read from `process.env.PORT || 3000`.
- `TICK_INTERVAL_MS` from `process.env.SCHEDULER_TICK_INTERVAL_MS`,
  default 300000 (5 minutes).
- Export as `schedulerTickMiddleware`.

### Registration

Mount in `app.ts` early in the middleware chain (after body parsing, before
routes). Only mount if `process.env.DISABLE_SCHEDULER_TICK !== 'true'`
(allows disabling in test environments).

## Acceptance Criteria

- [ ] Middleware created at `server/src/middleware/schedulerTick.ts`
- [ ] Fires tick when interval has elapsed
- [ ] Does not block or delay the original request
- [ ] Port is dynamic (reads process.env.PORT)
- [ ] Interval is configurable via SCHEDULER_TICK_INTERVAL_MS
- [ ] Can be disabled via DISABLE_SCHEDULER_TICK=true
- [ ] Mounted in app.ts

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Verify middleware fires after interval, doesn't
  fire before interval, doesn't block request
- **Verification command**: `npm run test:server`
