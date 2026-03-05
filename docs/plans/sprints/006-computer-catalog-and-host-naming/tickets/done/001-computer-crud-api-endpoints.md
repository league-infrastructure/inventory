---
id: '001'
title: Computer CRUD API endpoints
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-003
- SUC-005
depends-on: []
---

# Computer CRUD API endpoints

## Description

Create `server/src/routes/computers.ts` with full CRUD for the Computer
model following the same patterns as `kits.ts`. Includes list with
filters, detail with includes, create with QR code generation, update
with audit diff, and disposition change endpoint. Register the router in
`app.ts`.

## Acceptance Criteria

- [ ] `GET /api/computers` lists computers with optional query filters: `disposition`, `siteId`, `kitId`, `unassigned=true`
- [ ] `GET /api/computers/:id` returns computer with `hostName`, `site`, `kit` includes
- [ ] `POST /api/computers` creates a computer, generates QR code (`/c/{id}`), writes audit log
- [ ] `POST /api/computers` optionally assigns a host name by `hostNameId`
- [ ] `POST /api/computers` optionally assigns to Kit (`kitId`) or Site (`siteId`)
- [ ] `PUT /api/computers/:id` updates computer, uses `diffForAudit()`, writes audit log
- [ ] `PUT /api/computers/:id` can change host name assignment (assign, reassign, unassign)
- [ ] `PUT /api/computers/:id` can change Kit/Site assignment
- [ ] `PATCH /api/computers/:id/disposition` changes disposition and writes audit log
- [ ] Read endpoints use `requireAuth`, write endpoints use `requireQuartermaster`
- [ ] Router is registered in `app.ts`

## Testing

- **Existing tests to run**: `npm run test:server` (all existing server tests must still pass)
- **New tests to write**: `tests/server/computers.test.ts` using Jest + Supertest:
  - `GET /api/computers` returns 200 with array
  - `GET /api/computers?disposition=ACTIVE` filters correctly
  - `GET /api/computers/:id` returns 200 with computer detail including hostName, site, kit
  - `GET /api/computers/:id` returns 404 for nonexistent ID
  - `POST /api/computers` creates a computer and returns 201 with QR code
  - `POST /api/computers` returns 400 for missing required fields
  - `POST /api/computers` with `hostNameId` assigns the host name
  - `PUT /api/computers/:id` updates fields and returns 200
  - `PUT /api/computers/:id` returns 404 for nonexistent ID
  - `PATCH /api/computers/:id/disposition` changes disposition
  - `PATCH /api/computers/:id/disposition` returns 400 for invalid disposition
- **Verification command**: `npm run test:server`
