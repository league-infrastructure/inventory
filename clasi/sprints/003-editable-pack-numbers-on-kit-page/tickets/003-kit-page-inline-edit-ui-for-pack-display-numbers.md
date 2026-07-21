---
id: '003'
title: Kit page inline-edit UI for pack display numbers
status: open
use-cases: [SUC-001, SUC-002]
depends-on: ['002']
github-issue: ''
issue: editable-pack-numbers-on-kit-page.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Kit page inline-edit UI for pack display numbers

## Description

Show each pack's `displayNumber` in the kit page's pack list and make it
inline-editable via number entry, using the existing `EditableCell`
component (already used on this page for pack `name`/`description` and
item fields) rather than introducing a new inline-edit pattern.
Drag-to-reorder is explicitly out of scope (issue requirement 2).

Because a single edit can renumber multiple packs (ticket 002's
endpoint returns the whole kit's renumbered pack list, not one row), the
client must replace its entire `packs` array from the response — not
patch just the edited pack — to avoid showing stale numbers on the
other packs.

## Acceptance Criteria

- [ ] `client/src/pages/kits/KitDetail.tsx`'s `Pack` interface gains
      `displayNumber: number`.
- [ ] Each pack in the pack list displays its `displayNumber` (e.g.
      "Pack 4 — <name>"), in ascending `displayNumber` order (the kit
      fetch already returns packs in this order per ticket 001's
      `orderBy` change — no client-side re-sort needed).
- [ ] The displayed number is wrapped in `EditableCell` with `as=
      "number"`, consistent with how `item.expectedQuantity` is already
      edited on this page.
- [ ] A new `handleRenumberPack(packId: number, displayNumber: number)`
      calls `PATCH /packs/:id/renumber` with `{ displayNumber }` and, on
      success, replaces the entire `packs` state array with the
      response body (do **not** merge/patch a single pack's field like
      the existing `handleUpdatePack` does for name/description — the
      response reflects every pack's current number).
  - [ ] On non-2xx response, surface the error (matching this page's
        existing `saveError`/inline-error conventions) and leave
        `packs` state unchanged.
- [ ] Manual verification: editing a pack's number to a value held by
      another pack visibly renumbers the whole list per the
      stakeholder's examples (7→4 and 3→6), matching ticket 001/002's
      server-side behavior.

## Testing

- **Existing tests to run**: this repo's client test suite, if any
  covers `KitDetail.tsx` (check `client/` for a test runner config;
  the sprint's stated test conventions are server-focused — confirm
  whether client tests exist before assuming none are needed).
- **New tests to write**: a client-level test (or, if no client test
  harness exists for this page, a manual verification step recorded in
  this ticket's completion notes) exercising: display of
  `displayNumber`, entering edit mode via click, committing a new
  number, and the pack list re-rendering with the full renumbered set
  from the response.
- **Verification command**: run the project's existing client build/
  test command (see `client/package.json` scripts) if a test harness
  exists; otherwise perform manual verification via the app in a dev
  environment against a kit with several packs, covering both
  stakeholder examples.

## Documentation Updates

- None required — this is a UI-only change to an existing page pattern
  already documented implicitly by `EditableCell`'s existing usage.
