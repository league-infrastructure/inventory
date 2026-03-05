---
id: '001'
title: AuditService and QrService classes
status: done
use-cases:
- SUC-003
depends-on: []
---

# AuditService and QrService classes

## Description

Extract the standalone `auditLog.ts` functions and merge `qrCode.ts` +
`qrService.ts` into proper classes. These two services have no
dependencies on other domain services, so they must be created first —
all other service classes will depend on AuditService.

### AuditService (`server/src/services/AuditService.ts`)

- Constructor receives `PrismaClient`
- `write(entries)` — wraps existing `writeAuditLog`
- `diff(userId, objectType, objectId, oldObj, newObj, fields, source)` —
  wraps existing `diffForAudit`

### QrService (`server/src/services/QrService.ts`)

- Constructor receives `PrismaClient` and optional `baseUrl`
- `generateDataUrl(path)` — from `qrCode.ts`
- `getKitQrInfo(id)` — from `qrService.ts`
- `getComputerQrInfo(id)` — from `qrService.ts`
- `getPackQrInfo(id)` — from `qrService.ts`

Do NOT delete the old files yet — they are still imported by existing
services. Deletion happens in ticket 005.

## Acceptance Criteria

- [ ] `AuditService` class created with `write()` and `diff()` methods
- [ ] `QrService` class created merging generation and entity lookup
- [ ] Both classes receive `PrismaClient` via constructor
- [ ] TypeScript compiles successfully
- [ ] Existing tests still pass (old files still present)

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification**: New class files exist and compile
