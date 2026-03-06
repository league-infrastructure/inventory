---
id: '001'
title: ApiToken Prisma model and AuditSource enum
status: done
use-cases:
- SUC-001
- SUC-005
depends-on: []
---

# ApiToken Prisma model and AuditSource enum

## Description

Add the database foundation for token authentication and MCP audit
tracking. This includes the `ApiToken` Prisma model for storing hashed
personal API tokens and adding `MCP` to the `AuditSource` enum.

### ApiToken model

Add to `server/prisma/schema.prisma`:

```prisma
model ApiToken {
  id          Int        @id @default(autoincrement())
  label       String
  tokenHash   String     @unique
  prefix      String     // First 8 chars for display
  userId      Int
  role        UserRole   // Snapshot of user's role at creation
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  expiresAt   DateTime?  // Optional expiration
  createdAt   DateTime   @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Update the `User` model to add the `apiTokens ApiToken[]` relation field.

### AuditSource enum

Add `MCP` to the existing `AuditSource` enum in the Prisma schema.

### Migration

Generate and apply the Prisma migration for both changes.

## Acceptance Criteria

- [ ] `ApiToken` model exists in Prisma schema with all specified fields
- [ ] `User` model has `apiTokens` relation field
- [ ] `AuditSource` enum includes `MCP` value
- [ ] Migration generates and applies cleanly
- [ ] Prisma client generates without errors
- [ ] Existing tests still pass

## Testing

- **Existing tests to run**: `npm run test:server`, `npm run test:db`
- **New tests to write**: Database-level test verifying ApiToken CRUD,
  cascade delete on user removal, unique constraint on tokenHash
- **Verification command**: `npx prisma migrate dev`
