---
id: '006'
title: 'Manufacturer client: ComputerForm and ComputerDetail API-driven selects'
status: open
use-cases:
  - SUC-004
depends-on:
  - '005'
github-issue: ''
issue: make-manufacturer-a-first-class-entity.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# 006 — Manufacturer client: ComputerForm and ComputerDetail API-driven selects

## Description

With the server exposing `/api/manufacturers` and Computer returning a
`manufacturer` relation (ticket 005), this ticket updates the two client pages
that render the manufacturer selector. Both currently have a hardcoded
`Dell / Lenovo / Apple / HP / Other` option list and send `manufacturer:
string` to the API. After this ticket they fetch the list from the API and send
`manufacturerId: number | null` — matching how Category and OS are handled.

## Acceptance Criteria

- [ ] `ComputerForm.tsx`:
  - [ ] Fetches `/api/manufacturers` in the initial `Promise.all` alongside sites, kits, etc.
  - [ ] State uses `manufacturerId: number | ''` (not `manufacturer: string`).
  - [ ] The Manufacturer `<select>` renders one `<option>` per API result; the hardcoded Dell/Lenovo/Apple/HP/Other options are removed.
  - [ ] On edit load, `manufacturerId` is populated from `c.manufacturer?.id || ''`.
  - [ ] The submitted body sends `manufacturerId: manufacturerId || null` (not `manufacturer`).
- [ ] `ComputerDetail.tsx`:
  - [ ] Fetches `/api/manufacturers` alongside the other lookup lists.
  - [ ] `FormState` has `manufacturerId: number | ''` (not `manufacturer: string`).
  - [ ] The manufacturer `EditableCell` (or equivalent select) renders the API list.
  - [ ] On load, `manufacturerId` is populated from `c.manufacturer?.id || ''`.
  - [ ] `saveField('manufacturerId', value)` sends the numeric id to `PUT /api/computers/:id`.
  - [ ] The hardcoded manufacturer option list is removed.
- [ ] A computer that was backfilled (has `manufacturerId` set) displays its manufacturer name correctly in both ComputerForm (edit mode) and ComputerDetail.
- [ ] A computer with no manufacturer shows an empty/blank selection in both views.

## Implementation Plan

### Approach

Follow the exact pattern already used by Category and OperatingSystem in both
files. The changes are mechanical substitutions with no new architectural
complexity.

### Files to Modify

- `client/src/pages/computers/ComputerForm.tsx`
- `client/src/pages/computers/ComputerDetail.tsx`

### ComputerForm.tsx Changes

1. Add `interface Manufacturer { id: number; name: string; }` at the top (alongside the existing `Category` and `OperatingSystem` interfaces).
2. Add `const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);` state.
3. Change `const [manufacturer, setManufacturer] = useState('');` to `const [manufacturerId, setManufacturerId] = useState<number | ''>('');`.
4. Add `fetch('/api/manufacturers').then(r => r.json())` to the `Promise.all`, destructure as `mfgList`, call `setManufacturers(mfgList)`.
5. On edit load, replace `setManufacturer(c.manufacturer || '')` with `setManufacturerId(c.manufacturer?.id || '')`.
6. In `handleSubmit`, replace `manufacturer: manufacturer || null` with `manufacturerId: manufacturerId || null`.
7. In JSX, replace the hardcoded `<select>` for manufacturer with:
   ```tsx
   <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value ? parseInt(e.target.value, 10) : '')} className={inputClass}>
     <option value=""></option>
     {manufacturers.map((m) => (
       <option key={m.id} value={m.id}>{m.name}</option>
     ))}
   </select>
   ```

### ComputerDetail.tsx Changes

1. Add `interface Manufacturer { id: number; name: string; }`.
2. Add `manufacturers` to `useState` and `FormState`.
3. Fetch `/api/manufacturers` in `loadComputer`'s `Promise.all`.
4. Change `manufacturer: string` in `FormState` to `manufacturerId: number | ''`.
5. On load, populate `manufacturerId: c.manufacturer?.id || ''`.
6. In `saveField`, the `manufacturerId` case already handled by the existing `parseInt` branch (it's in the list alongside `osId`, `categoryId`).
7. Replace the hardcoded manufacturer `EditableCell` options with the `manufacturers` array.

Note: Check how `ComputerDetail.tsx` currently passes manufacturer to
`EditableCell` — it may use a `select` variant with an `options` prop or
inline options. Mirror the pattern used for `osId` / `categoryId`.

### Testing Plan

1. Start dev server with migrations applied and backfill run.
2. Open ComputerForm (new computer): verify Manufacturer dropdown shows API-sourced names.
3. Create a computer selecting a manufacturer; verify the detail page shows the correct manufacturer name.
4. Open ComputerDetail for a backfilled computer; verify manufacturer is pre-selected.
5. Change manufacturer in detail page; verify PUT request sends `manufacturerId` not `manufacturer`.
6. Open ComputerForm (edit mode) for a backfilled computer; verify manufacturer is pre-selected.

### Documentation Updates

No user-facing docs. The UX change is transparent — the dropdown still shows manufacturer names.
