---
id: '004'
title: SortableHeader discrete-filter mode
status: open
use-cases:
  - SUC-006
  - SUC-007
depends-on: []
github-issue: ''
issue: add-scheme-field-to-hostname-discrete-value-column-filters.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# SortableHeader discrete-filter mode

## Description

Extend `SortableHeader` with a `filterMode?: 'text' | 'discrete'` prop and a
`discreteOptions?: string[]` prop. When `filterMode` is `'discrete'`, the
search icon reveals a `<select>` dropdown of the provided options instead of a
text `<input>`. The selected value flows through the existing `onFilter(key,
value)` callback unchanged. No changes to `useTableSort`.

This is a standalone client-side component change with no server dependency. It
can be executed in parallel with the scheme server ticket (002). Ticket 006
(HostName list UX) depends on both this ticket and ticket 002.

## Acceptance Criteria

- [ ] `SortableHeader` accepts `filterMode?: 'text' | 'discrete'` prop;
      default is `'text'` (existing behaviour unchanged when prop is omitted).
- [ ] `SortableHeader` accepts `discreteOptions?: string[]` prop.
- [ ] When `filterMode === 'discrete'`, clicking the search icon reveals a
      `<select>` element containing the `discreteOptions` values.
- [ ] A blank/default first option (e.g. `<option value="">All</option>`)
      allows clearing the filter.
- [ ] Selecting an option calls `onFilter(key, selectedValue)`; selecting the
      blank option calls `onFilter(key, '')` (clears filter).
- [ ] When `filterMode === 'text'` (default), all existing behaviour is
      unchanged — no regressions on ComputerList or any other page using
      SortableHeader.
- [ ] `discreteOptions` being undefined or empty renders a functional (if
      vacuous) select — no crash.
- [ ] `npx tsc --noEmit` clean in `client/`.
- [ ] `npm run test:client` passes.

## Implementation Plan

### Approach

Purely additive change to `SortableHeader.tsx`. The component already has a
conditional filter-input reveal; add a branch on `filterMode`.

### Files to Modify

**`client/src/components/SortableHeader.tsx`**

1. Add to the props interface (or type):
   ```typescript
   filterMode?: 'text' | 'discrete';
   discreteOptions?: string[];
   ```

2. In the filter reveal section (where the text `<input>` is currently
   rendered), replace the unconditional `<input>` with:
   ```typescript
   {filterMode === 'discrete' ? (
     <select
       value={currentFilter}
       onChange={e => onFilter(sortKey, e.target.value)}
     >
       <option value="">All</option>
       {(discreteOptions ?? []).map(opt => (
         <option key={opt} value={opt}>{opt}</option>
       ))}
     </select>
   ) : (
     <input
       type="text"
       value={currentFilter}
       onChange={e => onFilter(sortKey, e.target.value)}
       placeholder="Filter..."
     />
   )}
   ```
   Preserve all existing styling classes on the `<input>` — apply equivalent
   classes to the `<select>` so it integrates with the existing UI.

3. No changes to the sort icon, the toggle state, or the `onFilter`/`onSort`
   callback signatures.

### Files to Create

None.

### Testing Plan

1. `npx tsc --noEmit` in `client/` — clean.
2. `npm run test:client`.
3. Manual visual test:
   - Open any page that uses `SortableHeader` in text mode (e.g. ComputerList).
     Confirm search icon and text input behave identically to before.
   - Temporarily add `filterMode="discrete" discreteOptions={["A","B","C"]}` to
     one header in a dev page to confirm the select renders and onFilter fires.
     (This temporary addition is removed before committing; ticket 006 adds the
     real usages.)

### Documentation Updates

None required. The new props are self-documenting in the TypeScript interface.
