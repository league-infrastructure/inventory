---
id: '007'
title: 'Manufacturer admin: add Manufacturers tab to CategoriesPanel'
status: open
use-cases:
  - SUC-004
depends-on:
  - '005'
github-issue: ''
issue: make-manufacturer-a-first-class-entity.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# 007 — Manufacturer admin: add Manufacturers tab to CategoriesPanel

## Description

With the `/api/manufacturers` route live (ticket 005), admins need a UI to add,
rename, and delete manufacturers without a code change. This ticket adds a
"Manufacturers" tab to the existing `CategoriesPanel.tsx`. The `EditableList`
component already supports full CRUD — this is a two-line addition to the
`TABS` array and a matching render branch.

This ticket does NOT depend on ticket 006 (client form changes) — the admin
panel and the computer form are independent surfaces. It only needs the server
route from ticket 005.

## Acceptance Criteria

- [ ] `CategoriesPanel.tsx` has a `manufacturers` key in the `Tab` union type.
- [ ] A `{ key: 'manufacturers', label: 'Manufacturers' }` entry exists in the `TABS` array.
- [ ] The panel renders `<EditableList endpoint="/api/manufacturers" label="Manufacturers" />` when the manufacturers tab is active.
- [ ] A Quartermaster or Admin can add a new manufacturer name via the panel.
- [ ] An existing manufacturer name can be renamed inline (click to edit, enter to save, escape to cancel — same as Categories and Operating Systems).
- [ ] A manufacturer can be deleted from the panel (soft-deletes on the server via `DELETE /api/manufacturers/:id`).
- [ ] The new tab appears in the tab bar alongside Categories, Operating Systems, Container Types, and Dispositions.
- [ ] Switching to the Manufacturers tab and back to another tab works without error.

## Implementation Plan

### Approach

Mechanical addition — extend the `Tab` type and `TABS` array, add a render
branch. No new components, no new state, no new API calls beyond what
`EditableList` already handles.

### Files to Modify

- `client/src/pages/admin/CategoriesPanel.tsx`

### Changes

1. Extend the `Tab` union type:
   ```typescript
   type Tab = 'categories' | 'operatingSystems' | 'manufacturers' | 'containerTypes' | 'dispositions';
   ```

2. Add to the `TABS` array (after `operatingSystems`, before `containerTypes`):
   ```typescript
   { key: 'manufacturers', label: 'Manufacturers' },
   ```

3. Add a render branch in the JSX (after the `operatingSystems` branch):
   ```tsx
   {tab === 'manufacturers' && (
     <EditableList endpoint="/api/manufacturers" label="Manufacturers" />
   )}
   ```

That is the complete change. `EditableList` handles loading, add, inline-edit,
and delete via the endpoint prop.

### Testing Plan

1. Start dev server with ticket 005 changes applied.
2. Navigate to Admin > Categories & Types.
3. Verify a "Manufacturers" tab appears in the tab bar.
4. Click the tab — verify the manufacturer list loads (empty on fresh DB, or populated after backfill).
5. Add a manufacturer name — verify it appears in the list.
6. Click a name to edit, change it, press Enter — verify the name updates.
7. Delete a manufacturer — verify it disappears from the list.
8. Verify the other tabs (Categories, Operating Systems, etc.) still work normally.

### Documentation Updates

No user-facing docs. The admin panel is self-explanatory.
