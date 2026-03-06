---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 014 Technical Plan

## Architecture Overview

Uses pdfkit for server-side PDF generation with QR codes from the
qrcode library. Labels are Dymo large shipping format (59mm x 102mm).

## Component Design

### Component 1: LabelService
- Generates single kit/pack/computer label PDFs
- Generates batch PDFs with multiple labels
- Uses pdfkit for PDF and qrcode for QR generation

### Component 2: Label Routes
- GET /api/labels/kit/:id, /pack/:id, /computer/:id
- POST /api/labels/kit/:id/batch with packIds selection

### Component 3: Label Print Modal
- React modal with checkbox list for kit + packs
- Select All / Clear All controls
- Opens generated PDF in browser print dialog
