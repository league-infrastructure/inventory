---
id: '005'
title: Site CRUD with audit logging
status: done
use-cases:
- UC-4.7
depends-on:
- '001'
- '004'
---

# Site CRUD with audit logging

## Description

Implement the Site management API and frontend. Sites are managed by
Quartermasters. Every create, update, and deactivate operation writes an
entry to the AuditLog table. This is the first use of the audit log pattern
and establishes the reusable `writeAuditLog` service function.

## Acceptance Criteria

- [ ] `POST /api/sites` — create a Site (name, address, latitude, longitude, isHomeSite). Quartermaster only.
- [ ] `GET /api/sites` — list all active Sites. Any authenticated user.
- [ ] `GET /api/sites/:id` — get Site detail. Any authenticated user.
- [ ] `PUT /api/sites/:id` — update Site fields. Quartermaster only.
- [ ] `PATCH /api/sites/:id/deactivate` — soft-delete (set isActive=false). Quartermaster only.
- [ ] All write operations create AuditLog entries with: userId, objectType='Site', objectId, changed fields, old/new values, source='UI'
- [ ] `writeAuditLog` is a reusable service function that other tickets can import
- [ ] Frontend: Site list page showing all active Sites
- [ ] Frontend: Site create/edit form (Quartermaster only, hidden for Instructors)
- [ ] Frontend: Site deactivate button with confirmation
- [ ] Validation: name is required, latitude/longitude are valid numbers if provided

## Testing

- **Existing tests to run**: `cd server && npm test`
- **New tests to write**: Site CRUD endpoints (create, read, update, deactivate), audit log writes (verify entries are created with correct field diffs), authorization (instructor cannot create/edit sites)
- **Verification command**: `cd server && npm test`
