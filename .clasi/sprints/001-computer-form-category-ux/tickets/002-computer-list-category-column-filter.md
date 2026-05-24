---
id: '002'
title: 'Computer list: category column + filter'
status: open
use-cases:
  - SUC-002
depends-on:
  - '001'
github-issue: ''
issue: add-3d-printer-category-and-computer-list-category-filter.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Computer list: category column + filter

## Description

The computer list page (`client/src/pages/computers/ComputerList.tsx`) does not
show category. Users cannot tell at a glance which computers are 3D printers vs.
laptops, and there is no way to filter the list to a single category. This ticket
adds a Category column to the table and a category-filter dropdown alongside the
existing Disposition filter.

The `categoryId` field on the computer form is handled by Ticket 001 and must be
done first so that newly created computers can have a category. This ticket is
sequenced after Ticket 001 in the sprint; however, the implementation itself only
touches `ComputerList.tsx` and has no code dependency on Ticket 001's changes.

Note: the source issue mentions "add category to the new computer form" as item 4.
That work is covered by Ticket 001, not this ticket. This ticket covers only the
list-page column and filter.

## Acceptance Criteria

- [ ] The computer list table has a Category column. It is hidden on narrow
      viewports (same `hidden sm:table-cell` pattern as Manufacturer, Year, etc.).
- [ ] The Category column shows the category name for computers that have one,
      or "—" for uncategorized computers.
- [ ] A Category filter dropdown appears in the filter bar alongside the existing
      Disposition filter. It is populated from `GET /api/categories`.
- [ ] An "All" option (value = empty string) at the top of the Category dropdown
      clears the category filter and shows all computers.
- [ ] Selecting a category in the dropdown filters the displayed rows to only
      computers in that category (client-side, applied to the already-fetched set).
- [ ] Changing the Disposition filter while a Category filter is active applies
      both filters simultaneously.
- [ ] The Category column is sortable via the existing `SortableHeader` component
      (sort key: `_category` derived from `category?.name`).

## Implementation Plan

### Approach

The computer list already fetches all computers for the selected disposition and
applies client-side column filters via `useTableSort`. Adding a category filter
follows the same pattern as the disposition filter (a controlled select above the
table) but applied against a new `_category` computed field on the enriched rows.

A separate `GET /api/categories` fetch populates the dropdown, matching the pattern
in ComputerForm for reference data.

### Files to Modify

- `client/src/pages/computers/ComputerList.tsx`

### Step-by-step

**1. Extend the `Computer` interface** — add `category`:

```tsx
category: { id: number; name: string } | null;
```

**2. Add state** — category filter and the reference list:

```tsx
const [categoryFilter, setCategoryFilter] = useState('');
const [allCategories, setAllCategories] = useState<{ id: number; name: string }[]>([]);
```

**3. Fetch categories on mount** — add a `useEffect` (or extend an existing one)
that calls `GET /api/categories` and sets `allCategories`.

**4. Extend the `enriched` memo** — add `_category`:

```tsx
_category: c.category?.name ?? '',
```

**5. Client-side category filter** — derive the display set by applying the
category filter after `useTableSort` processes the rows:

```tsx
const displayed = categoryFilter
  ? sorted.filter((c) => c._category === categoryFilter)
  : sorted;
```

Render `displayed` in the `tbody` instead of `sorted`.

**6. Category filter dropdown** — add alongside the Disposition filter in the
filter bar, using the same inline `<label>` + `<select>` pattern:

```tsx
<label className="text-sm text-gray-600">
  Category:{' '}
  <select
    value={categoryFilter}
    onChange={(e) => setCategoryFilter(e.target.value)}
    className="ml-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
  >
    <option value="">All</option>
    {allCategories.map((cat) => (
      <option key={cat.id} value={cat.name}>{cat.name}</option>
    ))}
  </select>
</label>
```

**7. Category column in `<thead>`** — add a `SortableHeader` for category after
the existing Year header, with `className="hidden sm:table-cell"`:

```tsx
<SortableHeader
  label="Category"
  sortKey="_category"
  currentSort={sort}
  onSort={toggleSort}
  filterValue={filters['_category']}
  onFilter={setFilter}
  className="hidden sm:table-cell"
/>
```

**8. Category cell in `<tbody>`** — add after the Year `<td>`:

```tsx
<td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
  {c.category?.name || '—'}
</td>
```

### Testing Plan

Manual verification with Vite dev server:

1. Open `http://localhost:5173/computers`.
2. Confirm a Category column appears in the table (may be hidden on small screens —
   widen the browser if needed).
3. Confirm uncategorized computers show "—".
4. Confirm the category-filter dropdown appears next to Disposition and is
   populated with category names.
5. Select a category — confirm the table shows only matching computers.
6. Select "All" — confirm all computers reappear.
7. Set both a Disposition filter and a Category filter simultaneously — confirm
   both are applied (intersection).
8. Confirm no console errors or failed network requests.

### Documentation Updates

None required.
