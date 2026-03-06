---
status: done
sprint: '010'
tickets:
- '011'
---
# MCP update_kit tool missing status field

## Summary

The `update_kit` MCP tool does not accept a `status` parameter, so there
is no way to retire a kit through the MCP interface. The tool currently
only supports updating: `containerType`, `description`, `name`, `number`,
and `siteId`.

## Expected Behavior

Calling `update_kit` with `status: "RETIRED"` should update the kit's
status in the database.

## Impact

Cannot retire kits via MCP, which blocks cleanup of test data and normal
lifecycle management of kits.
