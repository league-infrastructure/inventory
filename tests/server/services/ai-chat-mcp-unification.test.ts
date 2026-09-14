/**
 * Ticket 005-002 (sprint 005: AI Chat Pack Renumbering Tools — MCP catalog
 * unification): `AiChatService` no longer maintains its own tool catalog —
 * it lists and calls tools through an in-process MCP client connected to
 * the same `McpServer` (`createMcpServer()` / `registerTools()`) external
 * MCP clients use.
 *
 * This file covers what the deleted `getToolDefinitions()`/`executeTool()`
 * pair never verified:
 *  1. Catalog identity — the chat's per-role tool list is exactly the
 *     QM-filtered subset of the real MCP catalog, structurally (not a
 *     hand-picked sample of names).
 *  2. QM enforcement at call time — a new check: today's chat never had
 *     one (only list-time filtering).
 *  3. Delegation parity — renumber_pack / update_pack / delete_pack
 *     reached via the chat's execution path behave identically to the
 *     direct MCP path (mirrors mcp-renumber-pack.test.ts).
 *  4. is_error mapping — a failing tool call surfaces `isError: true`.
 *
 * No Anthropic API calls anywhere in this file (per the sprint's Test
 * Strategy) — everything here drives the exported seams
 * `AiChatService.getToolsForRole()` and `AiChatService.withMcpClient()`
 * directly. `withMcpClient()`'s callback receives a real MCP SDK `Client`
 * (inferred structurally from `AiChatService`'s own already-resolved
 * import) — this file never imports `@modelcontextprotocol/sdk` itself,
 * matching mcp-renumber-pack.test.ts's note that deep SDK subpath imports
 * don't resolve via ts-jest's classic module resolution from this
 * directory.
 */
import { setupTestUser, teardown, getRegistry, getUserId, getSuffix, getPrisma } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { AiChatService } from '../../../server/src/services/ai-chat.service';
import { registerTools } from '../../../server/src/mcp/tools';
import { mcpContext } from '../../../server/src/mcp/context';
import type { User } from '@prisma/client';

let siteId: number;
const service = new AiChatService();

beforeAll(async () => {
  await setupTestUser();
  const site = await getRegistry().sites.create({
    name: `svc-test-${getSuffix()}-chat-unify-site`,
  }, getUserId());
  siteId = site.id;
}, 30000);

afterAll(async () => {
  const prisma = getPrisma();
  const kits = await prisma.kit.findMany({
    where: { name: { contains: `svc-test-${getSuffix()}-chat-unify` } },
    select: { id: true },
  });
  const kitIds = kits.map((k) => k.id);
  if (kitIds.length > 0) {
    const packs = await prisma.pack.findMany({ where: { kitId: { in: kitIds } }, select: { id: true } });
    const packIds = packs.map((p) => p.id);
    if (packIds.length > 0) {
      await prisma.item.deleteMany({ where: { packId: { in: packIds } } });
      await prisma.auditLog.deleteMany({ where: { objectType: 'Pack', objectId: { in: packIds } } });
      await prisma.pack.deleteMany({ where: { id: { in: packIds } } });
    }
    await prisma.kit.deleteMany({ where: { id: { in: kitIds } } });
  }
  await prisma.site.deleteMany({ where: { name: { contains: `svc-test-${getSuffix()}-chat-unify-site` } } });
  await teardown();
}, 30000);

let kitNumber = 0;
// +80000 keeps this file's kit numbers in a disjoint range from other test
// files' own offsets (mcp-renumber-pack.test.ts uses +70000, etc.) so
// parallel workers whose `getSuffix()` values happen to land close
// together can't collide on a unique `Kit.number`.
function nextKitNumber() { return ++kitNumber + (getSuffix() % 100000) + 80000; }

