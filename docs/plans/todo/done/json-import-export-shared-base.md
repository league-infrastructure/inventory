---
status: done
sprint: '021'
---
# JSON import/export with shared base code

## Summary

Refactor the Excel import/export system so the core read/write/map logic
is format-agnostic, then add JSON as a second format.

1. **Refactor base code** — extract the core import/export logic from
   the Excel-specific implementation into a shared base that both
   formats use. A fundamental change to one format's mapping should
   change the other.
2. **JSON export** — full inventory dump to JSON.
3. **JSON import** — restore inventory from a JSON dump.
4. **Admin UI** — update the admin Import/Export page with separate
   Excel and JSON sections.
