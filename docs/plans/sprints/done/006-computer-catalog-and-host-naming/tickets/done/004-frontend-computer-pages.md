---
id: '004'
title: Frontend Computer pages
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-003
- SUC-005
depends-on:
- '001'
---

# Frontend Computer pages

## Description

Create ComputerList, ComputerDetail, and ComputerForm pages following
the same patterns as the Kit pages. Add routes to App.tsx and a
"Computers" nav link to the Landing page.

## Acceptance Criteria

- [x] `ComputerList.tsx` shows all computers with disposition filter dropdown
- [x] List shows: host name (or ID), model, disposition badge, assigned Kit/Site
- [x] `ComputerDetail.tsx` shows all fields, QR code, host name, current assignment
- [x] Detail page has Edit button, disposition change controls
- [x] `ComputerForm.tsx` supports create and edit modes
- [x] Form includes host name picker (dropdown of available names + current if editing)
- [x] Form includes Kit/Site assignment selector
- [x] Form includes disposition selector
- [x] App.tsx routes: `/computers`, `/computers/new`, `/computers/:id`, `/computers/:id/edit`
- [x] Landing page includes "Computers" nav link (Quartermaster only)

## Testing

- **Existing tests to run**: `cd client && npx tsc --noEmit`
- **New tests to write**: None (client test framework not yet set up — Vitest + RTL are planned but not installed)
- **Verification command**: `cd client && npx tsc --noEmit`
