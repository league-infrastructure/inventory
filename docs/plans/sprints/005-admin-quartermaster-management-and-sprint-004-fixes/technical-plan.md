---
status: complete
from-architecture-version: "004"
to-architecture-version: "005"
---

# Sprint 005 Technical Plan

## Architecture Version

- **From version**: 004 (Kit/Pack/Item CRUD, QR codes)
- **To version**: 005 (admin Quartermaster management)

## Architecture Overview

Adds a new admin route file and frontend panel for managing
QuartermasterPattern records. Uses the existing admin authentication
(fixed password) and admin layout infrastructure.

## Component Design

### Component: Admin Quartermaster Routes (`server/src/routes/admin/quartermasters.ts`)

**Use Cases**: SUC-001

- `GET /api/admin/quartermasters` — list all patterns
- `POST /api/admin/quartermasters` — add a pattern (validates regex, rejects duplicates)
- `DELETE /api/admin/quartermasters/:id` — delete a pattern

All endpoints use `requireAdmin` middleware. Reuses the existing
`QuartermasterPattern` Prisma model.

### Component: Admin Permissions Panel (`client/src/pages/admin/PermissionsPanel.tsx`)

**Use Cases**: SUC-001

- Lists current patterns in a table (pattern, type, delete button)
- Add form with text input and regex checkbox
- Shows validation errors from the API

### Component: Admin Layout Update

- Add "Permissions" to NAV_ITEMS in AdminLayout.tsx
- Add route in App.tsx: `/admin/permissions`

## Open Questions

None.
