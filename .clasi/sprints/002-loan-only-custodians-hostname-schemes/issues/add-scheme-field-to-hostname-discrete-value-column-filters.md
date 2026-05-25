---
status: in-progress
sprint: '002'
tickets:
- 002-002
---

# Add `scheme` field to HostName + discrete-value column filters

## Context

The stakeholder is expanding the inventory beyond laptops to 3D printers,
and is using different naming conventions for each ("computer scientists"
for laptops, "computer graphics terms" for 3D printers). They want to
track which **naming universe** a HostName belongs to — a free-text
field called `scheme` — so they can sort and filter the hostnames list
by it and select the next available name from a specific scheme when
assigning a new device.

There's also a printing workflow gap: labels are printed before the
scheme is known on the record, so admins need to fill in scheme
retroactively. They've confirmed there is **no bulk update** — the MCP
server agent (an LLM client) will call the per-record update tool
multiple times.

Sibling ask: the existing hostnames list has per-column text filters
but no way to filter status (assigned/available) or scheme (distinct
values). The user wants a "search icon → dropdown of values" pattern on
those two columns.

## What changes

### Server

- **Prisma model** ([server/prisma/schema.prisma](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/prisma/schema.prisma) lines 243–251) — add `scheme String?` to HostName. No unique constraint (multiple names share a scheme). No index needed at this scale; can add later if filtering gets slow.
- **Migration** — additive only.
- **Contracts** ([server/src/contracts/hostName.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/contracts/hostName.ts)) — `HostNameRecord` gains `scheme: string | null`; introduce `UpdateHostNameInput { name?: string; scheme?: string | null }` (today the service accepts the inline shape only).
- **Service** ([server/src/services/hostname.service.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/services/hostname.service.ts)) — `create()` and `update()` accept `scheme`; add `'scheme'` to `auditFields`.
- **Routes** ([server/src/routes/hostnames.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/routes/hostnames.ts)) —
  - Existing POST `/hostnames` accepts `scheme` in the body.
  - Add **PUT `/hostnames/:id`** (currently the route file has no update endpoint — the service has the method, but no HTTP wiring). Guarded by `requireQuartermaster`.
  - Add **GET `/hostnames/schemes`** returning the distinct non-null schemes (`prisma.hostName.findMany({ select: { scheme: true }, distinct: ['scheme'], where: { scheme: { not: null } } })`). Used for the edit autocomplete and the column filter dropdown.
- **MCP tools** ([server/src/mcp/tools.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/mcp/tools.ts) lines 468–505) —
  - Extend `create_hostname` input schema with `scheme: z.string().optional()`.
  - Extend `update_hostname` input schema: rename to support both `name` and `scheme` as optional fields (at least one required). Update the corresponding service call. The MCP agent calls this once per record — no bulk variant.

### Client

- **Names list page** ([client/src/pages/computers/HostNameList.tsx](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/HostNameList.tsx)) —
  - Add a **Scheme** column with `SortableHeader` (sortable, filterable via the new discrete-value mode).
  - Switch the **Status** column from plain text to a `SortableHeader` with the discrete-value filter — values `'Assigned'` and `'Available'`. Backed by an enriched `_status` field on each row (`h.computerId ? 'Assigned' : 'Available'`).
  - Add **inline edit** for both `name` and `scheme` (mirror the inline-edit pattern from [client/src/pages/admin/CategoriesPanel.tsx](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/admin/CategoriesPanel.tsx)'s `EditableList` — added by sprint 001 ticket 003). The scheme field's edit input uses a native `<datalist>` populated from `GET /api/hostnames/schemes` for type-ahead.
- **SortableHeader extension** ([client/src/components/SortableHeader.tsx](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/components/SortableHeader.tsx)) — add a `filterMode?: 'text' | 'discrete'` prop and a `discreteOptions?: string[]` prop. When `discrete`, the search icon reveals a `<select>` instead of a text input. The selected value still flows through the existing `onFilter(key, value)` callback and `useTableSort`'s string-match filter (an exact-string `select` value will still match via the existing `includes` filter). No change needed in [client/src/lib/useTableSort.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/lib/useTableSort.ts).
- **HostName interface** in the list file — `scheme: string | null` and the enriched `_status` field.

## Verification

End-to-end against the running dev server:

1. **Schema** — `prisma migrate dev` runs cleanly. `psql` shows the new `scheme` column on `HostName`.
2. **Create with scheme** — POST `/api/hostnames` with `{ name: "Knuth", scheme: "computer scientists" }`. GET `/api/hostnames` returns the new row with `scheme`.
3. **Distinct schemes endpoint** — GET `/api/hostnames/schemes` returns the deduplicated list.
4. **MCP tools** — from any MCP client (e.g., Claude itself with the inventory MCP loaded), call `update_hostname({id, scheme: "computer graphics terms"})` on an existing row. Confirm the update persists. Also call `create_hostname({name: "Phong", scheme: "computer graphics terms"})`.
5. **Inline edit** — open the names list. Click a name to enter edit mode; confirm both the name input and a scheme input appear, the scheme input shows a datalist of existing schemes, and typing a new value creates it. Press Enter — record persists.
6. **Sort by scheme** — click the Scheme column header; rows sort.
7. **Filter by scheme** — click the search icon on the Scheme header. Confirm a dropdown of distinct schemes (no text input). Select "computer scientists" — list narrows.
8. **Filter by status** — click the search icon on the Status header. Confirm dropdown shows "Assigned" / "Available". Select "Available" — list narrows.
9. **Typecheck + tests** — `tsc --noEmit` clean in server and client.

## Implementation outline (suggested ticket breakdown)

Likely 3 tickets:

1. **Schema + server + MCP foundation.** Prisma scheme column + migration; contracts; service updates; PUT route; GET `/hostnames/schemes`; both MCP tool schema updates.

2. **SortableHeader discrete-filter mode.** Extend the component with `filterMode: 'text' | 'discrete'` and `discreteOptions` prop. Standalone change so it can be reused beyond hostnames (manufacturer, category, disposition, etc. — the existing manufacturer filter on ComputerList could later use this).

3. **HostName list page UX.** Add Scheme column, switch Status to discrete filter, add inline edit with datalist autocomplete on scheme.

## Out of scope

- Bulk MCP update tools. The MCP agent loops over individual updates.
- Migrating existing computers' implicit "scheme" (current naming convention) into the new column — backfill happens by the MCP agent once it's wired up.
- Adding `scheme` to label printing output — labels still show only `name`. Future polish.
- Index on `scheme` — defer until row count justifies it.
- The unique constraint on `scheme` — the field is intentionally free-text.
