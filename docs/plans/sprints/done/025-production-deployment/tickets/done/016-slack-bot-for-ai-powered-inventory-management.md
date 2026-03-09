---
id: '016'
title: Slack bot for AI-powered inventory management
status: done
use-cases: []
depends-on:
- '013'
- '014'
---

# Slack bot for AI-powered inventory management

## Description

Build a Slack bot that acts as another window onto the AI chat interface.
Users DM the bot in Slack and messages are routed through the same
AiChatService (with Haiku topic guard and tool-use) that powers the web
chat. This avoids requiring users to log in to the inventory web app for
simple queries.

Implementation:

1. **Event endpoint** (`/slack/events`) — handle Slack's URL verification
   challenge and `message.im` events. Verify requests using the signing
   secret.
2. **Route messages through AiChatService** — map Slack user ID to an
   inventory user (by Slack ID or email lookup), build conversation
   history from recent DM messages, call `aiChat.screenMessage()` then
   `aiChat.chat()`.
3. **Reply via `chat.postMessage`** — send the AI response back to the
   Slack DM channel. For long responses, stream isn't possible in Slack,
   so collect the full response and post it.
4. **Slash command** (`/checkout`) — handle the `/checkout` command
   endpoint at `/slack/commands/checkout`.
5. **Update manifest** — ensure `config/slack_manifest.yaml` matches
   the implemented features.

Secrets already configured: `SLACK_SIGNING_SECRET`, `SLACK_VERIFICATION_TOKEN`,
`SLACK_BOT_USER_OAUTH_TOKEN`.

## Acceptance Criteria

- [ ] `POST /slack/events` responds to Slack URL verification challenge
- [ ] `POST /slack/events` processes `message.im` events with signature verification
- [ ] Bot replies to DMs by routing through AiChatService
- [ ] Haiku topic guard filters off-topic messages in Slack too
- [ ] Bot maps Slack users to inventory users (by email or Slack ID)
- [ ] `/checkout` slash command endpoint responds
- [ ] Deployed to production and Slack event subscription URL verified

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Unit tests for Slack signature verification, event parsing
- **Verification**: Send a DM to @Inventory Bot in Slack and get a response
