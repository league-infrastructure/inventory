---
status: pending
---

# Add MCP tools for issues

## Description

The MCP server has no issue-related tools. Remote models (like Claude
via the web connector) need to be able to create and manage issues.

Tools to add:

- `create_issue` — create an issue on a pack/item, kit, or computer
- `list_issues` — list issues with filters (status, type, entity)
- `get_issue` — get a single issue by ID
- `resolve_issue` — mark an issue as resolved

These should follow the existing MCP tool patterns in
`server/src/mcp/tools.ts` and call through the IssueService.
