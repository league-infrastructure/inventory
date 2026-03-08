---
id: "006"
title: "Paginate admin database tables to 20 rows"
status: done
use-cases: []
depends-on: []
---

# Paginate admin database tables to 20 rows

## Description

Change the default pagination limit in the admin database viewer from 50
rows per page to 20 rows per page, for both the client-side fetch and the
server-side default.

## Acceptance Criteria

- [x] Client fetches with `limit=20` instead of `limit=50`
- [x] Server defaults to 20 rows when no limit param is provided
- [x] Pagination controls still work correctly

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: None — this is a configuration change
- **Verification command**: Manual — open Database page, verify 20 rows shown
