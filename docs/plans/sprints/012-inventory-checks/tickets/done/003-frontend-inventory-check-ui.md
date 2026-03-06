---
id: '003'
title: Frontend Inventory Check UI
status: done
use-cases:
- SUC-012-001
- SUC-012-002
- SUC-012-004
depends-on:
- '002'
---

# Frontend Inventory Check UI

## Description

Add inventory check functionality to the kit detail page. Users can
start an inventory check, see a checklist of all items and computers,
confirm or adjust quantities, and submit.

## Acceptance Criteria

- [ ] "Inventory Check" button on kit detail page
- [ ] Checklist shows items grouped by pack with expected quantities
- [ ] COUNTED items have quantity input fields
- [ ] CONSUMABLE items have present/absent toggles
- [ ] Computers section with present/absent checkboxes
- [ ] Notes text field for check comments
- [ ] Submit button saves the check
- [ ] Discrepancies highlighted after submission
- [ ] Check history section on kit detail page
- [ ] Mobile-friendly layout

## Testing

- Component renders inventory check button
- Checklist displays items correctly
- Verify in `tests/client/`
