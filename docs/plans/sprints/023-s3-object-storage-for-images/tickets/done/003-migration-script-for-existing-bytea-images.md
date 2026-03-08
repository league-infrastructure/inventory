---
id: "003"
title: "Migration script for existing bytea images"
status: done
use-cases: [SUC-004]
depends-on: ["001", "002"]
---

# Migration script for existing bytea images

## Description

Create a one-time script to migrate existing bytea images from the
database to DigitalOcean Spaces. For each image with `data` but no
`objectKey`: upload to S3, set `objectKey`, clear `data`.

## Acceptance Criteria

- [x] Script at `server/src/scripts/migrate-images-to-s3.ts`
- [x] Processes all images where data IS NOT NULL AND objectKey IS NULL
- [x] Uploads each image to S3 with key `images/<checksum>.webp`
- [x] Updates Image record: sets objectKey, nulls data
- [x] Handles errors gracefully (logs and continues)
- [x] Images display correctly after migration

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: None (one-time script, manual verification)
- **Verification command**: Manual run against dev database
