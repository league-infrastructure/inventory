---
id: '005'
title: Update label QR codes to use /qr/ prefix
status: done
use-cases:
- SUC-024-001
depends-on: []
---

# Update label QR codes to use /qr/ prefix

## Description

Update the label generation service to encode `/qr/k/:id`, `/qr/p/:id`,
`/qr/c/:id` in QR codes instead of the current `/k/:id`, `/p/:id`,
`/c/:id`. Keep the old short-URL routes working for desktop users.

## Tasks

1. **Update LabelService** (`server/src/services/label.service.ts`):
   - Change QR path generation from `/k/${kitId}` to `/qr/k/${kitId}`.
   - Change `/p/${packId}` to `/qr/p/${packId}`.
   - Change `/c/${computerId}` to `/qr/c/${computerId}`.
   - Affects both PDF and HTML label methods.

2. **Verify existing short URLs still work**:
   - `/k/:id`, `/p/:id`, `/c/:id` routes in the React router remain
     unchanged — they redirect to desktop detail pages.

## Acceptance Criteria

- [ ] Newly generated QR codes encode `/qr/` prefix paths
- [ ] Existing `/k/:id`, `/p/:id`, `/c/:id` routes still work
- [ ] Both PDF and HTML label formats updated

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `cd server && npx tsc --noEmit`
