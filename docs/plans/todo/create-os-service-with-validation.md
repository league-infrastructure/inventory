---
status: pending
---

# Create OsService with proper validation

Operating system CRUD is currently handled inline in `server/src/mcp/tools.ts`
with direct Prisma calls. This violates the service layer architecture
rule and means there is no duplicate-name check before `create`.

## Problem

- `create_operating_system` with a duplicate name exposes a raw Prisma
  error (see issue 001).
- OS operations bypass the service layer, unlike every other entity.

## Proposed fix

Create `server/src/services/os.service.ts` with:

- `create()` — check for existing name before insert
- `update()` — check for name conflicts
- `delete()` — standard delete
- `list()` — list all operating systems

Update `tools.ts` to call `OsService` instead of using Prisma directly.
This also fixes issue 001 for operating systems.