/** Creates a kit with `n` packs, created in order (pack 1 -> displayNumber 1, etc). */
async function createKitWithPacks(n: number, label: string): Promise<{ kitId: number; kitNumber: number; packIds: number[] }> {
  const kit = await getRegistry().kits.create({
    number: nextKitNumber(),
    name: `svc-test-${getSuffix()}-chat-unify-${label}`,
    siteId,
  }, getUserId());

  const packIds: number[] = [];
  for (let i = 1; i <= n; i++) {
    const pack = await getRegistry().packs.create({ name: `Pack ${i}` }, getUserId(), kit.id);
    packIds.push(pack.id);
  }
  return { kitId: kit.id, kitNumber: kit.number, packIds };
}

/**
 * Packs are created in order above (pack 1 -> displayNumber 1, etc), so the
 * i-th (1-indexed) pack created in a kit has this designator before any
 * renumbering — the pack-designator shape `update_pack`/`delete_pack`/
 * `renumber_pack` now take instead of a database id (sprint 009, ticket 003).
 */
function designatorFor(kitNumber: number, packNumber: number) {
  return { kit_number: kitNumber, pack_number: packNumber };
}

function fakeUser(role: string): User {
  return { id: getUserId(), role } as User;
}

type FakeToolResult = { isError?: boolean; content: { type: string; text: string }[] };
type FakeToolHandler = (args: any) => Promise<FakeToolResult>;

/**
 * Same fake-collector pattern as mcp-renumber-pack.test.ts /
 * mcp-tool-metadata.test.ts: a minimal object exposing `.tool(...)` /
 * `.registerTool(...)` handed to the real `registerTools()`, avoiding any
 * dependency on the SDK's internal registration data structures or a real
 * `McpServer`. Used here as the independent ground truth for "what tools
 * exist and which are QM-gated" that the chat's catalog is compared
 * against.
 */
function getFakeCatalog(): { handlers: Map<string, FakeToolHandler>; requiresQM: Map<string, boolean> } {
  const handlers = new Map<string, FakeToolHandler>();
  const requiresQM = new Map<string, boolean>();
  const fakeServer = {
    tool: (name: string, ...rest: any[]) => {
      handlers.set(name, rest[rest.length - 1]);
      requiresQM.set(name, false);
    },
    registerTool: (name: string, config: any, cb: FakeToolHandler) => {
      handlers.set(name, cb);
      requiresQM.set(name, config?._meta?.requiresQM === true);
    },
    prompt: () => {},
  };
  registerTools(fakeServer as any);
  return { handlers, requiresQM };
}

/** The shape every registered tool actually returns, as surfaced through `client.callTool()`. */
type ChatToolResult = { isError?: boolean; content?: Array<{ type: string; text?: string }> };

