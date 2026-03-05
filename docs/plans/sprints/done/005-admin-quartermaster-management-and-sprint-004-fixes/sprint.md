---
id: '005'
title: Admin Quartermaster Management and Sprint 004 Fixes
status: done
branch: sprint/005-admin-quartermaster-management-and-sprint-004-fixes
use-cases:
- UC-4.7
---

# Sprint 005: Admin Quartermaster Management and Sprint 004 Fixes

## Goals

Add a Quartermaster pattern management panel to the admin dashboard so
the system administrator can control which email addresses receive
Quartermaster privileges on login.

## Problem

The Quartermaster pattern API (`/api/quartermasters/patterns`) was built
in Sprint 003, but there is no UI to manage it. The only way to add
Quartermaster patterns is via direct API calls or database manipulation.
The admin dashboard — which already handles system configuration — is
the natural place for this.

The current Quartermaster pattern API routes use `requireQuartermaster`
middleware (Google OAuth role-based), but since this is a system
administration function (deciding *who* gets elevated permissions), it
belongs under the admin dashboard's fixed-password authentication
instead.

## Solution

1. Add admin-authenticated API endpoints for Quartermaster pattern CRUD
   under `/api/admin/quartermasters`.
2. Create an admin dashboard panel ("Permissions" or "Quartermasters")
   that lists current patterns, allows adding new ones (exact email or
   regex), and allows deleting them.
3. Move Quartermaster pattern management from the `requireQuartermaster`
   middleware to `requireAdmin` middleware.

## Success Criteria

- Admin can view all Quartermaster patterns in the admin dashboard.
- Admin can add a new pattern (exact email match or regex).
- Admin can delete an existing pattern.
- The existing Google OAuth login flow still checks these patterns to
  assign the QUARTERMASTER role on login.
- The admin dashboard nav includes a "Permissions" link.

## Scope

### In Scope

- Admin API endpoints for Quartermaster pattern CRUD
- Admin dashboard panel for pattern management
- Regex validation on add

### Out of Scope

- Changing the Google OAuth login flow (it already reads patterns)
- Role management beyond Quartermaster patterns
- User management UI (listing/editing individual users)

## Test Strategy

- TypeScript compilation check (`npx tsc --noEmit`) for server and client.
- Manual verification: admin can add/remove patterns via the dashboard.

## Architecture Notes

- Reuses the existing `QuartermasterPattern` Prisma model.
- The existing `/api/quartermasters/patterns` routes (requireQuartermaster)
  can be removed or kept as a secondary access path. The admin routes are
  the primary management interface.
- The admin dashboard already has auth, nav, and layout infrastructure —
  this sprint just adds one more panel.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
