---
type: todo
status: pending
priority: medium
---

# Migrate people stored as Sites to Custodians

## Problem

Several entries in the `Site` table are actually people, not physical
locations. This causes them to display with building icons instead of
person icons in the UI.

**Sites that are people (need migration):**
- Alfred (site id 3)
- Jed (site id 4)
- Osvaldo (site id 5)
- Busboom (site id 2)

**Sites that are buildings (correct):**
- Carmel Valley (site id 1)

**Placeholder:**
- Unknown (site id 6)

## Impact

Kits and computers assigned to these "person-sites" show a building
icon in the Where column instead of a person icon. The custody model
treats `custodian` (User) as "who has it" and `site` as "where it is
physically," but these records blur that distinction.

## Options

A. **Create User records** with placeholder googleId/email so they can
   be assigned as custodians. Re-assign kits/computers from siteId to
   custodianId. Delete the fake site records.

B. **Add an external custodian concept** — a lightweight person record
   that doesn't require login credentials. Link kits/computers to
   external custodians.

C. **Add a `type` field to Site** (e.g., `LOCATION` vs `PERSON`) and
   adjust icon logic accordingly. Simpler but muddies the data model.

## Notes

Approach needs stakeholder decision before implementation.
