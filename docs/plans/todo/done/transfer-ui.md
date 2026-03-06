---
status: done
sprint: 019
---

# Transfer UI — modal and action buttons

## Description

Add a transfer modal and transfer buttons throughout the UI so users
can quickly transfer kits and computers to a new custodian and/or site.

### Transfer modal

A popup/modal that allows setting:

- **Custodian** — select admin or a specific user.
- **Site** — select a site (optional; becomes "floating" if not set).

The modal is used from multiple entry points (list rows, detail pages).

### Transfer button on list rows

The last column of kit and computer lists should include action
buttons. One of these is the **Transfer** button, which opens the
transfer modal for that item.

### Transfer button on detail/edit pages

The computer edit page (and kit detail page) currently has no way to
initiate a transfer. Add a transfer button that opens the same modal.

### Checked-out / transferred-out page

The current "Checked Out" page should show both computers and kits
that are currently transferred out (custodian is not admin). Display
them in two separate lists.
