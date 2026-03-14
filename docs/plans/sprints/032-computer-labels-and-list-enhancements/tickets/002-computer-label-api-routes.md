---
id: "002"
title: "Computer Label API Routes"
status: todo
use-cases:
  - SUC-001
  - SUC-002
  - SUC-003
depends-on:
  - "001"
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Computer Label API Routes

## Description

Add two new API routes for the 89×28mm computer label format:

1. `GET /api/labels/computer/:id/compact` — Generate and download a
   single 89×28mm computer label PDF
2. `POST /api/labels/computers/batch` — Generate and download a
   multi-page PDF for multiple computers (body: `{ computerIds: number[] }`)

Both routes require Quartermaster or Admin authentication, matching
existing label route patterns.

## Files to Modify

- `server/src/routes/labels.ts` — Add the two new routes

## Acceptance Criteria

- [ ] `GET /api/labels/computer/:id/compact` returns PDF with correct
      content-type and disposition headers
- [ ] Returns 404 if computer ID doesn't exist
- [ ] `POST /api/labels/computers/batch` accepts `{ computerIds: number[] }`
      and returns a multi-page PDF
- [ ] Returns 400 if computerIds is empty or missing
- [ ] Both routes require authentication (Quartermaster role)
- [ ] Routes follow existing patterns in labels.ts

## Testing

- **Existing tests to run**: `npm test`
- **New tests to write**: Integration tests for both endpoints — verify
  200 with valid IDs, 404 for missing computer, 400 for empty batch
- **Verification command**: `npm test`
