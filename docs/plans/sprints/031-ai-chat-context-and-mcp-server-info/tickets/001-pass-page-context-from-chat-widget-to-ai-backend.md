---
id: "001"
title: "Pass page context from chat widget to AI backend"
status: in-progress
use-cases:
  - SUC-031-001
depends-on: []
---

# Pass page context from chat widget to AI backend

## Description

The AI chat widget should detect what page the user is on and pass that
context to the backend so the AI can reason about the current entity.
This involves changes across four layers: frontend component, backend
route, AI service, and system prompt template.

## Acceptance Criteria

- [ ] `AiChat.tsx` extracts entity type and ID from the current URL
- [ ] Page context is sent as `pageContext` in the POST body
- [ ] `ai-chat.ts` route accepts and passes `pageContext` to the service
- [ ] `ai-chat.service.ts` looks up entity name and injects context into prompt
- [ ] System prompt template includes page context section
- [ ] Chat works normally on pages without entity context (e.g., dashboard)

## Testing

- **Existing tests to run**: `npm run test:client`, `npm run test:server`
- **New tests to write**: None (manual verification)
- **Verification command**: Manual — open chat on kit detail page and ask
  about "this kit"
