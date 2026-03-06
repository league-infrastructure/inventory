---
id: '002'
title: Inventory Check Routes
status: done
use-cases:
- SUC-012-001
- SUC-012-002
- SUC-012-004
depends-on:
- '001'
---

# Inventory Check Routes

## Description

Create Express route handlers for inventory check operations.

## Acceptance Criteria

- [ ] `POST /api/inventory-checks/kit/:kitId` starts a kit check
- [ ] `POST /api/inventory-checks/pack/:packId` starts a pack check
- [ ] `PATCH /api/inventory-checks/:id` submits check results
- [ ] `GET /api/inventory-checks/:id` returns check with lines
- [ ] `GET /api/inventory-checks/history/kit/:kitId` returns kit check history
- [ ] `GET /api/inventory-checks/history/pack/:packId` returns pack check history
- [ ] All routes require authentication
- [ ] Routes registered in app.ts

## Testing

- API test: unauthenticated requests return 401
- API test: start kit check returns check with lines
- API test: submit check updates lines
- Verify in `tests/server/`
