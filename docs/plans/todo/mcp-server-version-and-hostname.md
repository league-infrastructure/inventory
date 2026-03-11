---
status: pending
---

# MCP server should expose app version and server hostname

The inventory MCP server should provide a function (or extend `get_version`)
that returns:

- The application version (from `package.json`)
- The hostname of the server the app is running on (e.g., `swarm1.dojtl.net`)

This lets AI assistants (Claude Code, Slack bot, web chat) answer questions
like "what version are we running?" or "what server is this on?" without
needing to shell out or inspect Docker contexts.

The MCP tool description should make it clear that this is the way to look
up the server hostname and app version, so that agents naturally reach for
it when a user asks about either.
