---
id: "016"
title: "Kits tab show and un-retire retired kits"
status: todo
use-cases: []
depends-on: ["011"]
---

# Kits tab show and un-retire retired kits

## Description

Once a kit is retired it disappears from the UI with no way to find or
restore it. The Kits tab needs a filter or sub-section for retired kits,
with an action to restore them to ACTIVE.

## Acceptance Criteria

- [ ] Kits tab has a way to view retired kits (filter, toggle, or sub-tab)
- [ ] Retired kits display with visual distinction (e.g., muted style)
- [ ] Each retired kit has a "Restore" action to set status back to ACTIVE
- [ ] Restoring a kit shows a toast confirmation

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Retired kit filter, restore action
- **Verification command**: `npm run test:client`
