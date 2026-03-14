---
id: '004'
title: Computer List Checkbox Selection and Batch Print
status: in-progress
use-cases:
- SUC-002
- SUC-003
depends-on:
- '002'
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Computer List Checkbox Selection and Batch Print

## Description

Add checkbox selection to the computer list for batch label printing:

1. **Checkbox column**: Add a checkbox as the first column in the
   computer list table. Header has a "select all" checkbox that
   toggles all visible (filtered) computers.

2. **Per-row print action**: Add a small printer icon in the actions
   column for single-label printing from the list.

3. **Floating action bar**: When one or more checkboxes are selected,
   show a sticky/floating bar at the bottom of the viewport with:
   - Count of selected computers (e.g., "3 selected")
   - "Print Labels" button
   - "Clear Selection" action

4. **Batch print**: Clicking "Print Labels" calls
   `POST /api/labels/computers/batch` with the selected IDs and opens
   the PDF in a new tab.

Selection state: persists across sort changes, clears on disposition
filter change (since the visible list changes).

## Files to Modify

- `client/src/pages/computers/ComputerList.tsx` — Add checkbox column,
  selection state, floating action bar, per-row print action

## Acceptance Criteria

- [ ] Checkbox column appears as the first column
- [ ] "Select all" checkbox in header selects/deselects all visible rows
- [ ] Individual row checkboxes toggle selection
- [ ] Floating action bar appears when any checkbox is selected
- [ ] Action bar shows count of selected computers
- [ ] "Print Labels" button generates batch PDF and opens in new tab
- [ ] Per-row printer icon generates single label and opens in new tab
- [ ] Selection persists across sort changes
- [ ] Selection clears when disposition filter changes
- [ ] Deselecting all checkboxes hides the action bar
- [ ] Only visible to Quartermaster users

## Testing

- **Existing tests to run**: `npm test`
- **New tests to write**: Verify checkbox rendering, selection state
  management, action bar visibility logic
- **Verification command**: `npm test`
