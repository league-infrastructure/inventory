---
status: done
sprint: '022'
tickets:
- '003'
---

# Enforce single home site constraint

Multiple sites can currently have `isHomeSite: true` simultaneously.
There is no validation preventing this, which undermines the concept
of a single home site.

## Problem

Calling `create_site` or `update_site` with `isHomeSite: true` succeeds
even when another site already has that flag set. The system should have
exactly zero or one home site at any time.

## Proposed fix

In `SiteService.create()` and `SiteService.update()`, when
`isHomeSite: true` is being set:

1. Clear `isHomeSite` on all other sites first (`updateMany` where
   `isHomeSite: true` and `id != currentId`), **or**
2. Reject the operation with a `ValidationError` if another home site
   already exists.

Option 1 (auto-clear) is likely more practical for typical usage.
