---
id: "002"
title: "Extend MCP get_version tool with hostname and environment"
status: todo
use-cases:
  - SUC-031-002
depends-on: []
---

# Extend MCP get_version tool with hostname and environment

## Description

The `get_version` MCP tool currently returns only `name` and `version`.
Extend it to also return `hostname` (from `os.hostname()`) and
`environment` (from `NODE_ENV`). Update the tool description so AI
agents discover it when asked about the server hostname.

## Acceptance Criteria

- [ ] `get_version` returns `hostname` field
- [ ] `get_version` returns `environment` field
- [ ] Tool description mentions "hostname" and "server" for discoverability
- [ ] Existing `version` and `name` fields are unchanged

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Call `get_version` via MCP client and verify
  new fields are present
