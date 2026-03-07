---
status: pending
---

# Clean up orphan test hostnames

MCP test runs leave behind `TestHost-*` and `DupHost-*` hostnames that
are not cleaned up. These accumulate across test executions.

## Problem

The test plan creates hostnames for testing but does not reliably clean
them all up — particularly when tests fail partway through or when
duplicate-detection tests intentionally create records that aren't
deleted.

## Proposed fix

Two approaches (not mutually exclusive):

1. **Immediate cleanup:** Write a one-time script or MCP call sequence
   to delete all hostnames matching `TestHost-*` and `DupHost-*`.
2. **Test hygiene:** Update the test plan to track all created records
   and include a comprehensive cleanup phase that deletes everything
   regardless of test pass/fail status.
