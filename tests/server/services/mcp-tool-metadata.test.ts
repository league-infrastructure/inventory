/**
 * Drift-guard test for ticket 005-001 (sprint 005: AI Chat Pack
 * Renumbering Tools — MCP catalog unification).
 *
 * Every tool registered by `registerTools()` in `server/src/mcp/tools.ts`
 * must declare `_meta: { requiresQM: true }` if and only if its handler
 * actually enforces `requireQM()`. This is the one invariant this whole
 * sprint exists to protect: the chat's role-based tool filtering (built
 * in ticket 002) trusts `_meta.requiresQM` to decide what to *show* a
 * non-Quartermaster user, while `requireQM()` is what actually *enforces*
 * access at call time. If those two ever drift apart — a future tool adds
 * `requireQM()` without the annotation, or the annotation without the
 * check — either a QM-gated tool becomes visible to everyone, or a
 * visible tool silently rejects everyone. This test fails the moment
 * that happens.
 *
 * Same fake-collector pattern as `mcp-renumber-pack.test.ts`: a minimal
 * object exposing `.tool(name, ...rest)` / `.registerTool(name, config,
 * cb)` that records each registration (including its declared `_meta`),
 * passed directly to the real `registerTools()`. This avoids depending on
 * the SDK's internal registration data structures or a real `McpServer`.
 *
 * Verification note (relevant to how `_meta` is declared in
 * `mcp/tools.ts`): the installed `@modelcontextprotocol/sdk`'s
 * `McpServer.tool(...)` overloads route a fourth-position options object
 * into `annotations`, not `_meta` — `_meta` is hard-coded to `undefined`
 * on that path (see `server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js`,
 * the `tool(name, ...rest)` method body). Only `McpServer.registerTool(name,
 * config, cb)`'s `config._meta` is threaded through to the registered
 * tool and, from there, verbatim into the `tools/list` response (`_meta:
 * tool._meta`, same file, `ListToolsRequestSchema` handler). So every
 * QM-gated tool in `mcp/tools.ts` is registered via `.registerTool(...)`
 * with `_meta: { requiresQM: true }` in its config object; non-QM tools
 * remain on the original `.tool(...)` call (no `_meta`, i.e.
 * `_meta?.requiresQM` is `undefined`, which is falsy — satisfying the
 * "no tool declares the flag without enforcing it" half of the
 * invariant). This test's fake collector captures both call shapes so it
 * doesn't care which one any given tool uses.
 */
import { setupTestUser, teardown, getUserId, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { registerTools } from '../../../server/src/mcp/tools';
import { mcpContext } from '../../../server/src/mcp/context';
import type { User } from '@prisma/client';

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };
type ToolHandler = (args: any) => Promise<ToolResult>;

interface CapturedTool {
  name: string;
  meta: Record<string, unknown> | undefined;
  handler: ToolHandler;
}

/**
 * Minimal valid-shaped args for tools whose handler runs some validation
 * *before* its `requireQM()` call, so a bare `{}` call would short-circuit
 * on that earlier check instead of ever reaching the QM gate. Currently
 * only `update_hostname`, which requires at least one of `name`/`scheme`
 * before calling `requireQM()`. Every other tool either needs no args at
 * all or calls `requireQM()` (when present) as the very first statement,
 * so a bare `{}` reaches it directly.
 */
const MINIMAL_ARGS: Record<string, unknown> = {
  update_hostname: { id: 1, name: 'drift-guard-probe' },
};

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

/**
 * Registers the real tool catalog (via the production `registerTools()`)
 * onto a minimal fake server that records every tool's name, declared
 * `_meta` (from either call shape), and handler.
 */
function getAllTools(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const fakeServer = {
    tool: (name: string, ...rest: any[]) => {
      tools.push({ name, meta: undefined, handler: rest[rest.length - 1] });
    },
    registerTool: (name: string, config: any, cb: ToolHandler) => {
      tools.push({ name, meta: config?._meta, handler: cb });
    },
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  return tools;
}

beforeAll(async () => {
  await setupTestUser();
}, 30000);

afterAll(async () => {
  await teardown();
}, 30000);

describe('MCP tool _meta.requiresQM drift guard (ticket 005-001)', () => {
  it('sanity check: the fake collector captures the full, non-duplicated catalog', () => {
    const tools = getAllTools();
    // Sprint 005's architecture describes ~47 tools; assert a floor so a
    // collector wiring regression (e.g. only .tool() calls captured) is
    // caught even if the exact count drifts with future tools.
    expect(tools.length).toBeGreaterThanOrEqual(45);
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('declares _meta.requiresQM === true if and only if the handler rejects a non-QM (INSTRUCTOR) caller', async () => {
    const tools = getAllTools();
    const services = ServiceRegistry.create(getPrisma(), 'MCP');
    const mismatches: string[] = [];

    for (const tool of tools) {
      const declaresQM = tool.meta?.requiresQM === true;
      const args = MINIMAL_ARGS[tool.name] ?? {};

      let rejectedForQM = false;
      await mcpContext.run({ user: fakeUser('INSTRUCTOR'), services }, async () => {
        const result = await tool.handler(args);
        rejectedForQM = result.isError === true
          && /Quartermaster access required/.test(result.content?.[0]?.text ?? '');
      });

      if (declaresQM !== rejectedForQM) {
        mismatches.push(
          `${tool.name}: _meta.requiresQM=${declaresQM} but handler `
          + `${rejectedForQM ? 'DID' : 'did NOT'} reject a non-QM caller`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('never declares requiresQM on a tool with no _meta at all (explicit negative check on known non-QM tools)', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of ['list_sites', 'get_kit', 'transfer_kit', 'transfer_computer', 'get_version']) {
      const tool = byName.get(name);
      expect(tool).toBeDefined();
      expect(tool!.meta?.requiresQM).not.toBe(true);
    }
  });

  it('declares requiresQM on every known QM-gated tool (explicit positive check on a representative sample)', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of ['create_site', 'renumber_pack', 'update_pack', 'delete_pack', 'create_note', 'delete_computer']) {
      const tool = byName.get(name);
      expect(tool).toBeDefined();
      expect(tool!.meta?.requiresQM).toBe(true);
    }
  });
});
