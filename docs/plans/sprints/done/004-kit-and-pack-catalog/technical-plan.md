---
status: complete
from-architecture-version: "003"
to-architecture-version: "004"
---

# Sprint 004 Technical Plan

## Architecture Version

- **From version**: 003 (core schema, auth, sites)
- **To version**: 004 (Kit/Pack/Item CRUD, QR codes, clone)

## Architecture Overview

This sprint adds CRUD routes and frontend pages for the three core
inventory objects: Kit, Pack, and Item. These models already exist in
the Prisma schema from Sprint 003. The sprint adds:

1. **Backend API routes** for Kit, Pack, and Item CRUD.
2. **QR code generation** using the `qrcode` npm package — URL-only
   storage (no image blobs in the database).
3. **Clone Kit** endpoint that duplicates the Kit → Pack → Item hierarchy.
4. **Frontend pages** for Kit list, Kit detail (with Pack/Item hierarchy),
   and create/edit forms.
5. **QR code routing** — public-facing routes (`/k/:id`, `/p/:id`) that
   resolve to detail pages or a login prompt.

## Component Design

### Component: Kit API (`server/src/routes/kits.ts`)

**Use Cases**: SUC-001, SUC-004, SUC-005

- `GET /api/kits` — list all active Kits with their Site name
- `GET /api/kits/:id` — Kit detail including Packs, Items, and Computers
- `POST /api/kits` — create Kit, generate QR code
- `PUT /api/kits/:id` — update Kit fields
- `PATCH /api/kits/:id/retire` — set status to RETIRED
- `POST /api/kits/:id/clone` — clone Kit with Packs and Items

All mutating endpoints require QUARTERMASTER role. Read endpoints
require any authenticated user.

QR code format: `/k/{id}` — stored in the `qrCode` field on creation.

### Component: Pack API (`server/src/routes/packs.ts`)

**Use Cases**: SUC-002, SUC-004

- `GET /api/kits/:kitId/packs` — list Packs in a Kit
- `GET /api/packs/:id` — Pack detail with Items
- `POST /api/kits/:kitId/packs` — create Pack in a Kit, generate QR code
- `PUT /api/packs/:id` — update Pack fields
- `DELETE /api/packs/:id` — delete Pack (cascades Items)

QR code format: `/p/{id}`.

### Component: Item API (`server/src/routes/items.ts`)

**Use Cases**: SUC-003, SUC-004

- `GET /api/packs/:packId/items` — list Items in a Pack
- `POST /api/packs/:packId/items` — add Item to Pack
- `PUT /api/items/:id` — update Item fields
- `DELETE /api/items/:id` — remove Item

### Component: QR Code Service (`server/src/services/qrCode.ts`)

**Use Cases**: SUC-006

- `generateQrCode(path: string): Promise<string>` — generates a QR code
  data URL (PNG base64) for the given path.
- The QR code encodes the full URL: `{APP_BASE_URL}{path}`.
- Used by Kit and Pack creation endpoints.

### Component: Frontend Kit Pages (`client/src/pages/kits/`)

**Use Cases**: SUC-001 through SUC-006

- `KitList.tsx` — table of all Kits with status, site, and link to detail
- `KitDetail.tsx` — shows Kit info, Packs accordion, Items within each
  Pack, QR code display, Clone button
- `KitForm.tsx` — create/edit form for Kit (name, description, site select)
- `PackForm.tsx` — create/edit form for Pack
- `ItemForm.tsx` — create/edit form for Item
- `QrLanding.tsx` — public page shown when QR code scanned by unauthenticated user

### Component: QR Code Routes (Frontend)

**Use Cases**: SUC-006

- `/k/:id` — redirects to `/kits/:id` if authenticated, shows QrLanding if not
- `/p/:id` — redirects to `/packs/:id` if authenticated, shows QrLanding if not

## Open Questions

None — the Prisma schema already defines Kit, Pack, and Item models
with the required fields and relationships.
