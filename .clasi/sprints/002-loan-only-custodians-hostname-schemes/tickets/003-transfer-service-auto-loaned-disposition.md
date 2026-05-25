---
id: '003'
title: Transfer service auto-LOANED disposition
status: open
use-cases:
  - SUC-002
depends-on:
  - '001'
github-issue: ''
issue: add-student-and-partner-user-roles-for-loan-only-custodians.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Transfer service auto-LOANED disposition

## Description

When a computer is transferred to a custodian with role STUDENT or PARTNER,
automatically set `Computer.disposition = LOANED` as part of the same Prisma
update that records the new custodian.

This is a small, focused server change. It requires ticket 001 to be done first
because `UserRole.STUDENT` and `UserRole.PARTNER` must exist in the enum before
this code can reference them.

Kit has no `disposition` field (confirmed by schema inspection) — this is
computer-only.

## Acceptance Criteria

- [ ] `TransferService.transferComputer()` checks the incoming custodian's role
      after the custodian lookup.
- [ ] If the custodian's role is `STUDENT` or `PARTNER`, the Prisma
      `computer.update()` call includes `disposition: 'LOANED'` in its `data`.
- [ ] If the custodian's role is any other value (or custodianId is null — i.e.
      clearing the custodian), disposition is not touched.
- [ ] Kit transfer path (`transferKit()`) is not modified.
- [ ] After transferring a computer to a STUDENT user: `Computer.disposition`
      is `LOANED` in the database.
- [ ] After transferring a computer to an ADMIN user: `Computer.disposition` is
      unchanged.
- [ ] `npx tsc --noEmit` clean in `server/`.
- [ ] `npm run test:server` passes.

## Implementation Plan

### Approach

Single targeted change inside `transferComputer()` in
`server/src/services/transfer.service.ts`. The custodian lookup already
fetches the User record; extend the select to include `role`, then add a
conditional to the Prisma update `data`.

### Files to Modify

**`server/src/services/transfer.service.ts`**

In `transferComputer()`:

1. In the custodian lookup (line ~133):
   ```
   const custodian = await this.prisma.user.findUnique({
     where: { id: input.custodianId },
   });
   ```
   The existing query fetches the full User record, which includes `role` after
   ticket 001's migration. No select change needed — `role` is already on the
   model.

2. After `newCustodianName = custodian.displayName;` (line ~135), capture the
   role:
   ```
   const isLoanOnly = custodian.role === 'STUDENT' || custodian.role === 'PARTNER';
   ```

3. In the `prisma.computer.update()` call (line ~151), extend the `data` object:
   ```
   data: {
     custodianId: toCustodianId,
     siteId: toSiteId,
     ...(isLoanOnly ? { disposition: 'LOANED' } : {}),
   },
   ```

4. `isLoanOnly` is only set when `input.custodianId != null` (inside the
   existing null guard). When custodianId is null (clearing the custodian),
   `isLoanOnly` remains false and disposition is not touched.

### Files to Create

None.

### Testing Plan

1. `npx tsc --noEmit` in `server/` — clean.
2. `npm run test:server`.
3. Manual end-to-end test:
   - Create a STUDENT user (or use one created in ticket 001 testing).
   - Open a Computer with disposition ACTIVE.
   - Transfer it to the STUDENT user via the API (`POST /api/transfers` or via
     the UI after ticket 005 is done).
   - `SELECT disposition FROM "Computer" WHERE id = <id>` in psql — confirm
     `LOANED`.
   - Transfer the same computer to an ADMIN user — confirm disposition remains
     `LOANED` (disposition is not reset by staff transfer; if auto-reset is
     needed that is out of scope).

### Documentation Updates

None required.
