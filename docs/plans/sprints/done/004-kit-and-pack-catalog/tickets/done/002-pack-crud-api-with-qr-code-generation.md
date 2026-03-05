---
id: "002"
title: "Pack CRUD API with QR code generation"
status: done
use-cases:
  - SUC-002
  - SUC-004
depends-on:
  - "001"
---

# Pack CRUD API with QR code generation

## Description

Create Pack CRUD API routes. Packs belong to a Kit and contain Items.
Each Pack gets a QR code URL (`/p/{id}`) on creation.

## Acceptance Criteria

- [x] `GET /api/kits/:kitId/packs` returns all Packs in a Kit, requires auth
- [x] `GET /api/packs/:id` returns Pack detail with Items, requires auth
- [x] `POST /api/kits/:kitId/packs` creates a Pack with name and description, generates QR code; requires Quartermaster
- [x] `PUT /api/packs/:id` updates Pack fields; requires Quartermaster
- [x] `DELETE /api/packs/:id` deletes Pack (cascades Items); requires Quartermaster
- [x] QR code stored as `/p/{id}` in the `qrCode` field
- [x] All mutations write to the audit log
- [x] Validation: name is required; kitId must reference an existing Kit
- [x] Returns 404 if Kit or Pack not found

## Testing

- **Existing tests to run**: `cd server && npx tsc --noEmit`
- **New tests to write**: API tests for Pack CRUD, cascade delete verification
- **Verification command**: `cd server && npx tsc --noEmit`
