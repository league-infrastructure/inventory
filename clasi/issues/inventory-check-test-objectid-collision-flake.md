---
status: pending
---

# inventory-check.service.test.ts is latently flaky: matches lines by bare objectId

## Description

During sprint 003 execution (2026-07-21), a programmer agent observed
`tests/server/services/inventory-check.service.test.ts` intermittently
failing under full-suite load (`discrepancyCount` 3 vs expected 2), while
passing on every isolated rerun.

Root cause (confirmed with a throwaway debug script): the test matches
inventory-check lines by bare `objectId` without also checking
`objectType`, so it spuriously fails whenever `Item.id` and `Computer.id`
autoincrement sequences happen to coincide in the shared `app` test
database. This is independent of any recent feature work.

Related environment note: full-suite runs at default jest parallelism can
also produce nondeterministic timeout/socket failures against the local
test Postgres; `--maxWorkers=2` converges reliably to the true baseline.
Worth encoding in the `test:server` script or jest config.

Fix: qualify the line lookup with `objectType` (and consider seeding ids
to avoid collisions), and consider pinning jest workers for DB-bound
suites.
