---
status: done
sprint: '014'
---
# Label printing UI from Kit detail page

## Summary

Add a "Print Labels" button to the Kit detail page. When clicked, a
modal dialog appears with checkboxes for each printable label:

- One checkbox for the kit label itself
- One checkbox for each pack in the kit

The dialog should have "Select All" and "Clear All" controls so the
user can quickly toggle all checkboxes. By default all items are
checked.

When the user confirms, the system generates a PDF containing the
selected labels (large format only) and sends it to the browser's
native print dialog.
