---
status: done
sprint: '025'
tickets:
- 019
---

# Slack slash commands for Inventory Bot

Add slash commands so users can perform common inventory operations quickly
from any Slack channel without needing to open a DM or the web app.

## Currently implemented

- `/checkout <kit name or QR code>` — check out a kit (routes through AI chat)

## Suggested commands

### High value — quick lookups

- **`/inventory <name or number>`** — Look up any item (kit, computer, pack) by
  name or number. Returns a summary with current location, custodian, and
  status. Responds ephemerally (only visible to the caller).

- **`/haswhat <person>`** — Show what a person has checked out. Useful for
  managers checking on a team member's equipment.

- **`/whereis <kit or computer>`** — Where is this item? Returns the site,
  custodian, and last-inventoried date.

### Medium value — actions

- **`/checkin <kit name or QR>`** — Return a kit (opposite of `/checkout`).
  Moves the kit back to the home site.

- **`/transfer <item> to <site or person>`** — Transfer a kit or computer
  to a different site or custodian.

- **`/report <item> <issue>`** — File an issue note against a kit or
  computer (e.g., broken screen, missing charger).

### Lower priority — admin/info

- **`/sites`** — List all active sites with kit counts.

- **`/kits [site]`** — List kits, optionally filtered by site.

- **`/inventory-help`** — Show available commands and how to DM the bot.

## Design considerations

- **All slash command responses are visible to the channel** (`response_type:
  "in_channel"`). The two usage modes are:
  1. **DM with the bot** — private by nature, only you see it.
  2. **Channel / group** — you're asking in front of others because you
     want everyone to see the answer.
  There's no need for ephemeral responses or a `--share` flag. The context
  (DM vs channel) already determines visibility.
- Each command needs a corresponding entry in the Slack app manifest
  (`config/slack_manifest.yaml`) and a route in `server/src/routes/slack.ts`.
- All commands go through the service layer, not Prisma directly.
- User mapping (Slack → inventory user) is already implemented via email
  and display name fallback.
