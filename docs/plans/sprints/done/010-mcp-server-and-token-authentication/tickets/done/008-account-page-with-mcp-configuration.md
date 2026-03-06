---
id: 008
title: Account page with MCP configuration
status: done
use-cases:
- SUC-001
- SUC-002
depends-on:
- '004'
---

# Account page with MCP configuration

## Description

Create a user account page at `client/src/pages/account/Account.tsx`
that shows profile info and an MCP connection configuration section.

### Profile section

- Displays user's name, email, and role (read-only).

### MCP Configuration section

- Shows a read-only code block with the JSON configuration snippet the
  user pastes into their AI client:
  ```json
  {
    "mcpServers": {
      "inventory": {
        "url": "https://inventory.jtlapp.net/api/mcp",
        "headers": {
          "Authorization": "Bearer <token>"
        }
      }
    }
  }
  ```
- **Copy button**: copies the full JSON snippet to clipboard.
- **Regenerate Token button**: confirms ("This will disconnect any
  clients using the current token"), revokes old token, creates new
  one, rebuilds the snippet.
- **Generate Token button**: shown when no token exists yet. Creates
  the first token and displays the snippet.
- Server URL derived from `APP_DOMAIN` env var (production) or
  `window.location.origin` (development).

### Navigation

- Add an "Account" link in the sidebar navigation.

## Acceptance Criteria

- [ ] Account page shows user profile info
- [ ] MCP config snippet displayed with current token
- [ ] Copy button copies full JSON snippet to clipboard
- [ ] Generate Token button creates first token
- [ ] Regenerate Token button confirms before regenerating
- [ ] Old token revoked when regenerating
- [ ] Server URL correct for both dev and production
- [ ] Account link added to sidebar navigation

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Component tests — renders profile info, shows
  generate button when no token, shows config snippet after generation,
  copy button works, regenerate confirms before acting
- **Verification command**: `npm run test:client`