describe('AiChatService: MCP catalog unification (ticket 005-002)', () => {
  describe('catalog identity', () => {
    it('QUARTERMASTER sees the full MCP catalog; INSTRUCTOR sees exactly the non-QM subset (structural comparison)', async () => {
      const { requiresQM } = getFakeCatalog();

      const qmTools = await service.getToolsForRole('QUARTERMASTER');
      const instructorTools = await service.getToolsForRole('INSTRUCTOR');

      // QM sees the whole catalog — no tool added or dropped versus the
      // independently-captured ground truth.
      expect(new Set(qmTools.map((t) => t.name))).toEqual(new Set(requiresQM.keys()));

      // INSTRUCTOR's list is exactly the QM-filtered subset, by name —
      // not a hand-picked sample.
      const expectedInstructorNames = [...requiresQM.entries()]
        .filter(([, gated]) => !gated)
        .map(([name]) => name)
        .sort();
      expect(instructorTools.map((t) => t.name).sort()).toEqual(expectedInstructorNames);

      // Structural equality, not just matching names: every tool visible
      // to INSTRUCTOR has an identical description + input_schema in the
      // QM list's entry for the same tool.
      const qmByName = new Map(qmTools.map((t) => [t.name, t]));
      for (const tool of instructorTools) {
        const qmTool = qmByName.get(tool.name);
        expect(qmTool).toBeDefined();
        expect(tool.description).toEqual(qmTool!.description);
        expect(tool.input_schema).toEqual(qmTool!.input_schema);
      }

      // No QM-gated tool leaks into the INSTRUCTOR list.
      for (const name of instructorTools.map((t) => t.name)) {
        expect(requiresQM.get(name)).toBe(false);
      }
    });

    it('every tool (both roles) has a name, non-empty description, and an object input_schema', async () => {
      for (const role of ['QUARTERMASTER', 'INSTRUCTOR']) {
        const tools = await service.getToolsForRole(role);
        expect(tools.length).toBeGreaterThan(0);
        for (const tool of tools) {
          expect(tool.name).toBeTruthy();
          expect(tool.description).toBeTruthy();
          expect((tool.input_schema as any)?.type).toBe('object');
        }
      }
    });
  });

  describe('QM enforcement through the chat execution path (new call-time check)', () => {
    it('rejects an INSTRUCTOR-role chat user calling renumber_pack, with the same message the MCP path produces', async () => {
      const { kitNumber, packIds } = await createKitWithPacks(3, 'qm-gate');
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      const result = await service.withMcpClient(fakeUser('INSTRUCTOR'), services, (client) =>
        client.callTool({ name: 'renumber_pack', arguments: { pack: designatorFor(kitNumber, 1), displayNumber: 2 } }),
      ) as ChatToolResult;

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toMatch(/Quartermaster access required/);

      // Nothing actually changed.
      const after = await getPrisma().pack.findMany({ where: { id: { in: packIds } }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);
    });
  });

  describe('delegation parity: renumber_pack / update_pack / delete_pack via the chat path', () => {
    it('renumber_pack via chat matches the direct MCP tool call for the same starting state and input, audited as MCP', async () => {
      const { handlers } = getFakeCatalog();
      const directHandler = handlers.get('renumber_pack');
      if (!directHandler) throw new Error('renumber_pack tool was not registered');

      // Direct MCP path (fake-collector convention, per mcp-renumber-pack.test.ts).
      const directScenario = await createKitWithPacks(7, 'renumber-direct');
      const directServices = ServiceRegistry.create(getPrisma(), 'MCP');
      let directBody: any;
      await mcpContext.run({ user: fakeUser('QUARTERMASTER'), services: directServices }, async () => {
        const result = await directHandler({ pack: designatorFor(directScenario.kitNumber, 7), displayNumber: 4 });
        expect(result.isError).toBeFalsy();
        directBody = JSON.parse(result.content[0].text);
      });
      const directByPosition = new Map(
        directBody.map((p: any) => [directScenario.packIds.indexOf(p.id), p.displayNumber]),
      );

      // Chat path: identical starting shape and edit, driven through
      // AiChatService.withMcpClient() + client.callTool() instead.
      const chatScenario = await createKitWithPacks(7, 'renumber-chat');
      const chatServices = ServiceRegistry.create(getPrisma(), 'MCP');
      const chatResult = await service.withMcpClient(fakeUser('QUARTERMASTER'), chatServices, (client) =>
        client.callTool({ name: 'renumber_pack', arguments: { pack: designatorFor(chatScenario.kitNumber, 7), displayNumber: 4 } }),
      ) as ChatToolResult;
      expect(chatResult.isError).toBeFalsy();
      const chatBody = JSON.parse(chatResult.content![0].text!);
      const chatByPosition = new Map(
        chatBody.map((p: any) => [chatScenario.packIds.indexOf(p.id), p.displayNumber]),
      );

      expect(chatByPosition).toEqual(directByPosition);

      const chatAudit = await getPrisma().auditLog.findMany({
        where: { objectType: 'Pack', objectId: { in: chatScenario.packIds }, field: 'displayNumber' },
      });
      expect(chatAudit.length).toBeGreaterThan(0);
      expect(chatAudit.every((r) => r.source === 'MCP')).toBe(true);
    });

    it('update_pack with displayNumber via chat returns the kit\'s full contiguous pack list, audited as MCP', async () => {
      const scenario = await createKitWithPacks(7, 'update-with-number');
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
        client.callTool({ name: 'update_pack', arguments: { pack: designatorFor(scenario.kitNumber, 7), displayNumber: 4 } }),
      ) as ChatToolResult;
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content![0].text!);

      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(7);
      const numbers = body.map((p: any) => p.displayNumber).sort((a: number, b: number) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);

      const audit = await getPrisma().auditLog.findMany({
        where: { objectType: 'Pack', objectId: { in: scenario.packIds }, field: 'displayNumber' },
      });
      expect(audit.length).toBeGreaterThan(0);
      expect(audit.every((r) => r.source === 'MCP')).toBe(true);
    });

    it('update_pack with only name/description via chat is unaffected: single record, no renumber side effect', async () => {
      const { kitNumber, packIds } = await createKitWithPacks(3, 'update-name-only');
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
        client.callTool({ name: 'update_pack', arguments: { pack: designatorFor(kitNumber, 1), name: 'Renamed via chat' } }),
      ) as ChatToolResult;
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content![0].text!);

      expect(Array.isArray(body)).toBe(false);
      expect(body.id).toBe(packIds[0]);
      expect(body.name).toBe('Renamed via chat');

      const after = await getPrisma().pack.findMany({ where: { id: { in: packIds } }, orderBy: { displayNumber: 'asc' } });
      expect(after.map((p) => p.displayNumber)).toEqual([1, 2, 3]);

      const displayNumberAudit = await getPrisma().auditLog.findMany({
        where: { objectType: 'Pack', objectId: { in: packIds }, field: 'displayNumber' },
      });
      expect(displayNumberAudit).toHaveLength(0);
    });

    it('delete_pack via chat calls services.packs.delete(): the kit\'s remaining packs compact to a contiguous 1..N', async () => {
      const { kitId, kitNumber, packIds } = await createKitWithPacks(4, 'delete-compaction');
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      // Delete the 2nd of 4 packs — the middle of the sequence, so a
      // pass-through (non-compacting) implementation would be observable
      // as a gap at displayNumber 2.
      const deletedPackId = packIds[1];
      const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
        client.callTool({ name: 'delete_pack', arguments: { pack: designatorFor(kitNumber, 2) } }),
      ) as ChatToolResult;
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content![0].text!);
      expect(body).toEqual({ deleted: true });

      const remaining = await getPrisma().pack.findMany({ where: { kitId }, orderBy: { displayNumber: 'asc' } });
      expect(remaining.map((p) => p.id)).toEqual(packIds.filter((id) => id !== deletedPackId));
      expect(remaining.map((p) => p.displayNumber)).toEqual([1, 2, 3]);

      const deletedRow = await getPrisma().pack.findUnique({ where: { id: deletedPackId } });
      expect(deletedRow).toBeNull();

      const auditRows = await getPrisma().auditLog.findMany({
        where: { objectType: 'Pack', objectId: deletedPackId, field: 'deleted' },
      });
      expect(auditRows.length).toBeGreaterThan(0);
      expect(auditRows.every((r) => r.source === 'MCP')).toBe(true);
    });
  });

  describe('is_error mapping (CallToolResult.isError -> Anthropic tool_result.is_error)', () => {
    it('a failing tool call (nonexistent pack) surfaces isError: true through the chat path', async () => {
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
        client.callTool({ name: 'renumber_pack', arguments: { pack: designatorFor(999999, 1), displayNumber: 1 } }),
      ) as ChatToolResult;

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toMatch(/not found/i);
    });

    it('a successful tool call has a falsy isError', async () => {
      await createKitWithPacks(2, 'is-error-success');
      const services = ServiceRegistry.create(getPrisma(), 'MCP');

      const result = await service.withMcpClient(fakeUser('QUARTERMASTER'), services, (client) =>
        client.callTool({ name: 'list_packs', arguments: {} }),
      ) as ChatToolResult;

      expect(result.isError).toBeFalsy();
    });
  });
});
