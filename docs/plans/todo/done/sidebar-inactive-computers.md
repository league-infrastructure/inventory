---
status: done
sprint: '010'
tickets:
- '017'
---
# Sidebar entry for inactive computers (lost, scrapped, decommissioned)

## Summary

Add a sidebar entry below "Hosts" that shows computers with non-ACTIVE
dispositions: LOST, SCRAPPED, DECOMMISSIONED, and NEEDS_REPAIR. These
computers currently disappear from the main view with no way to find
or restore them.

## Behavior

- Sidebar link (e.g., "Inactive Computers") below Hosts
- Lists all computers where disposition is not ACTIVE
- Each entry shows the disposition status and allows restoring the
  computer back to ACTIVE
- Same pattern as the retired kits view — a way to recover things that
  have been set aside

## Dispositions (from schema)

- ACTIVE (default — shown in main Computers view)
- NEEDS_REPAIR
- SCRAPPED
- LOST
- DECOMMISSIONED
