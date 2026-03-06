---
id: "017"
title: "Sidebar entry for inactive computers"
status: todo
use-cases: []
depends-on: []
---

# Sidebar entry for inactive computers

## Description

Add a sidebar entry below "Hosts" for computers with non-ACTIVE
dispositions (LOST, SCRAPPED, DECOMMISSIONED, NEEDS_REPAIR). These
computers currently disappear from the main view with no way to find
or restore them.

## Acceptance Criteria

- [ ] Sidebar link "Inactive Computers" below Hosts
- [ ] Page lists computers where disposition is not ACTIVE
- [ ] Shows disposition status for each computer
- [ ] Each computer has a "Restore" action to set disposition back to ACTIVE
- [ ] Restoring shows a toast confirmation

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Inactive computers page, restore action
- **Verification command**: `npm run test:client`
