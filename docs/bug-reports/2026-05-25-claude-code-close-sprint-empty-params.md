# Bug Report — Claude Code VS Code Extension

## Title

`mcp__clasi__close_sprint` tool calls submit with empty parameter dict; same MCP tool works when invoked directly via Python MCP SDK over identical stdio transport.

## Environment

- **Claude Code**: VS Code native extension (system prompt confirms `"You are running inside a VSCode native extension environment."`)
- **Platform**: macOS (Darwin 25.2.0)
- **Model**: Claude Opus 4.7 (`claude-opus-4-7`)
- **MCP server**: `clasi` (Python; served via `clasi mcp` over stdio). 35 tools registered.
  - **clasi version**: `0.20260516.1`
  - Install path: `/Users/eric/.local/pipx/venvs/clasi/lib/python3.14/site-packages/clasi/`
  - Python: 3.14, installed via `pipx`
- **First observed**: 2026-05-24. Reproduced 2026-05-25 in a second session.
- **Project**: CLASI-managed Node/TypeScript inventory app. Repo path: `/Volumes/Proj/proj/league-projects/infrastructure/inventory`.

## Summary

When the assistant attempts to call the MCP tool `mcp__clasi__close_sprint` with parameters, every call arrives at the MCP server with an empty parameters dict (`input_value={}`), causing the server to reject the call with a Pydantic `Field required` validation error for `sprint_id`.

This happens regardless of how the model formats the call. **All other MCP tools on the same server, in the same session, with the same parameter style, succeed.** The defect is uniquely tied to the `close_sprint` tool on the client/transport side — when the identical server-side tool is invoked via the Python `mcp` SDK over the same stdio transport, the call succeeds and the sprint closes cleanly.

## Reproduction

1. Install the `clasi` MCP server and register it with the VS Code Claude Code extension (`.mcp.json` entry, default config).
2. In a CLASI-managed project with an open sprint in `review` phase, ask the assistant to close the sprint.
3. The assistant calls `mcp__clasi__close_sprint` with at minimum:
   ```
   sprint_id: "002"
   branch_name: "sprint/002-..."
   test_command: ""
   ```
4. **Observed result**: every call returns:
   ```
   Error executing tool close_sprint: 1 validation error for close_sprintArguments
   sprint_id
     Field required [type=missing, input_value={}, input_type=dict]
   ```
   The server-side log confirms the parameters dict arrives empty (`{}`).
5. The assistant retries 5–10 times. Every retry fails identically. No retry has ever succeeded.

## Control 1 — other tools in the same MCP server work

In both sessions where this bug appeared, the assistant successfully called many neighboring tools with identical parameter styles, in the same conversation, with no errors:

| Tool | Parameters | Result |
|---|---|---|
| `mcp__clasi__get_sprint_status` | `sprint_id: "002"` | success |
| `mcp__clasi__get_sprint_phase` | `sprint_id: "002"` | success |
| `mcp__clasi__advance_sprint_phase` | `sprint_id: "002"` | success |
| `mcp__clasi__review_sprint_pre_close` | `sprint_id: "002"` | success |
| `mcp__clasi__acquire_execution_lock` | `sprint_id: "002"` | success |
| `mcp__clasi__list_tickets` | `sprint_id: "002"` | success |
| `mcp__clasi__write_artifact_frontmatter` | `path, updates` | success |
| `mcp__clasi__update_ticket_status` | `path, status` | success |
| `mcp__clasi__close_sprint` | `sprint_id: "002", ...` | **fails — empty params dict** |

## Control 2 — same server, same tool, different transport works

When the assistant bypasses its own tool channel and invokes the `close_sprint` MCP tool via the Python `mcp` SDK over the *same* `clasi mcp` stdio transport, the call succeeds and the sprint closes cleanly:

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command='clasi', args=['mcp'])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool('close_sprint', {
                'sprint_id': '001',
                'branch_name': 'sprint/001-computer-form-category-ux',
                'main_branch': 'master',
                'push_tags': False,
                'delete_branch': True,
                'test_command': '',
            })
            for c in result.content:
                print(c.text if hasattr(c, 'text') else c)

