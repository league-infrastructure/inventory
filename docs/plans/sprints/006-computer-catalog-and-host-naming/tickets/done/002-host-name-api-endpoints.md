---
id: '002'
title: Host Name API endpoints
status: todo
use-cases:
- SUC-004
depends-on: []
---

# Host Name API endpoints

## Description

Create `server/src/routes/hostnames.ts` with endpoints for listing all
host names (with assignment status), adding new names to the pool, and
deleting unassigned names. Register in `app.ts`.

## Acceptance Criteria

- [ ] `GET /api/hostnames` returns all host names with `computer` include (to show assignment)
- [ ] `POST /api/hostnames` adds a new host name; rejects duplicates
- [ ] `DELETE /api/hostnames/:id` deletes an unassigned host name; rejects if assigned to a computer
- [ ] Read endpoint uses `requireAuth`, write endpoints use `requireQuartermaster`
- [ ] Router is registered in `app.ts`

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: `tests/server/hostnames.test.ts` using Jest + Supertest:
  - `GET /api/hostnames` returns 200 with array of host names
  - `GET /api/hostnames` includes computer relation for assigned names
  - `POST /api/hostnames` creates a new host name and returns 201
  - `POST /api/hostnames` returns 409 for duplicate name
  - `POST /api/hostnames` returns 400 for empty name
  - `DELETE /api/hostnames/:id` deletes an unassigned host name and returns 200
  - `DELETE /api/hostnames/:id` returns 400/409 when host name is assigned to a computer
  - `DELETE /api/hostnames/:id` returns 404 for nonexistent ID
- **Verification command**: `npm run test:server`
