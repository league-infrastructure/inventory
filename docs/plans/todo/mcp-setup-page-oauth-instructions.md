---
status: pending
---

# Update MCP Setup page with OAuth connector instructions

## Description

We added OAuth 2.0 client credentials routes (ticket 008, sprint 027)
so that Claude's web app can connect to our MCP server via the custom
connector flow. Now the MCP Setup page in the admin UI needs
instructions explaining how to configure this.

The setup steps for connecting Claude to the inventory MCP server:

1. Create an API token in the admin API Tokens panel.
2. In Claude's web app, go to Settings > Connectors > Add Custom Connector.
3. Enter:
   - **Name**: League Inventory (or similar)
   - **URL**: `https://inventory.jointheleague.org/api/mcp`
   - **OAuth Client ID**: any label (e.g., `claude`)
   - **OAuth Client Secret**: the API token from step 1
4. Claude will use the OAuth token endpoint to exchange the credentials
   for a Bearer token, then use it on MCP requests.

The MCP Setup page should document these steps clearly so an admin can
set up the connection without needing to know the OAuth internals.
