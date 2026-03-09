# Ticket 005 Plan — Fix TypeScript Build Errors

## Approach

Two independent fixes:

1. **Dockerfile**: Swap `npx tsc && npx prisma generate` to
   `npx prisma generate && npx tsc`. This fixes all server errors.

2. **Client source fixes** (12 errors in 6 files):
   - Add `undefined` arg to two `useRef()` calls
   - Add `type` keyword to `FormEvent` import
   - Remove unused `Custodian` interface
   - Cast `INACTIVE_DISPOSITIONS` to `readonly string[]` for `.includes()`
   - Remove unused vars in KitDetail.tsx, add missing `categoryId` field

## Files to modify

- `docker/Dockerfile.server` — line 13
- `client/src/components/AppLayout.tsx` — line 136
- `client/src/pages/search/SearchPage.tsx` — line 33
- `client/src/pages/admin/AdminLogin.tsx` — line 1
- `client/src/pages/computers/ComputerDetail.tsx` — line 10
- `client/src/pages/computers/InactiveComputers.tsx` — line 33
- `client/src/pages/kits/KitDetail.tsx` — lines 68, 70, 77, 145, 153, 262, 460

## Testing

- `cd client && npx tsc -b --noEmit` — must pass with zero errors
- No new tests needed; these are type-checking fixes only
