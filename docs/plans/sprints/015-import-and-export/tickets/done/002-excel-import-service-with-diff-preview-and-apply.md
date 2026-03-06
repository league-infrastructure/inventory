---
id: "002"
title: "Excel import service with diff preview and apply"
status: done
use-cases: [UC-4.9]
depends-on: ["001"]
---

# Excel import service with diff preview and apply

## Description

Create ImportService that parses uploaded Excel files, diffs against DB state, and applies approved changes with audit logging.

## Acceptance Criteria

- [x] parseAndDiff parses Kits and Items sheets
- [x] applyImport updates records and writes audit log
- [x] POST /api/import/preview returns diff array
- [x] POST /api/import/apply applies changes
- [x] Routes require authentication
