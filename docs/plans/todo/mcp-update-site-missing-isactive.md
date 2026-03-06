# MCP update_site tool missing isActive field

## Summary

The `update_site` MCP tool does not accept an `isActive` parameter, so
there is no way to deactivate a site through the MCP interface. The tool
currently only supports updating: `name`, `address`, `isHomeSite`,
`latitude`, and `longitude`.

## Expected Behavior

Calling `update_site` with `isActive: false` should deactivate the site.

## Impact

Cannot deactivate or soft-delete sites via MCP. Same class of bug as
`update_kit` missing `status`.
