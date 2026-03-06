---
id: '010'
title: MCP documentation
status: todo
use-cases:
- SUC-001
- SUC-002
- SUC-003
- SUC-004
- SUC-005
- SUC-006
depends-on:
- '007'
- '008'
- '009'
---

# MCP documentation

## Description

Create `docs/mcp.md` documenting the MCP server, token authentication,
and how external AI clients connect to the inventory application.

### Contents

1. **Overview**: What the MCP server is and what it enables (external AI
   access to inventory operations).
2. **Creating an API token**: Step-by-step guide using the Account page
   UI — generating a token, copying the config snippet.
3. **Connecting AI clients**: Configuration examples for:
   - Claude Desktop (`claude_desktop_config.json`)
   - Claude Code (`.mcp.json`)
   - Other MCP-compatible clients
4. **Available tools**: Table of all MCP tools with descriptions,
   required parameters, and required roles.
5. **Permissions**: Which tools require Quartermaster role vs. available
   to all authenticated users.
6. **Admin token management**: How Quartermasters can view and revoke
   tokens from the admin dashboard.
7. **Security notes**: Token storage (hashed), revocation, auto-revoke
   on role change, audit trail with MCP source tagging.

## Acceptance Criteria

- [ ] `docs/mcp.md` created with all sections listed above
- [ ] Configuration examples are accurate and copy-pasteable
- [ ] Tool table matches the implemented tools
- [ ] Security notes cover token hashing, revocation, audit

## Testing

- **Existing tests to run**: none
- **New tests to write**: none (documentation only)
- **Verification command**: Review the document for accuracy
