---
id: '006'
title: Cleanup and verification
status: done
use-cases:
  - SUC-002
  - SUC-004
depends-on:
  - '005'
---

# Cleanup and verification

## Description

Delete the old standalone service files that have been replaced by
classes, and verify the full codebase compiles and tests pass.

### Files to delete

- `server/src/services/siteService.ts`
- `server/src/services/hostNameService.ts`
- `server/src/services/computerService.ts`
- `server/src/services/kitService.ts`
- `server/src/services/packService.ts`
- `server/src/services/itemService.ts`
- `server/src/services/checkoutService.ts`
- `server/src/services/qrService.ts`
- `server/src/services/qrCode.ts`
- `server/src/services/auditLog.ts`

### Files to keep unchanged

- `server/src/services/prisma.ts`
- `server/src/services/errors.ts`
- `server/src/services/config.ts`
- `server/src/services/logBuffer.ts`

### Verification checks

1. `npx tsc --noEmit` — TypeScript compilation succeeds
2. `npm run test:server` — all API tests pass
3. grep for `export async function` in service class files — should
   find none (only class methods)
4. grep for imports of old camelCase service files — should find none
5. Verify `server/src/services/` contains only PascalCase class files
   plus the unchanged utility files

## Acceptance Criteria

- [ ] All 10 old service files deleted
- [ ] TypeScript compiles with no errors
- [ ] All API tests pass
- [ ] Round-trip test passes
- [ ] No imports of old service files anywhere in the codebase
- [ ] No standalone `export async function` in service class files

## Testing

- **Run**: `npm run test:server`
- **Run**: `npx tsc --noEmit`
- **Verification**: `grep -r "from.*siteService\|from.*computerService\|from.*kitService\|from.*auditLog\|from.*qrCode\|from.*qrService" server/src/`
