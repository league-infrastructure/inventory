---
status: done
sprint: '010'
tickets:
- '013'
---
# MCP server missing hostname management tools

## Summary

The MCP server has `list_hostnames` but no tools to create, update, or
delete hostnames. The `create_computer` tool accepts a `hostNameId` but
there's no way to create the hostname record first.

## Required Tools

- `create_hostname` — create a new hostname (name)
- `update_hostname` — rename a hostname
- `delete_hostname` — remove an orphaned hostname

## Impact

Cannot assign new hostnames to computers through MCP. The full workflow
(create hostname → create computer with that hostname) is broken.
