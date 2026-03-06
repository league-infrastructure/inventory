---
id: "014"
title: "Checkout flow remove destination site requirement"
status: todo
use-cases: []
depends-on: []
---

# Checkout flow remove destination site requirement

## Description

When a kit is checked out, it is with a person — the destination site is
irrelevant. The current checkout requires a `destinationSiteId` but
shouldn't. The kit's "where" is either a physical site (when not checked
out) or a person (when checked out).

## Changes

- Remove `destinationSiteId` from checkout (MCP tool, API, UI)
- Kit list: rename "Site" column to "Where"
- Display site name when not checked out, person name when checked out
- Check-in flow unchanged — user picks the return site

## Acceptance Criteria

- [ ] `checkout_kit` MCP tool no longer requires `destinationSiteId`
- [ ] Checkout API endpoint updated
- [ ] Kit list shows "Where" column with site or person name
- [ ] Check-in still requires return site
- [ ] Tests updated for new checkout signature

## Testing

- **Existing tests to run**: `npm run test:server` (checkout tests)
- **New tests to write**: Updated checkout tests, "Where" display logic
- **Verification command**: `npm run test:server`
