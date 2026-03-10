---
id: "005"
title: "Slack AI Chat Immediate Receipt"
status: todo
use-cases: [SUC-004]
depends-on: []
---

# Slack AI Chat Immediate Receipt

## Description

When a Slack user sends a message that will be processed by AiChatService,
send an immediate acknowledgment message before processing begins so the
user knows the system received their request.

### Event messages (DMs, mentions, threads)

In `server/src/routes/slack.ts`, in the events handler (around line 194),
after the relevance screening passes and before calling `aiChat.chat()`:

```typescript
await postMessage(channel, "Got your message — working on it now.", threadTs);
```

### AI slash commands (/checkout, /checkin, /transfer, /report)

These already send an immediate response via `res.json()` (e.g., "Checking
out..."). No change needed — the existing acknowledgment is sufficient.

### What NOT to change

- Non-AI slash commands (/inventory, /haswhat, /whereis, /sites, /kits)
  already respond quickly with data. No receipt needed.
- The HTTP 200 acknowledgment to Slack (line 138) stays as-is — that's
  Slack protocol, not user-visible.

## Acceptance Criteria

- [ ] Event-based AI messages show immediate receipt before processing
- [ ] Receipt appears in the same channel/thread as the user's message
- [ ] Full AI response follows as a separate message after processing
- [ ] Non-AI messages and slash commands are unaffected
- [ ] Receipt wording is friendly and clear

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Not easily unit-testable (Slack API calls).
  Manual testing: send a DM to the bot, verify receipt appears before
  the full response.
- **Verification command**: Manual test via Slack
