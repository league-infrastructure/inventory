---
id: '020'
title: Clean up leftover test data
status: done
use-cases: []
depends-on:
- '011'
- '012'
---

# Clean up leftover test data

## Description

Automated test runs left behind records that should be removed:

- 4 test sites: CO-Test-Site-A/B-* (IDs 373, 374, 392, 394)
- 2 test kits: CO-Test-Kit-* (IDs 194, 205)
- ~15 orphaned test computers (already set to SCRAPPED)
- 4 orphaned test hostnames: DupHost-*, TestHost-*

## Acceptance Criteria

- [ ] Test sites deactivated or deleted
- [ ] Test kits retired or deleted
- [ ] Scrapped test computers deleted
- [ ] Orphaned test hostnames deleted
- [ ] Test suite updated to clean up after itself or use separate database

## Testing

- **Existing tests to run**: `npm run test:server`∏
- **New tests to write**: Verify test cleanup doesn't leave orphans
- **Verification command**: `npm run test:server`
