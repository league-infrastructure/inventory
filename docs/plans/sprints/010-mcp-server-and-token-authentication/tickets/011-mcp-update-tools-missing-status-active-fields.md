---
id: "011"
title: "MCP update tools missing status/active fields"
status: todo
use-cases: []
depends-on: []
---

# MCP update tools missing status/active fields

## Description

The `update_kit` MCP tool does not accept a `status` parameter, so kits
cannot be retired through MCP. Similarly, `update_site` does not accept
`isActive`, so sites cannot be deactivated. The `update_computer` tool
correctly supports `disposition` — the other update tools should follow
the same pattern.

## Acceptance Criteria

- [ ] `update_kit` accepts `status` parameter (ACTIVE, RETIRED)
- [ ] `update_site` accepts `isActive` parameter (boolean)
- [ ] Existing MCP tests updated to cover new fields
- [ ] Can retire a kit via MCP and verify status changes

## Testing

- **Existing tests to run**: `npm run test:server` (MCP tool handler tests)
- **New tests to write**: Tests for updating kit status and site isActive via MCP
- **Verification command**: `npm run test:server`
