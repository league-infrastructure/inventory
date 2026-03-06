---
status: done
sprint: '010'
tickets:
- '014'
---
# Checkout should not require a destination site

## Summary

When a kit is checked out, it's with a person — the destination site is
irrelevant. The current checkout flow requires a `destinationSiteId`,
but it shouldn't.

## New Model

- Every kit has a "where" — displayed in the kit list
- If the kit is **not checked out**, "where" is the site (a physical
  location like "Busboom Storage")
- If the kit **is checked out**, "where" is the person who has it
  (e.g., "Eric Busboom")
- On **check-in**, the user specifies which site it's being returned to
  — that becomes the new "where"

## Changes Required

- Remove `destinationSiteId` from the checkout flow (MCP tool, API, UI)
- Kit list column: rename "Site" to "Where"
- Display logic: show site name when not checked out, person name when
  checked out
- Check-in flow stays the same — user picks the return site
