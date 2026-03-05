---
id: '001'
title: Kit CRUD API with QR code generation
status: done
use-cases:
- SUC-001
- SUC-004
depends-on: []
---

# Kit CRUD API with QR code generation

## Description

Create the Kit CRUD API routes and the QR code generation service. Kits are
the top-level inventory object assigned to a Site. Each Kit gets a QR code
URL (`/k/{id}`) on creation. Install the `qrcode` npm package for server-side
QR code generation.

## Acceptance Criteria

- [x] `GET /api/kits` returns all Kits (with site name) ordered by name, requires auth
- [x] `GET /api/kits/:id` returns Kit detail with nested Packs, Items, and Computers, requires auth
- [x] `POST /api/kits` creates a Kit with name, description, siteId; generates QR code; requires Quartermaster
- [x] `PUT /api/kits/:id` updates Kit fields (name, description, siteId); requires Quartermaster
- [x] `PATCH /api/kits/:id/retire` sets Kit status to RETIRED; requires Quartermaster
- [x] QR code service (`server/src/services/qrCode.ts`) generates a QR code data URL for a given path
- [x] QR code is stored in the `qrCode` field as the URL path (e.g., `/k/42`)
- [x] All mutations write to the audit log using the existing `writeAuditLog`/`diffForAudit` helpers
- [x] Validation: name is required and non-empty; siteId must reference an existing active Site
- [x] Kit list endpoint supports optional `?status=` filter (ACTIVE, RETIRED)

## Testing

- **Existing tests to run**: `cd server && npx tsc --noEmit`
- **New tests to write**: API tests for each endpoint, validation errors, audit log creation
- **Verification command**: `cd server && npx tsc --noEmit`
