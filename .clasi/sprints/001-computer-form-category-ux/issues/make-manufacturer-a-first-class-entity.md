---
status: in-progress
sprint: '001'
tickets:
- 001-004
- 001-005
- 001-006
- 001-007
---

# Make Manufacturer a first-class entity

## Description

Manufacturer is currently a free `String?` column on the Computer
record, but in the UI it renders as a hardcoded dropdown (Dell, Lenovo,
Apple, HP, Other) duplicated in
[client/src/pages/computers/ComputerForm.tsx](../../client/src/pages/computers/ComputerForm.tsx)
and
[client/src/pages/computers/ComputerDetail.tsx](../../client/src/pages/computers/ComputerDetail.tsx).
There is no way to add a new manufacturer or rename one without a code
change. Other lookup-style fields (Category, Operating System) are
stored as their own Prisma models with `/api/categories` and
`/api/operating-systems` routes and an admin panel tab — Manufacturer
should follow that pattern.

## Scope

1. **Prisma model.** Add a `Manufacturer` model (id, name, createdAt,
   updatedAt, deletedAt for soft delete — match the Category /
   OperatingSystem shape). Generate a migration.

2. **FK on Computer + backfill.** Add `manufacturerId Int?` on the
   Computer model with a relation; deprecate the existing
   `manufacturer String?` column. Backfill: for each distinct non-null
   manufacturer string already in Computer rows, create a Manufacturer
   row and update the FK. Drop the string column in a follow-up
   migration once nothing reads it. The backfill must run cleanly even
   if some computers have null or empty-string manufacturer values.

3. **Server routes.** Add `/api/manufacturers` (list, create, update,
   delete) mirroring [server/src/routes/categories.ts](../../server/src/routes/categories.ts).
   Guard with `requireQuartermaster`.

4. **Computer contracts + service.** Update the Computer Prisma service
   and Zod contracts to accept `manufacturerId` on create and update,
   and return the related Manufacturer on read.

5. **Computer form.** Update `ComputerForm.tsx` to fetch
   `/api/manufacturers` and render Manufacturer as a select populated
   from the API (matching the Category and OS selects already there).
   Drop the hardcoded list.

6. **Computer detail page.** Update `ComputerDetail.tsx` similarly —
   fetch manufacturers and switch the `EditableCell` from a hardcoded
   options list to the API-populated list (matching how it handles
   `osId` and `categoryId` today).

7. **Admin panel.** Add a Manufacturer tab to the admin Categories
   panel. It should reuse the existing generic `EditableList`
   component, which already supports inline-edit after sprint 001 /
   ticket 003.

8. **Computer list.** Update the ComputerList page so the manufacturer
   column / filter (if added later) operates on the relation instead of
   the string column.

## Notes

- Multi-layer change: schema migration, backfill, server routes,
  frontend form + detail page + admin panel. Likely 1 ticket per layer
  (or 3–4 grouped tickets).
- This was discovered during sprint 001 review when the stakeholder
  noticed manufacturer was a dropdown with no edit path. The hardcoded
  list was a deliberate deferral at the time — sprint 001 added the
  field to the new-computer form using the existing
  ComputerDetail.tsx pattern. This issue picks up the deferred cleanup.
