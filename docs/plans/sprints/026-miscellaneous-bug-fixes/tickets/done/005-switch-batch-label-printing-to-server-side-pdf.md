---
id: "005"
title: "Switch batch label printing to server-side PDF"
status: done
use-cases: []
depends-on: []
---

# Switch batch label printing to server-side PDF

## Description

Batch label printing currently uses an HTML endpoint that opens a popup
and calls `window.print()`. Users must manually set page size and
orientation in the browser print dialog every time.

Switch to the existing PDFKit-based `generateBatchLabels()` method which
produces a PDF with exact 102mm×59mm landscape pages. The browser's PDF
viewer handles sizing correctly so the user just hits print.

## Changes

1. **Server** (`server/src/routes/labels.ts`): Add `POST /api/labels/kit/:id/batch-pdf`
   endpoint that calls `generateBatchLabels()` and returns `application/pdf`.

2. **Client** (`client/src/components/LabelPrintModal.tsx`): Change `handlePrint()`
   to POST to the new PDF endpoint, receive as blob, and open in a new tab.

## Acceptance Criteria

- [x] Print modal sends request to batch-pdf endpoint
- [x] New tab opens with PDF in browser's viewer
- [x] PDF pages are 102mm×59mm landscape
- [x] Only selected labels appear in PDF
- [x] Existing label tests pass

## Testing

- **Existing tests**: `cd server && npx jest -- label` (11 tests)
