---
id: "023"
title: "S3 Object Storage for Images"
status: active
branch: sprint/023-s3-object-storage-for-images
use-cases: []
---

# Sprint 023: S3 Object Storage for Images

## Goals

Move image binary storage from PostgreSQL bytea columns to DigitalOcean
Spaces (S3-compatible object storage). Keep the Image table for metadata
and references. Reduce database size and improve image serving performance.

## Problem

Images are currently stored as bytea in PostgreSQL. This bloats the
database, slows backups, and makes image serving less efficient than a
dedicated object store.

## Solution

Use DigitalOcean Spaces (S3-compatible) to store processed image files.
The Image model keeps metadata (dimensions, checksum, mime type) and gains
an `objectKey` field pointing to the Spaces object. The `data` column
becomes unused for new uploads. URL-based images remain unchanged.

## Success Criteria

- New image uploads go to Spaces, not to the database
- `GET /api/images/:id` serves images from Spaces (redirect or proxy)
- URL-based images continue to work unchanged
- Credentials are in `.env.template` and `.env`
- Existing bytea images migrated to Spaces via one-time script
- Server tests pass

## Scope

### In Scope

1. Add `@aws-sdk/client-s3` dependency
2. Create S3/Spaces client configuration
3. Update `ImageService.create()` to upload to Spaces
4. Add `objectKey` field to Image model
5. Update `GET /api/images/:id` to redirect to Spaces URL
6. Update `DELETE /api/images/:id` to delete from Spaces
7. Add credentials to `.env.template` and `.env`
8. Migration script for existing bytea images
9. Server tests for the updated image service

### Out of Scope

- CDN configuration in front of Spaces
- Image transformations on-the-fly (already done at upload time)
- Encrypting secrets to `secrets/*` with SOPS (done later)

## Test Strategy

- Unit tests for S3 upload/delete/serve flow
- Manual verification of image upload and display in browser
- Verify migration script moves existing images

## Architecture Notes

- Endpoint: `https://jtl-inventory.sfo3.digitaloceanspaces.com`
- Region: `sfo3`
- Bucket name: `jtl-inventory`
- Object keys: `images/<checksum>.webp` (dedup by content hash)
- Public read access on the bucket (images served via redirect)
- Credentials: `DO_SPACES_KEY`, `DO_SPACES_SECRET`

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

1. **001** — Add S3 client, schema migration, and environment config
2. **002** — Update ImageService and routes for S3 storage
3. **003** — Migration script for existing bytea images
