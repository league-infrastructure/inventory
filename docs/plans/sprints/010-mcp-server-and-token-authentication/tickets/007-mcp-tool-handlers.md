---
id: '007'
title: MCP tool handlers
status: todo
use-cases:
- SUC-003
- SUC-004
- SUC-005
depends-on:
- '006'
---

# MCP tool handlers

## Description

Register all inventory MCP tools on the singleton McpServer. Each tool
is a thin wrapper around the corresponding service method, with role
checking and error handling.

### Tools to register

Create `server/src/mcp/tools.ts` with the following tools:

| MCP Tool | Service Call | Role Required |
|----------|-------------|---------------|
| `list_sites` | `services.sites.list()` | Any |
| `get_site` | `services.sites.get(id)` | Any |
| `create_site` | `services.sites.create(input, userId)` | QM |
| `update_site` | `services.sites.update(id, input, userId)` | QM |
| `list_kits` | `services.kits.list()` | Any |
| `get_kit` | `services.kits.get(id)` | Any |
| `create_kit` | `services.kits.create(input, userId)` | QM |
| `update_kit` | `services.kits.update(id, input, userId)` | QM |
| `list_packs` | `services.packs.list(kitId)` | Any |
| `create_pack` | `services.packs.create(input, userId, kitId)` | QM |
| `update_pack` | `services.packs.update(id, input, userId)` | QM |
| `delete_pack` | `services.packs.delete(id, userId)` | QM |
| `list_items` | `services.items.list(packId)` | Any |
| `create_item` | `services.items.create(input, userId, packId)` | QM |
| `update_item` | `services.items.update(id, input, userId)` | QM |
| `delete_item` | `services.items.delete(id, userId)` | QM |
| `list_computers` | `services.computers.list()` | Any |
| `get_computer` | `services.computers.get(id)` | Any |
| `create_computer` | `services.computers.create(input, userId)` | QM |
| `update_computer` | `services.computers.update(id, input, userId)` | QM |
| `list_hostnames` | `services.hostNames.list()` | Any |
| `checkout_kit` | `services.checkouts.checkOut(input, userId)` | Any |
| `checkin_kit` | `services.checkouts.checkIn(id, input, userId)` | Any |

### Error handling

- `requireRole` wrapper checks authenticated user's role before calling
  the service. Returns MCP tool error for permission denied.
- Service errors (`NotFoundError`, `ValidationError`) are caught and
  returned as MCP tool errors with descriptive messages.

### JSON Schema

Each tool is registered with a JSON Schema describing its input
parameters, derived from the existing contract input types.

## Acceptance Criteria

- [ ] All 23 tools registered with JSON Schema input definitions
- [ ] Read-only tools accessible to any authenticated user
- [ ] Write tools require Quartermaster role
- [ ] Checkout/checkin tools accessible to any authenticated user
- [ ] Service errors mapped to MCP tool errors
- [ ] Permission errors return clear error messages
- [ ] All tool calls go through the service layer
- [ ] Audit entries from MCP tools have `source = 'MCP'`

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: MCP integration tests — list tools, call
  read tool, call write tool with QM token, call write tool with
  Instructor token (expect permission error), verify audit source
- **Verification command**: `npm run test:server`
