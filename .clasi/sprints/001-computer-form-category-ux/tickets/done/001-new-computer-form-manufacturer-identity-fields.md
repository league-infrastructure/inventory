---
id: '001'
title: 'New computer form: manufacturer + identity fields'
status: in-progress
use-cases:
- SUC-001
depends-on: []
github-issue: ''
issue: add-missing-identity-fields-to-the-new-computer-form.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# New computer form: manufacturer + identity fields

## Description

The new-computer form (`client/src/pages/computers/ComputerForm.tsx`) is missing
five identity fields that the server already accepts on `POST /api/computers`:
`manufacturer`, `modelNumber`, `manufacturedYear`, `osId`, and `categoryId`.
Quartermasters must open the edit page after creation to fill these in, which is
unnecessary friction.

This is a pure UI fix — the server contracts, Prisma service, and database schema
are already correct. No backend changes are needed.

Reference pattern: `client/src/pages/computers/ComputerDetail.tsx`, which already
renders and edits all five fields.

## Acceptance Criteria

- [x] `ComputerForm.tsx` renders a Manufacturer select with options: (blank), Dell,
      Lenovo, Apple, HP, Other — matching the hardcoded list in ComputerDetail.tsx.
- [x] `ComputerForm.tsx` renders a Model Number text input.
- [x] `ComputerForm.tsx` renders a Manufactured Year number input.
- [x] `ComputerForm.tsx` renders an Operating System select populated from
      `GET /api/operating-systems`, with a "None" option.
- [x] `ComputerForm.tsx` renders a Category select populated from
      `GET /api/categories`, with a "None" option.
- [x] All five values are included in the `POST /api/computers` request body on
      create.
- [x] All five values are included in the `PUT /api/computers/:id` request body on
      edit.
- [x] In edit mode, all five fields hydrate from the existing computer record.
- [x] Submitting the edit form without changing these fields preserves their values.
- [ ] Dev server shows no Prisma errors or 500s on POST/PUT `/api/computers`.

## Implementation Plan

### Approach

Extend `ComputerForm.tsx` in four places: interfaces, state declarations,
reference-data fetch, edit-mode hydration, and submit body. Then add the JSX
inputs. Only one file changes.

### Files to Modify

- `client/src/pages/computers/ComputerForm.tsx`

### Step-by-step

**1. Interfaces** — add after the existing `HostName` interface (near lines 4–6):

```tsx
interface OperatingSystem { id: number; name: string; }
interface Category { id: number; name: string; }
```

**2. State additions** — add after `hostNameId` state (after line 25):

```tsx
const [manufacturer, setManufacturer] = useState('');
const [modelNumber, setModelNumber] = useState('');
const [manufacturedYear, setManufacturedYear] = useState<number | ''>('');
const [osId, setOsId] = useState<number | ''>('');
const [categoryId, setCategoryId] = useState<number | ''>('');
const [operatingSystems, setOperatingSystems] = useState<OperatingSystem[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
```

**3. Extend the `Promise.all` fetch** (lines 34–40) — add two entries:

```tsx
fetch('/api/operating-systems').then((r) => r.json()),
fetch('/api/categories').then((r) => r.json()),
```

Destructure the two new values and call `setOperatingSystems` / `setCategories`.

**4. Edit-mode hydration** — extend the `.then((c) => { ... })` block
(lines 48–58):

```tsx
setManufacturer(c.manufacturer || '');
setModelNumber(c.modelNumber || '');
setManufacturedYear(c.manufacturedYear ?? '');
setOsId(c.os?.id || c.osId || '');
setCategoryId(c.category?.id || c.categoryId || '');
```

**5. Submit body** — extend the `body` object (lines 73–85):

```tsx
manufacturer: manufacturer || null,
modelNumber: modelNumber || null,
manufacturedYear: manufacturedYear === '' ? null : Number(manufacturedYear),
osId: osId || null,
categoryId: categoryId || null,
```

**6. JSX — new form inputs**

Add a two-column Manufacturer / Model Number row above the existing Model input
(before the `<label>Model</label>` block). Reuse the `inputClass` constant and
the `grid grid-cols-1 sm:grid-cols-2 gap-4` wrapper already in the form.

Add a three-field row (Year / OS / Category) below the Serial/Service grid,
still using `inputClass`. OS and Category selects follow the same pattern as
the existing Site and Kit selects (map over state array, `parseInt` on change).

Manufacturer options match ComputerDetail.tsx exactly: blank, Dell, Lenovo,
Apple, HP, Other. Do not extract to a shared constant — that cleanup is
explicitly deferred per the issue.

### Testing Plan

Manual verification with Vite dev server (hot-reload, already running):

1. Open `http://localhost:5173/computers/new`.
2. Confirm all five fields render: Manufacturer select, Model Number text,
   Manufactured Year number, Operating System select (API-populated), Category
   select (API-populated).
3. Fill in: manufacturer = Dell, model number = OptiPlex 7090, year = 2023,
   select an OS and a category. Submit.
4. On the detail page, confirm all five values are displayed correctly.
5. Open `/computers/:id/edit` on the newly created computer. Confirm all five
   fields are pre-filled with the saved values.
6. Submit the edit form without changing anything — confirm values persist.
7. Check dev server console: no 500s or Prisma errors on POST/PUT.

### Documentation Updates

None required.
