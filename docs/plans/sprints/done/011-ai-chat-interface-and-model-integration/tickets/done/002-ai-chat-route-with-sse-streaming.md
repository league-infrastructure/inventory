---
id: '002'
title: AI Chat Route with SSE Streaming
status: done
use-cases:
- SUC-011-001
- SUC-011-004
depends-on:
- '001'
---

# AI Chat Route with SSE Streaming

## Description

Create the Express route handler for the AI chat endpoint. The route
accepts POST requests with a message and conversation history, calls
the AI chat service, and streams the response back using Server-Sent
Events.

## Acceptance Criteria

- [x] `POST /api/ai/chat` route created in `server/src/routes/ai-chat.ts`
- [x] Route requires session authentication
- [x] Route accepts `{ message, conversationHistory }` in request body
- [x] Response uses SSE format (`Content-Type: text/event-stream`)
- [x] Text deltas sent as `data: {"type":"delta","text":"..."}`
- [x] Tool use notifications sent as `data: {"type":"tool_use","name":"...","input":{...}}`
- [x] Completion sent as `data: {"type":"done","fullText":"..."}`
- [x] Errors sent as `data: {"type":"error","error":"..."}`
- [x] Route returns 503 if AI is not configured (no API key)
- [x] `GET /api/ai/status` returns `{ configured: boolean }`

## Testing

- API test: unauthenticated request returns 401
- API test: missing API key returns 503
- API test: valid request streams SSE response (mock AI service)
- API test: status endpoint returns configuration state
- Verify in `tests/server/`
