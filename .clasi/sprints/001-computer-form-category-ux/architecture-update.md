---
sprint: '001'
status: final
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Architecture Update -- Sprint 001: Computer form & category UX

## What Changed

Three existing React page components receive additive UI changes. No new
modules, routes, services, or database objects are introduced.

| Component | Change |
|-----------|--------|
| `client/src/pages/computers/ComputerForm.tsx` | Five new form fields (manufacturer, modelNumber, manufacturedYear, osId, categoryId) with matching state, fetch calls, hydration, and submit payload additions. |
| `client/src/pages/computers/ComputerList.tsx` | Category column added to the table; category-filter dropdown added alongside the existing disposition filter. Client-side filter applied to the already-fetched computer list. |
| `client/src/pages/admin/CategoriesPanel.tsx` | The `EditableList` component (or a replacement for the categories tab) gains inline-edit behaviour: clicking a name enters an edit mode; saving issues `PUT /api/categories/:id`. |

All three server-side elements required by these changes already exist:
- `GET /api/operating-systems` — used by ComputerForm for OS dropdown.
- `GET /api/categories` — used by ComputerForm and ComputerList.
- `PUT /api/categories/:id` — used by CategoriesPanel inline edit.
- `POST /api/computers` and `PUT /api/computers/:id` — already accept all
  five identity fields in their request contracts.

## Why

The create-computer form was created without the identity fields that the
edit page already exposes, leaving quartermasters unable to record
manufacturer, model, year, OS, or category at creation time. The computer
list lacks category visibility, making 3D printers indistinguishable from
laptops. The admin category panel offers no rename path, forcing workarounds.

These gaps were identified in three separate issues raised by the stakeholder
(see `issues:` in sprint.md).

## Component Diagram

```mermaid
graph LR
    subgraph Client
        CF[ComputerForm]
        CL[ComputerList]
        CP[CategoriesPanel / EditableList]
    end

    subgraph API["Express API (unchanged)"]
        COMP[/api/computers]
        OS[/api/operating-systems]
        CAT[/api/categories]
    end

    CF -->|GET| OS
    CF -->|GET| CAT
    CF -->|POST/PUT| COMP

    CL -->|GET| COMP
    CL -->|GET| CAT

    CP -->|GET| CAT
    CP -->|PUT| CAT
```

All edges already existed; the new edges are the two `GET /api/categories`
calls from `ComputerForm` and `ComputerList`, and the `PUT /api/categories/:id`
call from `CategoriesPanel`. The API nodes are drawn for clarity but are
**not changed** in this sprint.

## Impact on Existing Components

- **ComputerForm**: Additive state and JSX only. Existing fields and submit
  path are untouched.
- **ComputerList**: Additive column and filter. Existing sort, pagination,
  batch-print, and transfer behaviour are untouched.
- **CategoriesPanel / EditableList**: The categories tab gains inline-edit
  state. The other three tabs (Operating Systems, Container Types,
  Dispositions) are unaffected.
- **Server**: No changes.

## Migration Concerns

None. All changes are purely additive UI additions against an already-live
backend. No data migration, no deployment sequencing concern, no breaking
change to any existing interface.

## Design Rationale

**Client-side category filter (ComputerList)**: The computer list already
fetches all computers matching the disposition filter from the server. Adding
a category filter client-side (against the already-fetched set) is consistent
with how column-level text filters are already handled via `useTableSort`.
Adding a server-side `?category=` query parameter would be the correct choice
if the list were paginated or the dataset were large. For a fleet of hundreds
of computers (not thousands), client-side filtering is adequate and avoids a
server round-trip. If the dataset grows significantly, a server-side filter
parameter can be added later without changing the UI contract.

**Inline edit for CategoriesPanel**: The admin panel is a simple admin-only
utility page. An inline "click to edit" pattern (similar to a row entering
edit mode) keeps the user on the same page and avoids routing complexity. A
separate `/admin/categories/:id/edit` route would be overengineering for a
panel with ~10 entries.

**No shared manufacturer constant**: The issue explicitly defers this cleanup
to a future ticket. The manufacturer list is inlined in ComputerForm matching
the existing pattern on ComputerDetail.

## Open Questions

None. All required API endpoints exist, server contracts are confirmed, and
scope is tightly bounded.
