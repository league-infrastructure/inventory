# MCP server missing delete_site tool

## Summary

There is no `delete_site` tool in the MCP server. Sites can't be
deactivated (see update_site missing isActive) or deleted.

## Safety Considerations

- Refuse to delete if kits are still assigned to the site
- Consider requiring the site to be deactivated first
