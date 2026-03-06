---
status: done
sprint: '010'
tickets:
- '020'
---
# Clean up leftover test data in production database

## Summary

Automated test runs have left behind test records that should be removed:

- **4 test sites**: `CO-Test-Site-A-*` and `CO-Test-Site-B-*` (IDs 373,
  374, 392, 394)
- **2 test kits**: `CO-Test-Kit-*` (IDs 194, 205)
- **~15 orphaned test computers**: No site, no kit, models like
  "QR Test Computer", "Detail Test", "After Update", and bare records
  with no model at all

## Action

Once the MCP server supports status updates and deletes, retire or delete
these records. Test data should not persist in the production database.

## Prevention

Consider whether the test suite should use a separate database or clean
up after itself more reliably.
