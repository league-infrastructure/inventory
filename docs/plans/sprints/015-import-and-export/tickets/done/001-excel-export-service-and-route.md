---
id: "001"
title: "Excel export service and route"
status: done
use-cases: [UC-4.10]
depends-on: []
---

# Excel export service and route

## Description

Create ExportService that generates Excel workbooks with sheets for Sites, Kits, Packs, Items, Computers, and metadata. Add GET /api/export route.

## Acceptance Criteria

- [x] ExportService generates xlsx with all entity sheets
- [x] GET /api/export returns xlsx download
- [x] Headers styled, columns properly sized
- [x] Route requires authentication
