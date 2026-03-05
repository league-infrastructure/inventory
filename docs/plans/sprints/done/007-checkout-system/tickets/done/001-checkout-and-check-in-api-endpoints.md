---
id: '001'
title: Checkout and check-in API endpoints
status: done
use-cases: []
depends-on: []
---

# Checkout and check-in API endpoints

## Description

Create checkout API endpoints for check-out and check-in flows.

## Acceptance Criteria

- [x] POST /api/checkouts creates checkout record
- [x] PATCH /api/checkouts/:id/checkin closes checkout
- [x] GET /api/checkouts lists checkouts with status filter
- [x] GET /api/checkouts/history/:kitId returns kit history
- [x] Validation: kit must be ACTIVE, no double checkout
- [x] Audit log entries for checkout and checkin
- [x] TypeScript compiles clean
