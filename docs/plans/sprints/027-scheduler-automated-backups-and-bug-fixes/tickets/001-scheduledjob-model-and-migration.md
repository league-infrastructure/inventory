---
id: "001"
title: "ScheduledJob Model and Migration"
status: todo
use-cases: [SUC-001, SUC-003]
depends-on: []
---

# ScheduledJob Model and Migration

## Description

Add the `ScheduledJob` Prisma model and create a migration that also seeds
the two initial jobs: `daily-backup` and `weekly-backup`.

### Schema

```prisma
model ScheduledJob {
  id          Int       @id @default(autoincrement())
  name        String    @unique
  description String?
  frequency   String    // "daily", "weekly"
  lastRunAt   DateTime?
  nextRunAt   DateTime
  lastError   String?
  enabled     Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### Seed Data

- `daily-backup`: frequency "daily", nextRunAt set to tomorrow 2:00 AM UTC,
  description "Automated daily database backup with dow-based rotation"
- `weekly-backup`: frequency "weekly", nextRunAt set to next Sunday 3:00 AM
  UTC, description "Automated weekly database backup with 4-week retention"

## Acceptance Criteria

- [ ] ScheduledJob model added to `server/prisma/schema.prisma`
- [ ] Migration created and applies cleanly
- [ ] Migration seeds daily-backup and weekly-backup job records
- [ ] `npx prisma generate` succeeds

## Testing

- **Existing tests to run**: `npm run test:db` (verify migration applies)
- **New tests to write**: Verify ScheduledJob table exists and seed data
  is present after migration
- **Verification command**: `npm run test:db`
