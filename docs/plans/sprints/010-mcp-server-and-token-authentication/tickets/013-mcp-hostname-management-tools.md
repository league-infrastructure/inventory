---
id: "013"
title: "MCP hostname management tools"
status: todo
use-cases: []
depends-on: []
---

# MCP hostname management tools

## Description

The MCP server has `list_hostnames` but no tools to create, update, or
delete hostnames. The `create_computer` tool accepts a `hostNameId` but
there is no way to create the hostname record first, making the full
workflow (create hostname → create computer with hostname) impossible.

## Acceptance Criteria

- [ ] `create_hostname` tool (accepts name, returns hostname record)
- [ ] `update_hostname` tool (rename a hostname)
- [ ] `delete_hostname` tool (remove orphaned hostnames)
- [ ] Full workflow works: create hostname → create computer with hostNameId
- [ ] Tests for all three tools

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Hostname CRUD tests, workflow integration test
- **Verification command**: `npm run test:server`
