---
id: "015"
title: "Toast notification system"
status: todo
use-cases: []
depends-on: []
---

# Toast notification system

## Description

Add a toast notification system for confirmations and errors. Toasts
appear at a consistent position, persist for a few seconds, then fade
away. Non-blocking — user can continue interacting.

## Use Cases

- Kit retired → navigate to kit list → toast "Kit #N retired"
- API errors, validation failures, permission issues
- Any significant state change confirmation

## Acceptance Criteria

- [ ] Toast component with auto-dismiss and fade animation
- [ ] Toast context/provider for triggering from anywhere
- [ ] Success and error variants
- [ ] Kit retirement uses toast after navigating back to list
- [ ] At least one error case uses toast

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Toast component render/dismiss tests
- **Verification command**: `npm run test:client`
