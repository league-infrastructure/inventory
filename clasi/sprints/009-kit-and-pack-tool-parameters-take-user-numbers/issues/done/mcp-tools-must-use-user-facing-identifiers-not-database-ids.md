---
status: done
sprint: 009
tickets:
- 009-001
- 009-002
- 009-003
- 009-004
---

# Kit and pack tool parameters must take user numbers, not database IDs

## Description

A number a user says must never be interpreted as a database ID.

Users say **"kit 17"** and **"pack 26/1"** constantly. When a tool
parameter for a kit is named `kitId` and takes a primary key, an
assistant relaying "print labels for kit 17" will pass `17` straight
through — and land on a different, real kit. Kit number 26 has database
id 17. Nothing errors. The labels just come out wrong.

This is not a request to purge database IDs from the MCP server. IDs are
fine internally, and fine as parameters for things users never speak
aloud. It is specifically about closing the path where a **user-uttered
number** reaches a parameter that means something else.

Observed live in sprint 008: `generate_labels(kit_ids=[17])` printed
labels for **Kit 26**.

Both the external MCP connector and the in-app AI chat are affected —
`ai-chat.service.ts:152` builds the assistant's tool catalog from the
same `registerTools()` function, so there is one place to fix and two
surfaces that benefit.

## Cause

The test that matters is: **would a user ever say this number out loud?**

| Identifier | Do users say it? | Collision risk |
| --- | --- | --- |
| Kit number | Constantly — "kit 17" | **Yes** — `Kit.number` and `Kit.id` are both small integers over the same range |
| Pack designator | Yes — "pack 26/1", printed on the label | **Yes** — `Pack.displayNumber` vs `Pack.id` |
| Site / OS / host name | Yes, but as *names*, not numbers | No — a string can't be mistaken for an integer key |
| Image, Note, Issue, Item IDs | Never — the assistant only ever obtains these from a prior tool response | No |

Only the first two rows are a problem. The rest can keep taking IDs.

The current mitigation lives in the wrong layer: `MCP_INSTRUCTIONS` in
`server/src/mcp/server.ts` asks the model to remember the distinction on
every call:

> 2. Kits have a user-facing "number" field AND a database "id". These are
>    NOT the same. When a user says "Kit 17", they mean the kit whose number
>    is 17, NOT database ID 17.
> 5. Use database IDs internally to call tools, but NEVER surface them...

Rule 5 requires the model to maintain a number-space mapping correctly,
forever, with a silent and plausible-looking failure when it slips. Naming
the parameter after the thing the user says removes the mapping step
entirely.

## Proposed fix

### Kit parameters take `kit_number`

Every tool parameter that identifies a kit takes the user-facing
`Kit.number` (`Int @unique` — already a clean natural key) and resolves to
the primary key internally:

`get_kit`, `update_kit`, `delete_kit`, `set_kit_last_inventoried`,
`list_packs`, `create_pack`, `transfer_kit`, `list_computers`,
`create_computer`, `update_computer`, `list_issues`, `create_issue`,
`generate_labels`.

### Pack parameters take the printed designator

Packs are addressed the way the label reads: `kit_number` +
`pack_number` (`Pack.displayNumber`), which the schema already makes
unique via `@@unique([kitId, displayNumber])`. Accept the conventional
`"26/1"` string form as well, since that is what is printed on the
physical label and what people read off it.

`update_pack`, `delete_pack`, `renumber_pack`, `list_items`,
`create_item`, `list_issues`, `create_issue`, `generate_labels`.

### Everything else is unchanged

Site, OS, and host name parameters are already strings and carry no
collision risk. Image, Note, Issue, and Item IDs are never spoken by
users and stay as they are. No schema migration is needed anywhere.

### Naming is part of the fix

Parameters must be named for what the user says — `kit_number`, not
`kitId` or a bare `id`. A parameter named `id` on `get_kit` invites
exactly the substitution this issue is about, regardless of what its
description says.

### Errors must be explicit

An unknown kit number errors as `Kit number 26 not found`. Never fall
back to interpreting the value as a database ID, and never guess.

### Retire the prompt mitigation

Once the parameters are renamed, `MCP_INSTRUCTIONS` rules 2 and 5 in
`server/src/mcp/server.ts` describe a hazard that no longer exists. Rule 5
("use database IDs internally to call tools") becomes actively wrong and
must be rewritten, not left to contradict the new interface.

### Compatibility

MCP tools are consumed only by external Claude connectors and the in-app
AI chat; neither pins tool schemas. The web UI uses the REST routes, which
this issue does not touch. Replace the parameters outright rather than
accepting both — keeping an ID path alive would preserve the exact footgun
being removed.

## Verification

1. **The regression that motivated this** — `generate_labels(kit_numbers=[17])`
   must produce labels for **Kit 17**, not kit database id 17. Assert on the
   manifest captions, which already echo `Kit 26: Microbit Misc`.
2. **Collision test** — the strongest available check: kit number 26 has
   database id 17, and both are valid kit numbers referring to different
   kits. Assert every converted kit tool resolves by number. Same for a pack
   whose `displayNumber` and `id` differ.
3. **Unit** — `npm run test:server`. Each converted tool: a valid number
   resolves to the right record; an unknown number errors explicitly.
4. **Drift guard** — extend `tests/server/mcp-tool-metadata.test.ts` to
   assert no kit- or pack-identifying parameter is named `*[Ii]d`, so a new
   tool cannot silently reintroduce the hazard.
5. **Live** — exercise both surfaces, the MCP endpoint over HTTP and the
   in-app AI chat, since both are fed by `registerTools()`.

## Related

- `server/src/mcp/tools.ts` — all tool registrations
- `server/src/mcp/server.ts` — `MCP_INSTRUCTIONS`, the prompt mitigation to retire
- `server/src/services/ai-chat.service.ts:152` — in-app assistant shares this catalog
- `server/prisma/schema.prisma` — `Kit.number @unique`, `@@unique([kitId, displayNumber])`
- `tests/server/mcp-tool-metadata.test.ts` — existing drift-guard test
- `clasi/reflections/2026-09-12-database-ids-in-mcp-interface.md` — how this shipped
