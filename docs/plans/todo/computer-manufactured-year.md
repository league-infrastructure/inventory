---
status: pending
---

# Add a manufactured year field for computers

Add a `manufacturedYear` integer field to the Computer model to track
when the device was manufactured. This helps assess device age
independently of when it was received or acquired.

## Details

- New nullable `Int` field on the Computer table
- Editable on the computer detail page (in the identity fields section)
- Exposed via MCP tools (create/update computer)
- Useful for depreciation calculations and lifecycle planning
