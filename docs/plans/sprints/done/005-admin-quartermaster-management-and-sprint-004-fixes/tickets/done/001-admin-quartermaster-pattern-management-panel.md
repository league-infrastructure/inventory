---
id: '001'
title: Admin Quartermaster pattern management panel
status: done
use-cases:
- SUC-001
depends-on: []
---

# Admin Quartermaster pattern management panel

## Description

Add admin API endpoints for Quartermaster pattern CRUD under requireAdmin
middleware, and create a "Permissions" panel in the admin dashboard frontend
for managing which email addresses get Quartermaster role.

## Acceptance Criteria

- [x] `GET /api/admin/quartermasters` returns all patterns (requireAdmin)
- [x] `POST /api/admin/quartermasters` adds a pattern with regex validation and duplicate check (requireAdmin)
- [x] `DELETE /api/admin/quartermasters/:id` removes a pattern (requireAdmin)
- [x] Admin dashboard nav includes "Permissions" link
- [x] Permissions panel lists all patterns with pattern text, type (Exact/Regex), and delete button
- [x] Add form with text input and regex checkbox
- [x] Invalid regex shows error message
- [x] Duplicate pattern shows error message
- [x] App.tsx has route `/admin/permissions` pointing to PermissionsPanel

## Testing

- **Existing tests to run**: `cd server && npx tsc --noEmit` and `cd client && npx tsc --noEmit`
- **New tests to write**: None (manual verification via admin dashboard)
- **Verification command**: `npx tsc --noEmit` in both server and client
