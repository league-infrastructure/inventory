---
id: "001"
title: "Add S3 client, schema migration, and environment config"
status: done
use-cases: []
depends-on: []
---

# Add S3 client, schema migration, and environment config

## Description

Set up the foundation for S3 storage: install `@aws-sdk/client-s3`,
create the S3 client module, add `objectKey` to the Image schema,
and configure environment variables.

## Acceptance Criteria

- [x] `@aws-sdk/client-s3` installed in server
- [x] `server/src/services/s3.ts` exports configured S3Client and helpers
- [x] Prisma migration adds `objectKey String?` to Image model
- [x] `.env.template` has DO_SPACES_* variables
- [x] `.env` has DO_SPACES_* variables with real values
- [x] Server compiles cleanly

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: None (infrastructure setup)
- **Verification command**: `cd server && npx tsc --noEmit`
