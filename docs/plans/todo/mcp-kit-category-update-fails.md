---
status: pending
---

# MCP server often fails to update kit category

When the MCP server is asked to change a category on a Kit, it frequently
gets it wrong or fails to apply the change. It has worked sometimes, but
fails often enough to be a real problem.

## Investigation areas

- Check how `categoryId` is handled in the `update_kit` MCP tool — it uses
  `zIdParam()` which accepts number, null, or string. Verify the value
  coming from the MCP client is being coerced correctly.
- Check whether the `kits.update` service function actually persists
  `categoryId` when passed — it may be filtered out or ignored.
- Check whether the MCP client (Claude Desktop) is sending the category
  database ID vs some other identifier (e.g., name or index).
- Review MCP tool descriptions — the `update_kit` tool may not clearly
  communicate what `categoryId` expects, leading the AI to pass wrong values.
- Look at server logs for any errors when category updates are attempted.
