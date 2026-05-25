---
id: '001'
title: Computer form & category UX
status: done
branch: sprint/001-computer-form-category-ux
use-cases:
- SUC-001
- SUC-002
- SUC-003
issues:
- add-missing-identity-fields-to-the-new-computer-form.md
- add-3d-printer-category-and-computer-list-category-filter.md
- edit-category-from-admin-category-list.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 001: Computer form & category UX

## Goals

Close three pending UX gaps in the Computer / Category admin flow:
1. The new-computer form is missing five identity fields that the server already accepts.
2. The computer list page does not show category or provide a category filter.
3. Category names in the admin panel are not clickable / editable.

## Problem

Quartermasters cannot record manufacturer, model number, manufacture year,
OS, or category when creating a new computer — they must open the edit page
afterward. The computer list gives no way to isolate 3D printers (or any
other category) from laptops and desktops. Admin category management is
add/delete only — renaming a category requires a database workaround.

## Solution

All three changes are pure client-side React additions against an existing
Express + Prisma backend. No new routes, no schema changes, no data
migrations are required.

- **Ticket 001** — Add the five missing identity fields to `ComputerForm.tsx`.
- **Ticket 002** — Add a Category column and category-filter dropdown to
  `ComputerList.tsx`.
- **Ticket 003** — Make category names clickable in `CategoriesPanel.tsx` and
  implement an inline edit form backed by `PUT /api/categories/:id`.

## Success Criteria

- A quartermaster can set manufacturer, model number, manufacture year, OS,
  and category when creating a new computer.
- The computer list page shows a Category column and a category-filter
  dropdown that narrows the visible rows.
- Clicking a category name in the admin panel opens an edit form; saving it
  persists the change via the existing API.

## Scope

### In Scope

- `client/src/pages/computers/ComputerForm.tsx` — five new fields.
- `client/src/pages/computers/ComputerList.tsx` — category column + filter.
- `client/src/pages/admin/CategoriesPanel.tsx` — clickable names + edit form.

### Out of Scope

- `studentUsername` / `studentPassword` on the create form (left to edit page).
- Moving the hardcoded manufacturer list to a shared constant.
- New server routes, schema changes, or data migrations.
- Category scoping issue (issue body item 4 — "add category to the new
  computer form") is handled by Ticket 001, not duplicated in Ticket 002.

## Test Strategy

All three tickets are pure UI changes with no state management complexity
beyond local React state. Manual verification in the running dev server
(Vite hot-reload) is sufficient:

- Create a new computer, confirm all five identity fields persist.
- Open the computer list, confirm category column and filter work.
- Rename a category in the admin panel, confirm persistence on reload.

## Architecture Notes

No new modules, no new dependencies, no new API surface. All changes are
confined to three existing React page components. See `architecture-update.md`
for the full (honest) architectural assessment.

## GitHub Issues

None linked yet.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, architecture)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | New computer form: manufacturer + identity fields | — |
| 002 | Computer list: category column + filter | 001 |
| 003 | Admin category list: edit category | — |
| 004 | Manufacturer entity: Prisma model, migration, and backfill script | — |
| 005 | Manufacturer server: routes, service, and Computer service/contracts update | 004 |
| 006 | Manufacturer client: ComputerForm and ComputerDetail API-driven selects | 005 |
| 007 | Manufacturer admin: add Manufacturers tab to CategoriesPanel | 005 |

Tickets 001–003 are done. Tickets 004–007 address issue
`make-manufacturer-a-first-class-entity.md`. Tickets 006 and 007 both depend
on 005 and can execute in parallel if desired; in serial order run 007 before
006 (admin panel is simpler and a good smoke-test of the server route).
Tickets execute in the order listed otherwise.
