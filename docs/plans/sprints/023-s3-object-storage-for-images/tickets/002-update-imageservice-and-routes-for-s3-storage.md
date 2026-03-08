---
id: "002"
title: "Update ImageService and routes for S3 storage"
status: done
use-cases: [SUC-001, SUC-002, SUC-003]
depends-on: ["001"]
---

# Update ImageService and routes for S3 storage

## Description

Update `ImageService.create()` to upload processed images to Spaces
instead of storing in the database. Update `getData()` to return the
Spaces URL. Update routes to redirect for S3-backed images and delete
S3 objects on image removal.

## Acceptance Criteria

- [x] `create()` uploads to S3 and stores `objectKey` (no `data` in DB)
- [x] `delete()` removes S3 object before deleting DB record
- [x] `GET /api/images/:id` redirects to Spaces URL for S3 images
- [x] `GET /api/images/:id` still serves bytea for legacy images
- [x] `GET /api/images/:id` still redirects for URL-based images
- [x] Photos display correctly in the UI after upload
- [x] Server compiles and tests pass

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: None (manual verification of upload/serve flow)
- **Verification command**: `cd server && npx tsc --noEmit`
