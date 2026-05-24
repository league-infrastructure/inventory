---
id: '003'
title: 'Admin category list: edit category'
status: open
use-cases:
  - SUC-003
depends-on: []
github-issue: ''
issue: edit-category-from-admin-category-list.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Admin category list: edit category

## Description

The Categories tab in the admin panel (`client/src/pages/admin/CategoriesPanel.tsx`)
supports adding and deleting categories but not renaming them. The `EditableList`
component renders category names as plain text. This ticket makes category names
clickable and adds an inline edit mode that persists via `PUT /api/categories/:id`.

The `PUT /api/categories/:id` route already exists in the server
(`server/src/routes/categories.ts`) and is guarded by `requireQuartermaster`.

Implementation note: the admin panel uses a separate authentication path from the
Quartermaster OAuth flow. Before wiring the PUT call, confirm that the admin
session token satisfies `requireQuartermaster` — if it does not, the call will
fail with 401/403. If admin auth bypasses that middleware, use the admin-specific
auth middleware instead, or make the request through the admin API prefix. Adjust
the fetch call accordingly.

## Acceptance Criteria

- [ ] Category names in the admin Categories tab are rendered as clickable
      elements (button or link styling — not plain text).
- [ ] Clicking a category name puts that row into edit mode: the name appears
      in a text input pre-filled with the current value.
- [ ] While in edit mode, a Save button and a Cancel button are shown.
- [ ] Clicking Save issues `PUT /api/categories/:id` with the new name and
      updates the list on success.
- [ ] Clicking Cancel discards the change and returns the row to read mode.
- [ ] Server validation errors (e.g., duplicate name, empty name) are surfaced
      to the user inline.
- [ ] Only one row can be in edit mode at a time (entering edit mode on a second
      row closes the first without saving).
- [ ] The other three tabs (Operating Systems, Container Types, Dispositions) are
      unaffected.

## Implementation Plan

### Approach

Add inline-edit state to the `EditableList` component: track which item ID is
being edited and its draft name. When a name is clicked, set `editingId` to that
item's ID. The row switches from rendering `{c.name}` to a text input. Save/Cancel
buttons appear in the actions column.

The `EditableList` component is generic and used by both Categories and Operating
Systems. The inline-edit feature will be available to both. That is a positive
side effect — do not restrict it to categories only.

### Files to Modify

- `client/src/pages/admin/CategoriesPanel.tsx`

### Step-by-step

**1. Add edit state to `EditableList`**

```tsx
const [editingId, setEditingId] = useState<number | null>(null);
const [draftName, setDraftName] = useState('');
const [editError, setEditError] = useState<string | null>(null);
```

**2. Enter edit mode**

```tsx
function handleEditStart(item: NamedRecord) {
  setEditingId(item.id);
  setDraftName(item.name);
  setEditError(null);
}
```

**3. Cancel**

```tsx
function handleEditCancel() {
  setEditingId(null);
  setDraftName('');
  setEditError(null);
}
```

**4. Save**

```tsx
async function handleEditSave(id: number) {
  setEditError(null);
  const res = await fetch(`${endpoint}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: draftName.trim() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setEditError(data.error || 'Failed to save');
    return;
  }
  const updated = await res.json();
  setItems((prev) =>
    prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
  );
  setEditingId(null);
}
```

**5. Update the table row rendering**

Replace the `<td>` that renders `{c.name}` with a conditional:

- When `editingId === c.id`: render a text input bound to `draftName`, plus Save
  and Cancel buttons in the actions column.
- Otherwise: render the name as a button (with appropriate hover styling) that
  calls `handleEditStart(c)`.

Existing Delete button: keep it in the actions column, but hide it while that row
is in edit mode (or disable it) to avoid confusion.

Show `editError` below the table row or inline near the input when it is set.

**6. Auth verification**

Before submitting a PR, test the PUT call from the admin panel in the running dev
server. If it returns 401/403, inspect what auth middleware the admin routes use
and update the fetch call (e.g., add credentials or change the endpoint prefix).
Document the finding in the commit message.

### Testing Plan

Manual verification in the running dev server:

1. Log in as admin and navigate to the Categories & Types panel.
2. Confirm category names are styled as clickable (cursor pointer, hover state).
3. Click a category name — confirm the row enters edit mode with a pre-filled input.
4. Change the name and click Save — confirm the list updates.
5. Reload the page — confirm the new name persists (came from the database).
6. Click a name and then click Cancel — confirm no change is made.
7. Enter edit mode on one row, then click a different row's name — confirm the
   first row exits edit mode without saving.
8. Attempt to save with an empty name or a duplicate name (if the server rejects
   it) — confirm the error is shown inline.
9. Confirm the Operating Systems tab also has the same edit-mode behaviour
   (since EditableList is shared).
10. Confirm Container Types and Dispositions tabs are unaffected.

### Documentation Updates

None required.
