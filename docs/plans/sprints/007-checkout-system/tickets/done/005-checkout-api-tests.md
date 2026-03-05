---
id: '005'
title: Checkout API tests
status: done
use-cases: []
depends-on: []
---

# Checkout API tests

## Description

Write API tests for checkout and check-in flows.

## Acceptance Criteria

- [x] Checkout creation returns 201
- [x] Double checkout prevented (400)
- [x] Check-in updates record (200)
- [x] Double check-in prevented (400)
- [x] Checkout history returns kit's checkouts
- [x] Nearest site validation tested
- [x] Auth required on all endpoints (401)
- [x] Re-checkout after check-in works
- [x] All 18 tests pass
