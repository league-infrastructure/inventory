---
status: pending
---

# Protect scheduled backups from manual deletion

Daily and weekly backups should not be deletable by users through the
UI or API. Only ad-hoc backups can be manually deleted. Scheduled
backups are managed by the automatic rotation system, which handles
their lifecycle and cleanup.

The backup delete endpoint and UI delete button should check the
backup filename prefix (e.g., `daily-`, `weekly-`) and reject deletion
requests for non-adhoc backups.
