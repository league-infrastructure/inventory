# MCP Server

The inventory application includes an MCP (Model Context Protocol) server
that allows external AI models — Claude Desktop, Claude Code, and other
MCP-compatible clients — to interact with inventory data.

## Overview

The MCP server exposes inventory operations as tools that AI models can
call. It runs as part of the Express application at `/api/mcp` using
Streamable HTTP transport. All operations go through the same service
layer as the web UI, ensuring consistent validation, business logic,
and audit logging.

## Creating an API Token

1. Sign in to the inventory application.
2. Click your name in the top-right corner and select **Account**.
3. In the **MCP Connection** section, click **Generate Token**.
4. The page displays a JSON configuration snippet with your token
   embedded. This is the only time the full token is shown.
5. Click **Copy** to copy the snippet to your clipboard.

To regenerate a token (e.g., if compromised), click **Regenerate Token**.
This immediately revokes the old token and creates a new one.

## Connecting AI Clients

### Claude Desktop

Add the snippet to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "inventory": {
      "url": "https://inventory.jtlapp.net/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "inventory": {
      "url": "https://inventory.jtlapp.net/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Other MCP Clients

Any client that supports MCP Streamable HTTP transport can connect using
the server URL and a Bearer token in the Authorization header.

## Available Tools

### Read Operations (any authenticated user)

| Tool | Description |
|------|-------------|
| `list_sites` | List all active sites |
| `get_site` | Get a site by ID |
| `list_kits` | List kits, optionally filtered by status |
| `get_kit` | Get a kit with packs and computers |
| `list_packs` | List packs, optionally by kit ID |
| `list_items` | List items, optionally by pack ID |
| `list_computers` | List all computers |
| `get_computer` | Get a computer by ID |
| `list_hostnames` | List all host names |

### Checkout Operations (any authenticated user)

| Tool | Description |
|------|-------------|
| `checkout_kit` | Check out a kit to a destination site |
| `checkin_kit` | Check in a kit, returning to a site |

### Write Operations (Quartermaster role required)

| Tool | Description |
|------|-------------|
| `create_site` | Create a new site |
| `update_site` | Update an existing site |
| `create_kit` | Create a new kit |
| `update_kit` | Update an existing kit |
| `create_pack` | Create a pack in a kit |
| `update_pack` | Update a pack |
| `delete_pack` | Delete a pack |
| `create_item` | Create an item in a pack |
| `update_item` | Update an item |
| `delete_item` | Delete an item |
| `create_computer` | Create a new computer |
| `update_computer` | Update a computer |

## Permissions

- **Instructor** tokens can read data and perform checkouts/check-ins.
- **Quartermaster** tokens can do everything Instructors can, plus
  create, update, and delete inventory records.
- The token carries a snapshot of your role at creation time. If your
  role changes, all your tokens are automatically revoked — generate a
  new one afterward.

## Admin Token Management

Quartermasters can view and revoke all tokens from the admin dashboard
under **Admin > API Tokens**. This shows all tokens across all users
with their status, creation date, and last usage.

## Security

- **Token storage**: Tokens are stored as SHA-256 hashes. The plaintext
  is shown only once at creation time.
- **Revocation**: Tokens can be revoked immediately by the token owner
  (from the Account page) or by an admin (from the admin dashboard).
- **Role changes**: When a user's role is changed, all their active
  tokens are automatically revoked to prevent privilege retention.
- **Audit trail**: All operations performed via MCP are recorded in the
  audit log with `source = 'MCP'`, making it easy to distinguish
  AI-initiated changes from manual ones.
- **Session isolation**: Token management endpoints (create, list,
  revoke) require session-based authentication and cannot be accessed
  via API tokens. This prevents an MCP client from managing tokens.
