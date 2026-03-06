---
id: "021"
title: "Import/Export Refactor and Database Backup"
status: planning
branch: sprint/021-import-export-refactor-and-database-backup
use-cases: []
---

# Sprint 021: Import/Export Refactor and Database Backup

## Goals

Refactor the import/export system to share core logic across formats,
add JSON as a second format, and add database backup/restore via
pg_dump with admin UI controls.

## Problem

The current import/export system is tightly coupled to the Excel format.
Adding new formats requires duplicating mapping logic. There is no
database backup capability — if data is lost, there is no way to
restore from a point-in-time snapshot.

## Solution

1. **Shared import/export base** — Extract format-agnostic read/write/map
   logic from the Excel implementation. Both Excel and JSON formats use
   the shared base, so changes to field mappings apply to both.
2. **JSON export** — Full inventory dump to JSON.
3. **JSON import** — Restore inventory from a JSON dump.
4. **Admin UI for import/export** — Update the admin Import/Export page
   with separate Excel and JSON sections.
5. **Backup service** — Implement pg_dump-based backup writing to a
   shared Docker volume.
6. **Admin backup UI** — Trigger backup, list backups, restore from
   backup.

## Success Criteria

- Import/export core logic is format-agnostic; Excel and JSON both use it.
- JSON export produces a complete inventory dump.
- JSON import restores inventory from a dump.
- Admin can trigger, list, and restore database backups.
- Backup files are stored on a shared Docker volume.

## Scope

### In Scope

- Refactor import/export into shared base + format-specific adapters.
- JSON import and export.
- Admin UI updates for import/export (Excel and JSON sections).
- Docker shared volume for backups (dev: host-mounted, prod: named volume).
- BACKUP_PATH env var in dev and prod secrets.
- Backup service using pg_dump.
- Admin backup management UI (trigger, list, restore).

### Out of Scope

- Transfer model changes (Sprint 019).
- List view changes (Sprint 020).
- Automatic scheduled backups (manual trigger only for now).

## Test Strategy

- Service tests for shared import/export logic with both formats.
- Round-trip tests: export → import → verify data matches.
- Backup service tests (mock pg_dump or use test database).
- Admin UI integration tests for backup management.

## Architecture Notes

- Shared base class or module with abstract format adapters.
- JSON format maps directly to contract types for clean round-tripping.
- Backup uses pg_dump with --format=custom for efficient storage and
  selective restore.
- Restore uses pg_restore; requires confirmation in the UI.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
