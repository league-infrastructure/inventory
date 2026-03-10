---
id: "004"
title: "Add Slack conversation history"
status: todo
use-cases: []
depends-on: []
---

# Add Slack conversation history

## Description

The Slack route always passes `[]` for conversation history when calling
`aiChat.chat()`. Each message is treated independently, so the bot has
no memory of previous exchanges with the same user.

### Changes needed

1. **Prisma schema** — Add a `SlackConversation` model:
   ```
   model SlackConversation {
     id               Int      @id @default(autoincrement())
     slackUserId      String
     userMessage      String
     assistantMessage String
     createdAt        DateTime @default(now())
     @@index([slackUserId, createdAt])
   }
   ```

2. **Migration** — Create and apply a Prisma migration.

3. **Slack route** — Before calling `aiChat.chat()`:
   - Query the last 5 `SlackConversation` records for the Slack user
     (ordered by `createdAt` ascending)
   - Convert them to `ChatMessage[]` format (alternating user/assistant)
   - Pass as `conversationHistory`
   - After getting the response, save the new user+assistant pair

4. **Cleanup** — Optionally add a scheduled job or simple TTL to prune
   old conversation records (e.g., older than 7 days), or leave for a
   future sprint.

## Acceptance Criteria

- [ ] SlackConversation model exists with migration applied
- [ ] Slack bot includes last 5 conversation rounds as context
- [ ] Bot demonstrates memory of recent messages in responses
- [ ] New conversation pairs are saved after each exchange
- [ ] Normal Slack functionality (screening, user resolution) unaffected

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Test via Slack by asking follow-up questions
