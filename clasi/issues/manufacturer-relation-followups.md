---
status: pending
---

# Manufacturer relation: deferred follow-ups from the 2026-05-28 deploy session

After the manufacturer backfill migration ships and is verified clean in
prod, do the following cleanup.

## 1. Drop the deprecated `Computer.manufacturer` String column

Add a Prisma migration that drops the column, and update any remaining
code paths that read/write it:

- Create/update inputs in `server/src/services/computer.service.ts`
  around lines 120 and 221.
- Export service at `server/src/services/export.service.ts:79,250`.
- `manufacturer?: string | null` field in
  `server/src/contracts/computer.ts:38`.

Also remove the `@deprecated` comment block from the `Computer` model
in `server/prisma/schema.prisma`.

## 2. Delete the redundant standalone backfill seed

`server/prisma/seed-manufacturer-backfill.ts` is now dead code — the
data migration `20260529011151_backfill_manufacturer_relation` runs
automatically on `prisma migrate deploy`.

## 3. Untrack `.claude/settings.json`

The IDE/harness rewrites this file (and likely
`.claude/settings.local.json`) constantly, which polluted `git status`
and was the original cause of the deploy-time "working tree not clean"
failures.

- `git rm --cached .claude/settings.json`
- Add `.claude/settings.json` (and the `.local` variant) to
  `.gitignore`.
- Verify no other dev relies on a checked-in version. Coordinate with
  the team before pushing.

## 4. Fix `dotconfig version bump` to sync nested package.json

`dotconfig version bump` updates the root `package.json` but not
`server/package.json`. `scripts/deploy.sh` currently syncs it manually
after the bump.

Options:

- Upstream patch in `dotconfig` to discover and sync all
  `package.json` files in the repo.
- Or add a root `postversion` npm script that runs the sync.

Then remove the manual `node -e "..."` sync from `scripts/deploy.sh`.
