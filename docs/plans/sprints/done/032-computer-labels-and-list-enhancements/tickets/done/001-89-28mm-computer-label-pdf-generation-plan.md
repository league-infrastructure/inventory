---
ticket: "001"
---

# Plan: 89×28mm Computer Label PDF Generation

## Approach

Add two new methods to `LabelService`:

1. `generateComputerLabel89x28(computerId)` — single compact label
2. `generateComputerBatchLabels(computerIds)` — multi-page PDF

The new label uses a different page size (89mm × 28mm) from the existing
59mm × 102mm format. The layout is:

```
┌────────┬────────────────────────────────────────┐
│        │ 🏴 The League Of Amazing Programmers    │
│  [QR]  │ jointheleague.org  (858) 284-0481      │
│  full  │────────────────────────────────────────│
│ height │ HOSTNAME                  (large font) │
│        │ user: xxx  pass: xxx                   │
│        │ SN: serial-number         (small text) │
└────────┴────────────────────────────────────────┘
```

## Key Design Decisions

- New page size constants: `COMPACT_WIDTH_PT` (89mm) and `COMPACT_HEIGHT_PT` (28mm)
- QR code is square, full label height minus margins (~24mm)
- Reuse existing `drawFlagLogo()` at smaller scale
- Reuse existing `generateQrBuffer()` for QR generation
- The existing `generateComputerLabel()` (59×102mm) remains unchanged

## Files to Modify

- `server/src/services/label.service.ts`

## Testing

- Verify PDF buffer is generated (non-empty)
- Verify batch generates correct number of pages
- Verify graceful handling of missing hostname, credentials, serial
