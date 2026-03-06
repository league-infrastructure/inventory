---
id: '004'
title: AI Configuration and Status
status: done
use-cases:
- SUC-011-003
depends-on:
- '002'
---

# AI Configuration and Status

## Description

Add environment-based AI configuration and a status endpoint so the
frontend knows whether AI chat is available.

## Acceptance Criteria

- [x] `ANTHROPIC_API_KEY` read from environment on server startup
- [x] `GET /api/ai/status` returns `{ configured: true/false }`
- [x] Status endpoint does not require authentication
- [x] API key is never exposed in any response
- [x] Chat endpoint returns 503 with helpful message if not configured
- [x] `.env.template` updated with `ANTHROPIC_API_KEY=` placeholder
- [x] `secrets/dev.env.example` updated with the variable

## Testing

- API test: status returns false when key is missing
- API test: status returns true when key is set
- API test: chat endpoint returns 503 when unconfigured
- Verify in `tests/server/`
