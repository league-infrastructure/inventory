---
id: "003"
title: "Update MCP Setup page for Claude web app OAuth flow"
status: done
use-cases: []
depends-on: ["001"]
---

# Update MCP Setup page for Claude web app OAuth flow

## Description

Now that the OAuth authorization code flow works, the MCP Setup page
instructions for Claude Web App need updating. The user no longer needs
to manually provide a client_id or client_secret — Claude.ai handles
the OAuth flow automatically. The user just needs the server URL.

Update the Claude Web App section to reflect the simpler setup:
just enter the URL and Claude handles the rest (OAuth redirect, login,
token exchange).

The client_id hash and client_secret display can be removed or moved
to a "Claude Code / CLI" section since those are only needed for
non-OAuth (Bearer token) connections.

## Acceptance Criteria

- [x] Claude Web App instructions simplified to URL-only
- [x] Client ID/Secret display preserved for CLI/Desktop usage
- [x] Instructions match actual OAuth flow behavior

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Visual verification on MCP Setup page
