---
id: '006'
title: HostName list UX — scheme column, status filter, inline edit
status: open
use-cases:
  - SUC-006
  - SUC-007
  - SUC-008
depends-on:
  - '002'
  - '004'
github-issue: ''
issue: add-scheme-field-to-hostname-discrete-value-column-filters.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# HostName list UX — scheme column, status filter, inline edit

## Description

Update `HostNameList.tsx` with three related changes: add a sortable Scheme
column with discrete filter; switch the Status column from plain text to a
discrete filter; add inline edit for both `name` and `scheme` with
`<datalist>` autocomplete on scheme from `GET /api/hostnames/schemes`.

Depends on ticket 002 (server scheme endpoint and `PUT /api/hostnames/:id`)
and ticket 004 (`SortableHeader` discrete-filter mode).

This ticket completes the hostname scheme issue.

## Acceptance Criteria

- [ ] `HostNameList.tsx` — the local HostName interface has `scheme: string |
      null` and an enriched `_status: 'Assigned' | 'Available'` field computed
      from whether `computerId` is set.
- [ ] A `GET /api/hostnames/schemes` call is made on component mount; the result
      is stored in a `schemes: string[]` state variable.
- [ ] **Scheme column**: present in the table; uses `<SortableHeader>` with
      `filterMode="discrete"` and `discreteOptions={schemes}`; sortable by
      scheme value.
- [ ] **Status column**: uses `<SortableHeader>` with `filterMode="discrete"`
      and `discreteOptions={['Assigned', 'Available']}`; filtering by status
      narrows the list correctly using the `_status` field.
- [ ] **Inline edit**: clicking a row enters edit mode showing a name `<input>`
      and a scheme `<input>`. The scheme input has a `<datalist>` element
      populated from the `schemes` state (same list used for the column filter).
- [ ] Pressing Enter or clicking Save in edit mode calls
      `PUT /api/hostnames/:id` with the updated `name` and/or `scheme`.
- [ ] The row exits edit mode and reflects the updated values after a successful
      save.
- [ ] Pressing Escape in edit mode cancels and reverts to the original values.
- [ ] Existing sort and filter behaviour on other columns is unchanged.
- [ ] `npx tsc --noEmit` clean in `client/`.
- [ ] `npm run test:client` passes.
- [ ] End-to-end verification matches SUC-006, SUC-007, SUC-008 acceptance
      criteria.

## Implementation Plan

### Approach

Mirror the inline-edit pattern from `CategoriesPanel.tsx`'s `EditableList`
(added in sprint 001 ticket 003). Fetch schemes on mount alongside the hostname
list fetch. Build the enriched rows with `_status` before passing to the sort
hook.

### Files to Modify

**`client/src/pages/computers/HostNameList.tsx`**

1. **HostName interface extension**: add `scheme: string | null`;
   add `_status: 'Assigned' | 'Available'` (computed, not from API).

2. **Scheme fetch**: add a `useEffect` that calls
   `GET /api/hostnames/schemes` and stores the result in
   `const [schemes, setSchemes] = useState<string[]>([])`.

3. **Row enrichment**: when building the row list from the API response, add
   `_status: h.computerId ? 'Assigned' : 'Available'` to each row.

4. **Scheme column**: add a `<th>` with:
   ```jsx
   <SortableHeader
     label="Scheme"
     sortKey="_scheme"
     filterMode="discrete"
     discreteOptions={schemes}
     currentSort={sort}
     currentFilter={filters['_scheme'] ?? ''}
     onSort={setSort}
     onFilter={(key, val) => setFilters(f => ({ ...f, [key]: val }))}
   />
   ```
   And a corresponding `<td>{row.scheme ?? '—'}</td>` (or inline-edit input
   when in edit mode).

5. **Status column**: change the existing Status `<th>` from a plain header to:
   ```jsx
   <SortableHeader
     label="Status"
     sortKey="_status"
     filterMode="discrete"
     discreteOptions={['Assigned', 'Available']}
     ...
   />
   ```

6. **Inline edit state**: add `const [editId, setEditId] = useState<number |
   null>(null)` and `const [editValues, setEditValues] = useState<{ name:
   string; scheme: string }>({ name: '', scheme: '' })`.

7. **Row click**: clicking a non-edit row calls
   `setEditId(row.id); setEditValues({ name: row.name, scheme: row.scheme ??
   '' })`.

8. **Edit row rendering**: when `editId === row.id`, render:
   - `<input value={editValues.name} onChange={...} />`
   - `<input value={editValues.scheme} onChange={...} list="scheme-datalist" />`
   - `<datalist id="scheme-datalist">{schemes.map(s => <option key={s}
     value={s} />)}</datalist>`
   - Save button / Enter key: calls `PUT /api/hostnames/:id { name:
     editValues.name, scheme: editValues.scheme || null }`; on success,
     refresh the list and `setEditId(null)`.
   - Escape key: `setEditId(null)`.

9. **`PUT /api/hostnames/:id` call**: use the existing API client pattern (or
   `fetch`) to call `PUT /api/hostnames/${editId}` with `Content-Type:
   application/json` and the edit values. Treat empty string scheme as `null`
   before sending.

### Files to Create

None.

### Testing Plan

1. `npx tsc --noEmit` in `client/` — clean.
2. `npm run test:client`.
3. Manual end-to-end test (SUC-006, SUC-007, SUC-008 verification steps):
   - Open `/hostnames` — Scheme column visible.
   - Click Scheme search icon → dropdown of distinct schemes appears. Select
     one → list narrows.
   - Click Status search icon → dropdown shows "Assigned" / "Available".
     Select "Available" → list narrows to unassigned hostnames.
   - Click a row → edit mode. Name and scheme inputs visible; scheme datalist
     shows existing schemes. Type a new scheme, press Enter → row updates.
   - Press Escape in edit mode → row reverts.
   - Click Scheme column header → rows sort by scheme.

### Documentation Updates

None required.
