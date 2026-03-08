---
status: approved
---

# Sprint 023 Technical Plan

## Architecture Version

- **From version**: no change (infrastructure sprint)
- **To version**: no change

## Architecture Overview

The existing `ImageService` processes uploads (resize, WebP conversion)
and stores the binary in the `Image.data` bytea column. This sprint
replaces bytea storage with DigitalOcean Spaces (S3-compatible). The
processing pipeline stays the same — only the storage backend changes.

```
Upload flow:
  multer → sharp (resize/webp) → S3 PutObject → Image record (objectKey)

Serve flow:
  GET /api/images/:id → lookup Image → redirect to Spaces URL

Delete flow:
  DELETE /api/images/:id → S3 DeleteObject → delete Image record
```

## Component Design

### 1. S3 Client Configuration

New file: `server/src/services/s3.ts`

- Export a configured `S3Client` from `@aws-sdk/client-s3`
- Read config from env: `DO_SPACES_KEY`, `DO_SPACES_SECRET`,
  `DO_SPACES_ENDPOINT`, `DO_SPACES_BUCKET`, `DO_SPACES_REGION`
- Export helper constants: bucket name, public base URL

### 2. ImageService Updates

File: `server/src/services/image.service.ts`

- `create(buffer)`: after sharp processing, upload to S3 with key
  `images/<sha256>.webp`. Store `objectKey` in Image record instead of
  `data`. If an object with the same key exists (dedup), skip upload.
- `delete(id)`: delete S3 object before deleting DB record.
- `getData(id)`: return redirect URL instead of binary data.
- Keep `createFromUrl()` unchanged (no binary involved).

### 3. Prisma Schema Changes

File: `server/prisma/schema.prisma`

- Add `objectKey String?` to `Image` model
- Keep `data Bytes?` for backward compat during migration

### 4. Image Route Updates

File: `server/src/routes/images.ts`

- `GET /api/images/:id`: for S3-backed images, 302 redirect to
  `https://jtl-inventory.sfo3.digitaloceanspaces.com/<objectKey>`.
  For legacy bytea images (during migration window), serve binary.
  For URL images, redirect as before.

### 5. Environment Configuration

Files: `.env.template`, `.env`

Add:
```
DO_SPACES_KEY=<access-key>
DO_SPACES_SECRET=<secret-key>
DO_SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com
DO_SPACES_BUCKET=jtl-inventory
DO_SPACES_REGION=sfo3
```

### 6. Migration Script

New file: `server/src/scripts/migrate-images-to-s3.ts`

- Query all Image records where `data IS NOT NULL AND objectKey IS NULL`
- For each: upload `data` to S3, set `objectKey`, null out `data`
- Run via `npx ts-node server/src/scripts/migrate-images-to-s3.ts`

## Decisions

1. **Public read access** on the Spaces bucket. Images are equipment
   photos with no sensitivity. Server redirects to the public Spaces URL.
