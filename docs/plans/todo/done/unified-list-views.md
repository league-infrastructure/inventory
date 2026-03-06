---
status: done
sprint: '020'
---

# Unified list views for kits and computers

## Description

Kit and computer list views should be parallel — same layout, same
column structure, same action buttons in the last column.

### Consistent layout

Both lists should display items in a table with action buttons in
the last column. The lists should look and behave the same way.

### Action buttons per row

Each row gets buttons in the last column:

- **Transfer** — opens the transfer modal for that item.
- **Check Inventory** — opens the inventory check flow (only shown
  when the item is overdue for inventorying).

### Search results reuse the same component

When a user searches (e.g., "bag 10"), the search results should
render using the same list component with the same action buttons.
This means the user can transfer or check inventory directly from
search results without navigating to a detail page.
