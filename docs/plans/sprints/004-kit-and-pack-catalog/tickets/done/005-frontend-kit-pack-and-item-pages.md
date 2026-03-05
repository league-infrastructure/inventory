---
id: "005"
title: "Frontend Kit, Pack, and Item pages"
status: done
use-cases:
  - SUC-001
  - SUC-002
  - SUC-003
  - SUC-004
  - SUC-005
depends-on:
  - "001"
  - "002"
  - "003"
  - "004"
---

# Frontend Kit, Pack, and Item pages

## Description

Build the React frontend pages for Kit, Pack, and Item management.
This includes list views, detail views with hierarchy display,
create/edit forms, and the Clone Kit flow.

## Acceptance Criteria

- [x] Kit list page (`/kits`) shows all Kits with name, site, status, and link to detail
- [x] Kit detail page (`/kits/:id`) shows Kit info, Packs accordion, Items within each Pack
- [x] Kit detail shows QR code (rendered as image from data URL)
- [x] Kit detail has "Clone Kit" button (Quartermaster only) that triggers clone and navigates to new Kit
- [x] Kit create form with name, description, and site dropdown
- [x] Kit edit form pre-populated with current values
- [x] Pack create/edit form accessible from Kit detail
- [x] Item create/edit form accessible from Pack detail, with type selector and conditional quantity field
- [x] Navigation updated: "Kits" link in the landing page nav for authenticated users
- [x] All forms show validation errors from the API
- [x] App.tsx updated with routes for `/kits`, `/kits/:id`, `/kits/new`, `/kits/:id/edit`

## Testing

- **Existing tests to run**: `cd client && npx tsc --noEmit`
- **New tests to write**: Component rendering tests for Kit list and detail
- **Verification command**: `cd client && npx tsc --noEmit`
