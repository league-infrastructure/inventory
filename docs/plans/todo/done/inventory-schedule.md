---
status: done
sprint: '020'
---

# Configurable inventory check schedule

## Description

Add an admin-configurable schedule for how often items need to be
inventoried. When an item is overdue, show a "Check Inventory" button
in the list view.

### Configuration

- Admin setting for inventory interval (default: 60 days).
- Stored in the Config table or as a dedicated admin setting.

### Overdue detection

Compare each item's `lastInventoried` timestamp against the configured
interval. If the item has never been inventoried or the interval has
elapsed, it is overdue.

### Check Inventory button

The button appears in the last column of kit and computer list rows
only when the item is overdue. Clicking it opens the existing
inventory check flow.
