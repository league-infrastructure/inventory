---
id: '012'
title: MCP delete tools for kits, sites, and computers
status: done
use-cases: []
depends-on: []
---

# MCP delete tools for kits, sites, and computers

## Description

The MCP server has `delete_item` and `delete_pack` but no delete tools
for kits, sites, or computers. All entity types need delete operations
with appropriate safety checks.

## Safety Rules

- **Kits**: Refuse if kit has packs or computers. Consider requiring
  RETIRED status first.
- **Sites**: Refuse if kits are assigned to the site. Consider requiring
  isActive=false first.
- **Computers**: Refuse if computer has active checkouts.

## Acceptance Criteria

- [ ] `delete_kit` tool with safety checks
- [ ] `delete_site` tool with safety checks
- [ ] `delete_computer` tool with safety checks
- [ ] Clear error messages when delete is refused due to dependencies
- [ ] Tests for successful deletes and refused deletes

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Delete tool tests covering success and safety-check refusal
- **Verification command**: `npm run test:server`