asyncio.run(main())
```

The clasi MCP server log shows the call arriving with the full dict:

```
[team-lead] CALL close_sprint({"sprint_id": "001", "branch_name": "sprint/001-...", "main_branch": "master", "push_tags": "False", "delete_branch": "True", "test_command": ""})
[team-lead]   OK close_sprint -> ...
```

This rules out a server bug, a registration bug, and a transport-framing bug. The `close_sprint` tool itself accepts the call correctly.

## Diagnostic test run (2026-05-25)

A targeted diagnostic was run against the affected session to localize the trigger. Results:

| Step | Call | Outcome | `input_value` at server |
|---|---|---|---|
| 1 | `close_sprint(sprint_id="002")` only | FAIL | `{}` |
| 2 | `get_status(agent, sprint_id, ticket_id)` | **SUCCESS** | full dict received |
| 3a | `close_sprint(sprint_id, main_branch="master")` | FAIL | `{}` |
| 3b | `close_sprint(sprint_id, delete_branch=true)` | FAIL | `{}` |
| 3c | `close_sprint(sprint_id, branch_name="…")` | FAIL | `{}` |
| 3d | `close_sprint(sprint_id, test_command="")` | FAIL | `{}` |

### What this rules out

- **Not the `anyOf [string, null]` default-null schema shape.** The Step 2 `get_status` tool has the same shape on its optional params (`sprint_id` and `ticket_id` are both `anyOf [{string}, {null}]` with `default: null`) and is invoked successfully in the same session.
- **Not the optional-param surface.** The minimal Step 1 call passes only the single required field `sprint_id` — the bug reproduces with zero optional fields included. So the bug is **not** triggered by optional-param serialization.
- **Not any one particular optional field.** Each of Step 3a–3d isolates one optional in addition to `sprint_id`. All fail identically with `input_value={}`.
- **Not a server-side issue.** Step 2 shows other tools in the same MCP server work; the original report's Control 2 (Python SDK over same stdio transport) shows `close_sprint` itself accepts the call when reached directly.

### What this localizes

The trigger is something specific to the `close_sprint` tool — either (a) the tool name itself, or (b) the full schema fingerprint (the combination of one required string + four optionals of mixed types, possibly interacting with the docstring shape). The params dict is being **dropped entirely** between assistant generation and MCP-server receive, regardless of what the assistant tries to pass.

## Follow-up diagnostic — alias test (2026-05-26)

The clasi maintainer added a literal alias `finalize_sprint` (file: `clasi/mcp/server.py` registration; description: `"Alias for close_sprint. See close_sprint for full documentation."`) with an **identical input schema** to `close_sprint`. Same required `sprint_id: string`. Same five optional params. Different tool name only.

| Call | Outcome | `input_value` |
|---|---|---|
| `finalize_sprint(…)` attempt 1 | FAIL | `{}` |
| `finalize_sprint(…)` attempt 2 | FAIL | `{}` |

### What this rules out

- **Not the tool name.** Two tools with different names but identical schemas both fail in exactly the same way.

### What this localizes (revised)

The trigger is **the schema fingerprint**, not the name. The schema in question is:

```json
{
  "sprint_id": {"type": "string"},
  "branch_name": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": null},
  "main_branch": {"type": "string", "default": "master"},
  "push_tags": {"type": "boolean", "default": true},
  "delete_branch": {"type": "boolean", "default": true},
  "test_command": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": null},
  "required": ["sprint_id"]
}
```

`get_status` (which works) has only `anyOf [string, null]` optionals with `default: null` — no boolean optionals, no string optionals with non-null defaults. The candidates for what differs:

1. **Presence of `boolean` optionals with `default: true`.** Unique to the failing schema among CLASI tools tested.
2. **Presence of `string` optionals with a non-null default (e.g., `main_branch: "master"`).** Also unique to the failing schema among CLASI tools tested.
3. **Total optional-param count** (5 optionals vs `get_status`'s 2).
4. **Mix of `anyOf [string, null]` defaults and plain-type defaults in the same schema.**

A targeted next test would be to register a stripped-down alias with each suspected feature removed in turn (e.g., `finalize_sprint_v2` with only `sprint_id` + `anyOf [string, null]` optionals, matching `get_status`'s shape) and see which combination flips it from broken to working.

### Unblock paths tested

- **Legacy archive-only path** (`close_sprint(sprint_id)` only, relying on the tool's documented fallback that skips git ops): not viable — Step 1 confirms the bare call still arrives as `{}`.
- **clasi CLI** (`clasi close-sprint …`): not viable — the `clasi` CLI does **not** expose a `close-sprint` subcommand. Top-level commands are `hook init install mcp migrate schema status tool uninstall`. There is no CLI route into the close-sprint code path.
- **Python `mcp` SDK over stdio**: works (the only known working path).

## Hypothesis (revised after alias test)

The trigger is **the parameter schema**, not the tool name. Specifically, something in the combination of:

- `boolean` optionals with non-default `default` values, and/or
- multiple `string` optionals with non-`null` defaults, and/or
- the cardinality of optionals (5 here vs ≤2 on working CLASI tools)

…causes the client-side params encoder (or the model's tool-call generation, prompted by the encoded schema) to drop the entire params dict before dispatch.

Worth investigating in the extension:

- The path that registers tools and produces the per-tool parameter spec that's exposed to the model. Is there a special-case branch that hits a degenerate "no params" representation for schemas with a particular feature?
- A token-level trace of what the model emits when generating a tool call to a schema matching this fingerprint — does the params block come back empty from the model, or does it get stripped after generation?
- A minimal-repro test: register a third tool whose schema is `close_sprint` minus one feature at a time, and bisect which feature flips it from broken to working.

## Impact

- **Blocking on a documented happy path.** Sprint close is the final step of every sprint in this workflow; closing without a workaround is impossible.
- **Confusing failure mode.** The error message points at the user's parameter passing, when in fact the assistant is forming the call correctly and the parameters are being dropped between the model and the MCP server.

## Workaround

Bypass the extension's MCP channel and call the server via Python `mcp` SDK over stdio (`clasi mcp`). Saved to project memory for future sessions.

## What would help confirm the cause

- A wire-level trace of the JSON sent to the MCP server when the assistant generates a tool call to `mcp__clasi__close_sprint`. If it's empty `{}` at the wire level, the bug is in the extension's params-encoder. If the JSON is correct at the wire level but the server still sees `{}`, the bug is in stdio framing.
- The same trace for `mcp__clasi__get_sprint_status` (which works) as a baseline.
- A repro where a second MCP server registers a tool with the exact same schema as `close_sprint` under a different tool name (e.g. `close_thing`). If the renamed tool works, the trigger is the tool *name*. If it also fails, the trigger is the tool *schema*.

## Related

This is distinct from but adjacent to the previously-tracked VS Code extension custom-subagent loading issues — those are about agent discovery; this is about parameter serialization to a registered MCP tool.
