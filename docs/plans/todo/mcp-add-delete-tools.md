# MCP server missing delete tools for kits, sites, and computers

## Summary

The MCP server has `delete_item` and `delete_pack` tools but no delete
tools for kits, sites, or computers. All entity types should have a
delete operation available.

## Safety Considerations

Delete operations should include safety checks:

- **Kits**: Refuse to delete if the kit still contains packs or computers.
  Consider requiring the kit to be RETIRED first.
- **Sites**: Refuse to delete if kits are still assigned to the site.
- **Computers**: Refuse to delete if the computer is assigned to a kit
  or has active checkouts.

Prefer retiring over deleting for audit trail purposes. Delete should be
for genuinely erroneous records (e.g., test data).
