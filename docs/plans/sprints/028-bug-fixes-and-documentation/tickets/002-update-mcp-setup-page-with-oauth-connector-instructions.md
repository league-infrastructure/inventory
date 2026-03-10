---
id: "002"
title: "Update MCP Setup page with OAuth connector instructions"
status: todo
use-cases: []
depends-on: []
---

# Update MCP Setup page with OAuth connector instructions

## Description

Sprint 027 added OAuth 2.0 client credentials routes so Claude's web
app can connect via the custom connector flow. The MCP Setup page in
the admin UI needs instructions explaining how to configure this:

1. Create an API token in the admin API Tokens panel.
2. In Claude's web app: Settings > Connectors > Add Custom Connector.
3. Enter name, MCP URL, and use the API token as OAuth Client Secret.

## Acceptance Criteria

- [ ] MCP Setup page documents OAuth connector setup steps
- [ ] Instructions are clear enough for an admin to follow without help
- [ ] Page references the API Tokens panel for token creation

## Testing

- **Verification command**: Manual review of the page content
