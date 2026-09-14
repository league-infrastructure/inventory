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
  /** The raw zod shape passed to `.tool()`'s 3rd arg or `.registerTool()`'s `config.inputSchema` — a plain `{ paramName: ZodType }` map, not a `ZodObject` instance. */
  schema: Record<string, any>;
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
 * `_meta` (from either call shape), raw zod schema shape, and handler.
 *
 * Every `.tool(name, description, schema, handler)` call in `tools.ts`
 * uses this exact 4-argument form (verified: all 20 call sites), so the
 * schema is reliably `rest[rest.length - 2]` regardless of description
 * length/multi-line formatting.
 */
function getAllTools(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const fakeServer = {
    tool: (name: string, ...rest: any[]) => {
      const schema = rest.length >= 3 ? rest[rest.length - 2] : {};
      tools.push({ name, meta: undefined, schema, handler: rest[rest.length - 1] });
    },
    registerTool: (name: string, config: any, cb: ToolHandler) => {
      tools.push({ name, meta: config?._meta, schema: config?.inputSchema ?? {}, handler: cb });
    },
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  return tools;
}

/**
 * Recursively unwraps zod v4's optional/nullable/default/array/union
 * wrapper nodes (each exposes its wrapped type at a different `_def` key:
 * `innerType` for optional/nullable/default, `element` for array,
 * `options` for union — see `zod`'s `ZodType._def.type` discriminant) to
 * find every plain-object shape reachable from a given schema node, and
 * returns the flattened set of key names across all of them. Used below
 * to check the pack designator's structured variant
 * (`{kit_number, pack_number}`) regardless of how many layers of
 * optional/array/union it's wrapped in at any given call site.
 */
function collectNestedObjectKeys(node: any, seen: Set<any> = new Set()): string[] {
  if (!node || typeof node !== 'object' || seen.has(node)) return [];
  seen.add(node);
  const type = node._def?.type;
  if (type === 'object' && node.shape) return Object.keys(node.shape);
  if (type === 'optional' || type === 'nullable' || type === 'default') {
    return collectNestedObjectKeys(node._def.innerType, seen);
  }
  if (type === 'array') return collectNestedObjectKeys(node._def.element, seen);
  if (type === 'union') {
    return (node._def.options ?? []).flatMap((opt: any) => collectNestedObjectKeys(opt, seen));
  }
  return [];
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
    // export_list (ticket 010-004) is included here deliberately, not just
    // implicitly covered by the blanket check above: sprint 010's
    // architecture is explicit that it must stay at the same access level
    // as the existing unfiltered /api/export REST routes (any authenticated
    // non-loanee user, no QM requirement) even though its computers entity
    // carries the same admin/student password columns as that existing
    // export — this is a deliberate non-change to who can see those
    // fields, not an oversight, so it gets its own named assertion.
    for (const name of ['list_sites', 'get_kit', 'transfer_kit', 'transfer_computer', 'get_version', 'export_list']) {
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

/**
 * Drift-guard extension for ticket 009-004 (sprint 009: Kit and Pack Tool
 * Parameters Take User Numbers). Tickets 002/003 renamed every
 * kit-identifying and pack-identifying MCP tool parameter away from a
 * database id (`Kit.id` / `Pack.id`) to the user-facing `kit_number` /
 * pack designator instead — see
 * `clasi/issues/mcp-tools-must-use-user-facing-identifiers-not-database-ids.md`
 * for the collision defect this closes (kit number 26 has database id 17;
 * `generate_labels(kit_ids=[17])` silently printed the wrong kit's
 * labels). This guard fails if any tool converted in those tickets ever
 * regresses a kit/pack parameter back to an id-shaped name (e.g. `kitId`,
 * `id`, `packId`).
 *
 * Deliberately scoped to just the converted tools/params, not a blanket
 * "no schema anywhere may end in id" check: legitimate id-shaped
 * parameters remain by design on some of these same tools, for
 * identifiers this sprint does not touch (e.g. `siteId`, `custodianId`,
 * `categoryId`, `osId`, `hostNameId`, `itemId`, `computerId`, the
 * computer's own `id` on `update_computer`, and `site_id` on
 * `list_computers`). `CONVERTED_TOOL_ALLOWED_IDS` below is the explicit
 * allowlist of those, enumerated directly from each tool's current
 * `inputSchema` in `server/src/mcp/tools.ts`.
 */
const CONVERTED_TOOL_ALLOWED_IDS: Record<string, string[]> = {
  get_kit: [],
  update_kit: ['siteId', 'custodianId', 'categoryId'],
  delete_kit: [],
  set_kit_last_inventoried: [],
  list_packs: [],
  create_pack: [],
  transfer_kit: ['custodianId', 'siteId'],
  list_computers: ['site_id'],
  create_computer: ['siteId', 'osId', 'custodianId', 'hostNameId'],
  update_computer: ['id', 'siteId', 'osId', 'custodianId', 'hostNameId', 'categoryId'],
  list_issues: ['computerId'],
  create_issue: ['itemId', 'computerId'],
  generate_labels: [],
  update_pack: [],
  delete_pack: [],
  renumber_pack: [],
  list_items: [],
  create_item: [],
};

/**
 * Each converted tool's kit/pack-identifying parameter name(s) — used
 * below for a presence check (nothing silently dropped the param) and to
 * pick which params to walk for the nested pack-designator check.
 */
const CONVERTED_TOOL_KITPACK_PARAMS: Record<string, string[]> = {
  get_kit: ['kit_number'],
  update_kit: ['kit_number'],
  delete_kit: ['kit_number'],
  set_kit_last_inventoried: ['kit_number'],
  list_packs: ['kit_number'],
  create_pack: ['kit_number'],
  transfer_kit: ['kit_number'],
  list_computers: ['kit_number'],
  create_computer: ['kit_number'],
  update_computer: ['kit_number'],
  list_issues: ['kit_number', 'pack'],
  create_issue: ['kit_number', 'pack'],
  generate_labels: ['kit_numbers', 'packs'],
  update_pack: ['pack'],
  delete_pack: ['pack'],
  renumber_pack: ['pack'],
  list_items: ['pack'],
  create_item: ['pack'],
};

describe('kit/pack identifier drift guard (ticket 009-004)', () => {
  it('sanity check: every tool converted in tickets 002/003 is present with a captured schema', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of Object.keys(CONVERTED_TOOL_ALLOWED_IDS)) {
      const tool = byName.get(name);
      expect(tool).toBeDefined();
      expect(tool!.schema && typeof tool!.schema === 'object').toBe(true);
    }
  });

  it('every converted tool still declares its kit_number/pack parameter (no accidental removal)', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const [name, params] of Object.entries(CONVERTED_TOOL_KITPACK_PARAMS)) {
      const tool = byName.get(name)!;
      for (const param of params) {
        expect(Object.keys(tool.schema)).toContain(param);
      }
    }
  });

  it('no kit- or pack-identifying parameter on a converted tool is registered with an id-shaped name (/id$/i)', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    const violations: string[] = [];

    for (const [name, allowedIds] of Object.entries(CONVERTED_TOOL_ALLOWED_IDS)) {
      const tool = byName.get(name);
      if (!tool) {
        violations.push(`${name}: tool not found in captured catalog`);
        continue;
      }
      for (const key of Object.keys(tool.schema)) {
        if (/id$/i.test(key) && !allowedIds.includes(key)) {
          violations.push(`${name}.${key}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('the pack designator\'s nested keys (kit_number, pack_number) are not id-shaped either', () => {
    const tools = getAllTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    const violations: string[] = [];
    let sawNestedKeys = false;

    for (const [name, params] of Object.entries(CONVERTED_TOOL_KITPACK_PARAMS)) {
      const tool = byName.get(name)!;
      for (const param of params) {
        if (param !== 'pack' && param !== 'packs') continue;
        const nestedKeys = collectNestedObjectKeys(tool.schema[param]);
        if (nestedKeys.length > 0) sawNestedKeys = true;
        for (const key of nestedKeys) {
          if (/id$/i.test(key)) violations.push(`${name}.${param}.${key}`);
        }
      }
    }

    expect(violations).toEqual([]);
    // Sanity: confirm the recursive walk actually reached the nested
    // {kit_number, pack_number} object at least once, so an empty
    // `violations` list above isn't just the walk silently finding
    // nothing (e.g. a zod internals shape change breaking the unwrap).
    expect(sawNestedKeys).toBe(true);
  });
});
