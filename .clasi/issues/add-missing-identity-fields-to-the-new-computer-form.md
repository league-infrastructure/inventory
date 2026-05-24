---
status: pending
---

# Add missing identity fields to the New Computer form

## Context

The new-computer form ([client/src/pages/computers/ComputerForm.tsx](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx)) is leaner than the edit form on the computer detail page. The user reported that **Manufacturer** is missing — and on audit, four other identity fields that *are* editable on the detail page are also missing from the create form: `modelNumber`, `manufacturedYear`, operating system (`osId`), and category (`categoryId`).

Audit summary (from exploration):

| Field | Computer model | New form | Edit page | Server accepts |
|---|---|---|---|---|
| `manufacturer` | yes | **no** | yes | yes |
| `modelNumber` | yes | **no** | yes | yes |
| `manufacturedYear` | yes | **no** | yes | yes |
| `osId` | yes | **no** | yes | yes |
| `categoryId` | yes | **no** | yes | yes |

The server contracts and service ([server/src/contracts/computer.ts](/Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/contracts/computer.ts), [server/src/services/computer.service.ts:64-161](/Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/services/computer.service.ts#L64-L161)) already accept these on `POST /api/computers`. **This is a pure UI fix** — no schema, route, or service changes needed.

Scope (per user): add **manufacturer + the four other identity fields**. Defer `studentUsername` / `studentPassword` — those tend to be set later in a kit-prep step, so leaving them on the edit page only is fine.

## Files to modify

- [client/src/pages/computers/ComputerForm.tsx](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx) — the only file that needs changes.

## Changes

### 1. State additions (after [line 25](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L25))

```tsx
const [manufacturer, setManufacturer] = useState('');
const [modelNumber, setModelNumber] = useState('');
const [manufacturedYear, setManufacturedYear] = useState<number | ''>('');
const [osId, setOsId] = useState<number | ''>('');
const [categoryId, setCategoryId] = useState<number | ''>('');

const [operatingSystems, setOperatingSystems] = useState<{ id: number; name: string }[]>([]);
const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
```

Add matching interfaces near [lines 4-6](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L4-L6).

### 2. Reference data fetch (extend the `Promise.all` at [lines 34-40](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L34-L40))

Add two more endpoints, matching the pattern used in [ComputerDetail.tsx:82-83](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerDetail.tsx#L82-L83):

```tsx
fetch('/api/operating-systems').then((r) => r.json()),
fetch('/api/categories').then((r) => r.json()),
```

### 3. Edit-mode hydration (extend block at [lines 48-58](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L48-L58))

```tsx
setManufacturer(c.manufacturer || '');
setModelNumber(c.modelNumber || '');
setManufacturedYear(c.manufacturedYear ?? '');
setOsId(c.os?.id || c.osId || '');
setCategoryId(c.category?.id || c.categoryId || '');
```

### 4. Submit body (extend object at [lines 73-85](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L73-L85))

```tsx
manufacturer: manufacturer || null,
modelNumber: modelNumber || null,
manufacturedYear: manufacturedYear === '' ? null : Number(manufacturedYear),
osId: osId || null,
categoryId: categoryId || null,
```

### 5. New inputs in the form JSX

Add a row above the existing **Model** input ([line 122](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L122)) for Manufacturer + Model Number, and a row below the Serial/Service grid for Manufactured Year + Operating System + Category.

- **Manufacturer**: `<select>` with the same five hardcoded options used on the edit page ([ComputerDetail.tsx:290-297](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerDetail.tsx#L290-L297)) — `''/Dell/Lenovo/Apple/HP/Other`. Keep the option list co-located here for now (it matches the current edit-page pattern). If the list grows, factor it into a shared constant later.
- **Model Number**: `<input>` (text), mirroring **Model**.
- **Manufactured Year**: `<input type="number">`.
- **Operating System**: `<select>` populated from `operatingSystems`, with a `None` option, identical pattern to the existing Site/Kit selects.
- **Category**: `<select>` populated from `categories`, same pattern.

Reuse the existing `inputClass` constant ([line 108](/Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerForm.tsx#L108)) and the existing two-column `grid grid-cols-1 sm:grid-cols-2 gap-4` wrapper.

## Verification

1. **Dev server is already running** (npm run dev). After saving the file, Vite will hot-reload.
2. Open `http://localhost:5173/computers/new` in the browser.
3. Confirm the five new fields render: Manufacturer (select), Model Number (text), Manufactured Year (number), Operating System (select), Category (select). The OS and Category selects should populate from the API.
4. Fill in manufacturer = "Dell", model = "OptiPlex 7090", manufactured year = 2023, and pick an OS + category. Submit.
5. After redirect to the detail page, confirm those five values are visible and persisted.
6. Edit an existing computer via `/computers/:id/edit`. Confirm the five new fields hydrate with the saved values and that round-tripping (no edits) preserves them.
7. Check the dev server log — no Prisma errors, no 500s on POST/PUT `/api/computers`.

## Out of scope

- `studentUsername` / `studentPassword` — left to the edit page for now (user direction).
- Moving the hardcoded manufacturer list to a shared constant — separate cleanup; both forms use the same list inline today.
- Server-side changes — none needed; contracts already accept all five fields.
