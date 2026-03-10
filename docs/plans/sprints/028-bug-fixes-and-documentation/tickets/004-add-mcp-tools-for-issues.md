---
id: "004"
title: "Add MCP tools for issues"
status: todo
use-cases: []
depends-on: ["003"]
---

# Add MCP tools for issues

## Description

The MCP server has no issue-related tools. Add tools so remote models
can create and manage issues via the MCP protocol.

### Tools to add in `server/src/mcp/tools.ts`

- `create_issue` — type, optional packId/itemId/kitId/computerId, notes
- `list_issues` — filters: status, type, packId, kitId, computerId
- `resolve_issue` — id, optional notes

Follow existing MCP tool patterns. Use IssueService via mcpContext.

## Acceptance Criteria

- [ ] create_issue MCP tool works for packs, kits, and computers
- [ ] list_issues MCP tool supports filtering
- [ ] resolve_issue MCP tool marks issues resolved
- [ ] Tools registered in MCP server

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `npm run test:server`
