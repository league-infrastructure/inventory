import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpContext } from './context';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { hasQMAccess } from '../contracts';
import { resolveKitByNumber, resolvePackByDesignator } from './identifiers';
import type { PackDesignator } from './identifiers';

// Pack-identifying MCP parameters accept either the structured
// {kit_number, pack_number} pair or the combined "kit_number/pack_number"
// string as printed on the physical label (e.g. "26/1") — matching exactly
// what identifiers.ts's resolvePackByDesignator() accepts. This is the one
// place that union schema is defined, shared by every pack-identifying tool.
const zPackDesignator = () => z.union([
  z.object({
    kit_number: z.number(),
    pack_number: z.number(),
  }).describe('Structured pack designator: the kit\'s printed number and the pack\'s number within that kit'),
  z.string().describe('Combined "kit_number/pack_number" designator exactly as printed on the label, e.g. "26/1"'),
]);

type PackDesignatorInput = { kit_number: number; pack_number: number } | string;

function toPackDesignator(pack: PackDesignatorInput): PackDesignator | string {
  return typeof pack === 'string' ? pack : { kitNumber: pack.kit_number, packNumber: pack.pack_number };
}

// MCP clients struggle with anyOf schemas (nullable/optional numbers).
// This helper accepts number, null, or string — coercing string numbers
// to numbers and the string "null" to actual null.
const zIdParam = () => z.union([
  z.number(),
  z.string().transform((s) => {
    if (s === 'null' || s === '') return null;
    const n = Number(s);
    if (isNaN(n)) throw new Error(`Invalid ID: "${s}" is not a number. Use a numeric database ID.`);
    return n;
  }),
  z.null(),
]).optional();

function getContext() {
  const ctx = mcpContext.getStore();
  if (!ctx) throw new Error('MCP context not available');
  return ctx;
}

function requireQM(): void {
  const { user } = getContext();
  if (!hasQMAccess(user.role)) {
    throw new Error('Quartermaster access required');
  }
}

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function safeCall(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (err: any) {
    return toolError(err.message || 'Unknown error');
  }
}

export function registerTools(server: McpServer): void {
  // ─── Version ────────────────────────────────────────────────────────

  const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

  server.tool(
    'get_version',
    'Get the application version, server hostname, and deployment environment. Use this tool when asked about the app version, which server the app is running on, or the deployment environment.',
    {},
    async () => {
      return ok({
        version: pkg.version,
        name: pkg.name,
        hostname: hostname(),
        environment: process.env.NODE_ENV || 'development',
      });
    },
  );

  // ─── Sites ──────────────────────────────────────────────────────────

  server.tool('list_sites', 'List all active sites. When presenting sites to users, identify them by name, never by database ID.', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.sites.list());
    });
  });

  server.tool('get_site', 'Get a site by ID', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.sites.get(id));
    });
  });

  server.registerTool('create_site', {
    description: 'Create a new site',
    inputSchema: {
      name: z.string(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      isHomeSite: z.boolean().optional(),
    },
    _meta: { requiresQM: true },
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.sites.create(args, user.id));
    });
  });

  server.registerTool('update_site', {
    description: 'Update an existing site',
    inputSchema: {
      id: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      isHomeSite: z.boolean().optional(),
      isActive: z.boolean().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.sites.update(id, input, user.id));
    });
  });

  server.registerTool('delete_site', {
    description: 'Delete a site (must have no kits assigned and be deactivated)',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      const site = await services.sites.get(id);
      if (site.isActive) {
        throw new Error('Cannot delete active site — deactivate it first');
      }
      const kits = await services.kits.list();
      const assignedKits = kits.filter(k => k.siteId === id);
      if (assignedKits.length > 0) {
        throw new Error(`Cannot delete site: ${assignedKits.length} kit(s) still assigned`);
      }
      await services.prisma.site.delete({ where: { id } });
      return ok({ deleted: true });
    });
  });

  // ─── Kits ───────────────────────────────────────────────────────────

  server.tool('list_kits', 'List all kits, optionally filtered by status. IMPORTANT: When presenting kits to users, always refer to them by their "number" field (e.g. "Kit 17"), never by database "id". Sort and search by number, not id.', {
    status: z.string().optional(),
  }, async ({ status }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.kits.list(status));
    });
  });

  server.tool('get_kit', 'Get a kit by kit number, with packs and computers.', { kit_number: z.number() }, async ({ kit_number }) => {
    return safeCall(async () => {
      const { services } = getContext();
      const kit = await resolveKitByNumber(services.prisma, kit_number);
      return ok(await services.kits.get(kit.id));
    });
  });

  server.registerTool('create_kit', {
    description: 'Create a new kit',
    inputSchema: {
      number: z.number(),
      containerType: z.string().optional(),
      name: z.string(),
      description: z.string().optional(),
      siteId: z.number(),
    },
    _meta: { requiresQM: true },
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.kits.create(args as any, user.id));
    });
  });

  server.registerTool('update_kit', {
    description: 'Update an existing kit, identified by kit_number. Set siteId/custodianId/categoryId to null to clear. All other ID fields (siteId, custodianId, categoryId) expect numeric database IDs — use list tools (list_sites, list_kits, etc.) to look up valid IDs first.',
    inputSchema: {
      kit_number: z.number(),
      number: z.number().optional(),
      containerType: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      siteId: zIdParam(),
      custodianId: zIdParam(),
      categoryId: zIdParam().describe('Numeric category ID. Use list_kits to see existing categories, or null to clear.'),
      status: z.string().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ kit_number, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const kit = await resolveKitByNumber(services.prisma, kit_number);
      return ok(await services.kits.update(kit.id, input as any, user.id));
    });
  });

  server.registerTool('delete_kit', {
    description: 'Delete a kit, identified by kit_number (must be retired and have no packs or computers)',
    inputSchema: {
      kit_number: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ kit_number }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      const resolved = await resolveKitByNumber(services.prisma, kit_number);
      const kit = await services.kits.get(resolved.id);
      if (kit.status !== 'RETIRED') {
        throw new Error('Cannot delete active kit — retire it first');
      }
      if (kit.packs.length > 0) {
        throw new Error(`Cannot delete kit: ${kit.packs.length} pack(s) still assigned`);
      }
      if (kit.computers.length > 0) {
        throw new Error(`Cannot delete kit: ${kit.computers.length} computer(s) still assigned`);
      }
      await services.prisma.kit.delete({ where: { id: resolved.id } });
      return ok({ deleted: true });
    });
  });

  server.registerTool('set_kit_last_inventoried', {
    description: 'Set or clear the last inventoried date for a kit, identified by kit_number. Pass a date string to set, or "clear" to remove all inventory check records.',
    inputSchema: {
      kit_number: z.number(),
      date: z.string().describe('ISO date string (e.g. "2026-03-07") to set, or "clear" to remove all inventory checks'),
      notes: z.string().optional().describe('Optional notes for the inventory check'),
    },
    _meta: { requiresQM: true },
  }, async ({ kit_number, date, notes }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const resolved = await resolveKitByNumber(services.prisma, kit_number);
      const kitId = resolved.id;
      await services.kits.get(kitId);
      if (date === 'clear') {
        const { count } = await services.prisma.inventoryCheck.deleteMany({ where: { kitId } });
        return ok({ cleared: true, kitId, deletedChecks: count });
      }
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) throw new Error(`Invalid date: "${date}"`);
      const check = await services.prisma.inventoryCheck.create({
        data: {
          kitId,
          userId: user.id,
          notes: notes || 'Date set via MCP',
          createdAt: parsed,
        },
      });
      return ok({ inventoryCheckId: check.id, kitId, date });
    });
  });

  // ─── Packs ──────────────────────────────────────────────────────────

  server.tool('list_packs', 'List packs. If kit_number is provided, lists packs for that kit. If omitted, lists all packs with their kit info.', {
    kit_number: z.number().optional(),
  }, async ({ kit_number }) => {
    return safeCall(async () => {
      const { services } = getContext();
      if (kit_number != null) {
        const kit = await resolveKitByNumber(services.prisma, kit_number);
        return ok(await services.packs.list(kit.id));
      }
      return ok(await services.packs.listAll());
    });
  });

  server.registerTool('create_pack', {
    description: 'Create a new pack in a kit, identified by kit_number',
    inputSchema: {
      kit_number: z.number(),
      name: z.string(),
      description: z.string().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ kit_number, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const kit = await resolveKitByNumber(services.prisma, kit_number);
      return ok(await services.packs.create(input, user.id, kit.id));
    });
  });

  server.registerTool('update_pack', {
    description: 'Update an existing pack\'s name and/or description, and optionally its display number within its kit, identified by a pack designator (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1"). IMPORTANT: when displayNumber is included, the response is the kit\'s full, freshly-ordered pack list (identical shape to renumber_pack\'s response), not a single pack — because other packs in the kit may also be renumbered as a side effect. displayNumber is always applied via the same renumber algorithm as renumber_pack, never a raw column write. For a number-only edit, prefer the dedicated renumber_pack tool.',
    inputSchema: {
      pack: zPackDesignator(),
      name: z.string().optional(),
      description: z.string().optional(),
      displayNumber: z.number().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ pack, displayNumber, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
      const id = resolved.id;

      if (displayNumber === undefined) {
        return ok(await services.packs.update(id, input, user.id));
      }

      if (input.name !== undefined || input.description !== undefined) {
        await services.packs.update(id, input, user.id);
      }
      return ok(await services.packs.renumber(resolved.kitId, id, displayNumber, user.id));
    });
  });

  server.registerTool('delete_pack', {
    description: 'Delete a pack, identified by a pack designator (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1")',
    inputSchema: { pack: zPackDesignator() },
    _meta: { requiresQM: true },
  }, async ({ pack }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
      await services.packs.delete(resolved.id, user.id);
      return ok({ deleted: true });
    });
  });

  server.registerTool('renumber_pack', {
    description: 'Change a pack\'s display number within its kit (e.g. renumber pack 7 to 4). The pack to move is identified by a pack designator (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1"); displayNumber is the *target* number to renumber it to. Other packs in the same kit are automatically renumbered so the whole kit stays a contiguous 1..N sequence — the response is the kit\'s full, freshly-ordered pack list, not just the one pack. update_pack also accepts a displayNumber field, for combined name/description + number edits in one call.',
    inputSchema: {
      pack: zPackDesignator(),
      displayNumber: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ pack, displayNumber }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
      return ok(await services.packs.renumber(resolved.kitId, resolved.id, displayNumber, user.id));
    });
  });

  // ─── Items ──────────────────────────────────────────────────────────

  server.tool('list_items', 'List items. If pack is provided (a pack designator: structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1"), lists items for that pack. If omitted, lists all items with their pack and kit info.', {
    pack: zPackDesignator().optional(),
  }, async ({ pack }) => {
    return safeCall(async () => {
      const { services } = getContext();
      if (pack != null) {
        const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
        return ok(await services.items.list(resolved.id));
      }
      return ok(await services.items.listAll());
    });
  });

  server.registerTool('create_item', {
    description: 'Create a new item in a pack, identified by a pack designator (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1")',
    inputSchema: {
      pack: zPackDesignator(),
      name: z.string(),
      type: z.string(),
      expectedQuantity: z.number().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ pack, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
      return ok(await services.items.create(input, user.id, resolved.id));
    });
  });

  server.registerTool('update_item', {
    description: 'Update an existing item',
    inputSchema: {
      id: z.number(),
      name: z.string().optional(),
      type: z.string().optional(),
      expectedQuantity: z.number().optional(),
    },
    _meta: { requiresQM: true },
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.items.update(id, input, user.id));
    });
  });

  server.registerTool('delete_item', {
    description: 'Delete an item',
    inputSchema: { id: z.number() },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      await services.items.delete(id, user.id);
      return ok({ deleted: true });
    });
  });

  // ─── Operating Systems ─────────────────────────────────────────────

  server.tool('list_operating_systems', 'List all operating systems', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.os.list());
    });
  });

  server.registerTool('create_operating_system', {
    description: 'Create a new operating system entry',
    inputSchema: {
      name: z.string(),
    },
    _meta: { requiresQM: true },
  }, async ({ name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.os.create({ name }, user.id));
    });
  });

  server.registerTool('update_operating_system', {
    description: 'Rename an operating system entry',
    inputSchema: {
      id: z.number(),
      name: z.string(),
    },
    _meta: { requiresQM: true },
  }, async ({ id, name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.os.update(id, { name }, user.id));
    });
  });

  server.registerTool('delete_operating_system', {
    description: 'Delete an operating system (must not be assigned to any computers)',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.os.delete(id);
      return ok({ deleted: true });
    });
  });

  // ─── Computers ──────────────────────────────────────────────────────

  server.tool(
    'list_computers',
    'List computers, optionally narrowed by filters. IMPORTANT: When presenting computers to users, '
    + 'identify them by host name or model, never by database ID. Filters: site_id narrows to a specific '
    + 'site (find its ID via list_sites first); kit_number narrows to a specific kit by the number printed '
    + 'on it; disposition narrows to one of ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, or '
    + 'DECOMMISSIONED; unassigned=true returns only computers with no site and no kit. Filters compose '
    + '(e.g. kit_number + disposition narrows on both). Omitting all filters returns the full computer '
    + 'list, as before.',
    {
      site_id: z.number().optional(),
      kit_number: z.number().optional(),
      disposition: z.string().optional().describe('ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, or DECOMMISSIONED'),
      unassigned: z.boolean().optional(),
    },
    async ({ site_id, kit_number, disposition, unassigned }) => {
      return safeCall(async () => {
        const { services } = getContext();
        let kitId: number | undefined;
        if (kit_number != null) {
          const kit = await resolveKitByNumber(services.prisma, kit_number);
          kitId = kit.id;
        }
        return ok(await services.computers.list({ siteId: site_id, kitId, disposition, unassigned }));
      });
    },
  );

  server.tool('get_computer', 'Get a computer by database ID. NOTE: Users identify computers by host name or model, not database ID. Use list_computers to find the database ID first.', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.computers.get(id));
    });
  });

  server.registerTool('create_computer', {
    description: 'Create a new computer. kit_number identifies the kit by its printed number, not database ID.',
    inputSchema: {
      serialNumber: z.string().optional(),
      serviceTag: z.string().optional(),
      manufacturer: z.string().optional().describe('Dell, Lenovo, Apple, HP, or Other'),
      model: z.string().optional(),
      modelNumber: z.string().optional(),
      manufacturedYear: z.number().optional(),
      adminUsername: z.string().optional(),
      adminPassword: z.string().optional(),
      studentUsername: z.string().optional(),
      studentPassword: z.string().optional(),
      disposition: z.string().optional(),
      dateReceived: z.string().optional(),
      notes: z.string().optional(),
      siteId: zIdParam(),
      kit_number: zIdParam(),
      osId: zIdParam(),
      custodianId: zIdParam(),
      hostNameId: zIdParam(),
    },
    _meta: { requiresQM: true },
  }, async ({ kit_number, ...args }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      let kitId: number | null | undefined;
      if (kit_number === null) {
        kitId = null;
      } else if (typeof kit_number === 'number') {
        const kit = await resolveKitByNumber(services.prisma, kit_number);
        kitId = kit.id;
      }
      return ok(await services.computers.create({ ...args, kitId }, user.id));
    });
  });

  server.registerTool('update_computer', {
    description: 'Update an existing computer. For nullable ID fields, pass null or "null" to clear. For lastInventoried, pass "clear" to remove. kit_number identifies the kit by its printed number, not database ID — pass null or "null" to clear it.',
    inputSchema: {
      id: z.number(),
      serialNumber: z.string().optional(),
      serviceTag: z.string().optional(),
      manufacturer: z.string().optional().describe('Dell, Lenovo, Apple, HP, or Other'),
      model: z.string().optional(),
      modelNumber: z.string().optional(),
      manufacturedYear: z.number().optional(),
      adminUsername: z.string().optional(),
      adminPassword: z.string().optional(),
      studentUsername: z.string().optional(),
      studentPassword: z.string().optional(),
      disposition: z.string().optional(),
      dateReceived: z.string().optional(),
      lastInventoried: z.string().optional().describe('ISO date string (e.g. "2026-03-07") to set, or "clear" to remove'),
      notes: z.string().optional(),
      siteId: zIdParam(),
      kit_number: zIdParam(),
      osId: zIdParam(),
      custodianId: zIdParam(),
      hostNameId: zIdParam(),
      categoryId: zIdParam(),
    },
    _meta: { requiresQM: true },
  }, async ({ id, kit_number, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const cleaned: any = { ...input };
      if (cleaned.lastInventoried === 'clear') cleaned.lastInventoried = null;
      if (kit_number === null) {
        cleaned.kitId = null;
      } else if (typeof kit_number === 'number') {
        const kit = await resolveKitByNumber(services.prisma, kit_number);
        cleaned.kitId = kit.id;
      }
      return ok(await services.computers.update(id, cleaned, user.id));
    });
  });

  server.registerTool('delete_computer', {
    description: 'Delete a computer',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      const computer = await services.computers.get(id);
      if (computer.hostName) {
        await services.prisma.hostName.update({
          where: { id: computer.hostName.id },
          data: { computerId: null },
        });
      }
      await services.prisma.computer.delete({ where: { id } });
      return ok({ deleted: true });
    });
  });

  // ─── Labels ─────────────────────────────────────────────────────────

  const LABEL_CAP = 60;

  server.tool(
    'generate_labels',
    'Generate printable label PDFs for an explicit set of kits, packs, and/or computers. '
    + 'Renders one PDF per physical label stock size present in the selection: 102x59mm for '
    + 'kits and packs, 89x28mm for computers — a single PDF never mixes stock sizes, so a '
    + 'mixed kit/pack + computer selection returns two PDFs in one response. Packs may be '
    + 'drawn from different kits in the same call. Set include_kit_packs to true to also '
    + 'include every pack belonging to each kit in kit_numbers (deduped against any pack '
    + 'already listed in packs). At least one of kit_numbers, packs, or computer_ids '
    + 'must be non-empty, and the total label count (after include_kit_packs expansion) must '
    + 'not exceed 60 — split larger requests into multiple calls rather than expecting '
    + 'truncation. kit_numbers takes the numbers printed on the kits directly; packs takes pack '
    + 'designators (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" '
    + 'string, e.g. "26/1"); use list_computers to find the numeric database IDs computer_ids requires. '
    + 'The JSON manifest includes a download_url per bundle — an absolute, login-protected link '
    + 'the user can click to download that bundle\'s PDF — alongside the inline base64 resource '
    + 'block for clients that render it directly.',
    {
      kit_numbers: z.array(z.number()).optional(),
      packs: z.array(zPackDesignator()).optional(),
      computer_ids: z.array(z.number()).optional(),
      include_kit_packs: z.boolean().optional(),
    },
    async ({ kit_numbers, packs, computer_ids, include_kit_packs }) => {
      return safeCall(async () => {
        const { services, user } = getContext();

        const kitNumbers = kit_numbers ?? [];
        const packDesignators = packs ?? [];
        const computerIds = computer_ids ?? [];
        const includeKitPacks = include_kit_packs ?? false;

        if (kitNumbers.length === 0 && packDesignators.length === 0 && computerIds.length === 0) {
          return toolError(
            'No labels requested: provide at least one of kit_numbers, packs, or computer_ids.',
          );
        }

        const kits = await Promise.all(
          kitNumbers.map((n) => resolveKitByNumber(services.prisma, n)),
        );
        const kitIds = kits.map((k) => k.id);

        const resolvedPacks = await Promise.all(
          packDesignators.map((d) => resolvePackByDesignator(services.prisma, toPackDesignator(d))),
        );
        const packIds = resolvedPacks.map((p) => p.id);

        // Upper-bound label count computed from the raw ID lists, without
        // calling generateLabelSet. Packs are the only part of the
        // selection that can be deduped (explicit packs plus, when
        // include_kit_packs is set, every pack belonging to a listed kit,
        // matching generateLabelSet's own pack-level Map dedup) — kit_numbers
        // and computer_ids are counted as given, since generateLabelSet
        // does not dedupe those either.
        const packIdSet = new Set(packIds);
        if (includeKitPacks && kitIds.length > 0) {
          const kitPacks = await services.prisma.pack.findMany({
            where: { kitId: { in: kitIds } },
            select: { id: true },
          });
          for (const p of kitPacks) packIdSet.add(p.id);
        }
        const estimatedCount = kitIds.length + packIdSet.size + computerIds.length;

        if (estimatedCount > LABEL_CAP) {
          return toolError(
            `Selection would produce ${estimatedCount} labels, exceeding the ${LABEL_CAP}-label `
            + 'cap. Split the request into smaller batches.',
          );
        }

        const bundles = await services.labels.generateLabelSet({
          kitIds,
          packIds,
          computerIds,
          includeKitPacks,
        });

        // Store each bundle's PDF so the manifest can carry a real,
        // clickable download link — filenames reflect stock size and
        // label count (human-meaningful), never a database id, per
        // sprint 009's identifier convention.
        const stored = await Promise.all(
          bundles.map((b) => services.generatedFiles.store(
            user.id,
            b.pdf,
            `labels-${b.stock}-${b.labelCount}.pdf`,
            'application/pdf',
          )),
        );

        const manifest = {
          bundles: bundles.map((b, i) => ({
            stock: b.stock,
            labelCount: b.labelCount,
            contents: b.contents,
            download_url: stored[i].downloadUrl,
          })),
        };

        const content: CallToolResult['content'] = [
          { type: 'text', text: JSON.stringify(manifest, null, 2) },
        ];
        for (const bundle of bundles) {
          content.push({
            type: 'resource',
            resource: {
              uri: `inventory://labels/${bundle.stock}.pdf`,
              mimeType: 'application/pdf',
              blob: bundle.pdf.toString('base64'),
            },
          });
        }

        return { content };
      });
    },
  );

  // ─── List Exports ───────────────────────────────────────────────────

  server.tool(
    'export_list',
    '"I need a list of X": export a filtered CSV or xlsx of kits, packs, computers, or items, '
    + 'using human-facing identifiers only (kit numbers, pack designators, host names) — never '
    + 'database ids. Stores the file and returns a download_url the user can click to download '
    + 'it. Filters mirror the corresponding list_* tool exactly, and compose the same way: '
    + 'entity="kits" accepts status (matching list_kits); entity="packs" accepts kit_number '
    + '(matching list_packs); entity="items" accepts pack, a pack designator — structured '
    + '{kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1" '
    + '(matching list_items); entity="computers" accepts site_id, kit_number, disposition '
    + '(ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, or DECOMMISSIONED), and '
    + 'unassigned (matching list_computers). Omitting all filters for the chosen entity exports '
    + 'the full unfiltered list for that entity, same as the corresponding list_* tool with no '
    + 'arguments. No row/size cap — unlike generate_labels, the whole point of a download link '
    + 'is that size is no longer a tool-response concern.',
    {
      entity: z.enum(['kits', 'packs', 'computers', 'items']),
      format: z.enum(['csv', 'xlsx']),
      status: z.string().optional().describe('kits only: filter by status, matching list_kits'),
      kit_number: z.number().optional().describe('packs/computers only: filter by the kit\'s printed number, matching list_packs/list_computers'),
      pack: zPackDesignator().optional().describe('items only: filter by pack designator, matching list_items'),
      site_id: z.number().optional().describe('computers only: filter by site id, matching list_computers (find it via list_sites first)'),
      disposition: z.string().optional().describe('computers only: ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, or DECOMMISSIONED, matching list_computers'),
      unassigned: z.boolean().optional().describe('computers only: true returns only computers with no site and no kit, matching list_computers'),
    },
    async ({ entity, format, status, kit_number, pack, site_id, disposition, unassigned }) => {
      return safeCall(async () => {
        const { services, user } = getContext();

        let result;
        switch (entity) {
          case 'kits': {
            result = await services.exports.exportKitsList(format, { status });
            break;
          }
          case 'packs': {
            let kitId: number | undefined;
            if (kit_number != null) {
              const kit = await resolveKitByNumber(services.prisma, kit_number);
              kitId = kit.id;
            }
            result = await services.exports.exportPacksList(format, { kitId });
            break;
          }
          case 'items': {
            let packId: number | undefined;
            if (pack != null) {
              const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
              packId = resolved.id;
            }
            result = await services.exports.exportItemsList(format, { packId });
            break;
          }
          case 'computers': {
            let kitId: number | undefined;
            if (kit_number != null) {
              const kit = await resolveKitByNumber(services.prisma, kit_number);
              kitId = kit.id;
            }
            result = await services.exports.exportComputersList(format, {
              siteId: site_id,
              kitId,
              disposition,
              unassigned,
            });
            break;
          }
        }

        const mimeType = format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        // Filename reflects entity + format only — human-meaningful, never
        // a database id, per sprint 009's identifier convention.
        const filename = `${entity}-export.${format}`;

        const stored = await services.generatedFiles.store(user.id, result.buffer, filename, mimeType);

        return ok({
          entity,
          format,
          rowCount: result.rowCount,
          download_url: stored.downloadUrl,
        });
      });
    },
  );

  // ─── Host Names ─────────────────────────────────────────────────────

  server.tool('list_hostnames', 'List all host names', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.hostNames.list());
    });
  });

  server.registerTool('create_hostname', {
    description: 'Create a new host name',
    inputSchema: {
      name: z.string(),
      scheme: z.string().optional().describe('Optional grouping scheme for the host name'),
    },
    _meta: { requiresQM: true },
  }, async ({ name, scheme }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.hostNames.create({ name, scheme }, user.id));
    });
  });

  server.registerTool('update_hostname', {
    description: 'Update a host name (rename or change scheme)',
    inputSchema: {
      id: z.number(),
      name: z.string().optional().describe('New name for the host name record'),
      scheme: z.string().nullable().optional().describe('Grouping scheme; pass null to clear'),
    },
    _meta: { requiresQM: true },
  }, async ({ id, name, scheme }) => {
    return safeCall(async () => {
      if (name === undefined && scheme === undefined) {
        throw new Error('At least one of name or scheme is required');
      }
      requireQM();
      const { services, user } = getContext();
      return ok(await services.hostNames.update(id, { name, scheme }, user.id));
    });
  });

  server.registerTool('delete_hostname', {
    description: 'Delete an unassigned host name',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.hostNames.delete(id);
      return ok({ deleted: true });
    });
  });

  // ─── Images ────────────────────────────────────────────────────────

  server.tool('list_images', 'List images. Optionally filter by fileName substring.', {
    search: z.string().optional().describe('Search by fileName (case-insensitive contains)'),
  }, async ({ search }) => {
    return safeCall(async () => {
      const { services } = getContext();
      const images = await services.images.list(search);
      return ok(images.map(img => ({
        ...img,
        publicUrl: img.objectKey ? services.images.getPublicUrl(img.objectKey) : img.url,
      })));
    });
  });

  server.tool('get_image', 'Get image metadata by ID', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      const image = await services.images.getMeta(id);
      if (!image) throw new Error(`Image ${id} not found`);
      return ok({
        ...image,
        publicUrl: image.objectKey ? services.images.getPublicUrl(image.objectKey) : image.url,
      });
    });
  });

  server.registerTool('create_image', {
    description: 'Create an image record from a URL',
    inputSchema: {
      url: z.string().describe('URL of the image'),
      fileName: z.string().optional().describe('Original filename for matching purposes'),
    },
    _meta: { requiresQM: true },
  }, async ({ url, fileName }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      return ok(await services.images.createFromUrl(url, fileName));
    });
  });

  server.registerTool('delete_image', {
    description: 'Delete an image record and remove from S3 if applicable. Unlinks from any attached computers/kits/packs.',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      const image = await services.images.getMeta(id);
      if (!image) throw new Error(`Image ${id} not found`);
      await services.images.delete(id);
      return ok({ deleted: true });
    });
  });

  server.registerTool('attach_image', {
    description: 'Attach an image to a Computer, Kit, or Pack (sets its imageId)',
    inputSchema: {
      imageId: z.number(),
      objectType: z.enum(['Computer', 'Kit', 'Pack']),
      objectId: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ imageId, objectType, objectId }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.images.attach(imageId, objectType, objectId);
      return ok({ attached: true, imageId, objectType, objectId });
    });
  });

  server.registerTool('detach_image', {
    description: 'Remove the image link from a Computer, Kit, or Pack (sets imageId to null)',
    inputSchema: {
      objectType: z.enum(['Computer', 'Kit', 'Pack']),
      objectId: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ objectType, objectId }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.images.detach(objectType, objectId);
      return ok({ detached: true, objectType, objectId });
    });
  });

  // ─── Transfers ─────────────────────────────────────────────────────

  server.tool('transfer_kit', 'Transfer a kit, identified by kit_number, to a new custodian and/or site', {
    kit_number: z.number(),
    custodianId: zIdParam(),
    siteId: zIdParam(),
    notes: z.string().optional(),
  }, async ({ kit_number, custodianId, siteId, notes }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      const kit = await resolveKitByNumber(services.prisma, kit_number);
      return ok(await services.transfers.transfer({
        objectType: 'Kit',
        objectId: kit.id,
        custodianId,
        siteId,
        notes,
      }, user.id));
    });
  });

  server.tool('transfer_computer', 'Transfer a standalone computer to a new custodian and/or site. Computer must not be in a kit.', {
    computerId: z.number(),
    custodianId: zIdParam(),
    siteId: zIdParam(),
    notes: z.string().optional(),
  }, async ({ computerId, custodianId, siteId, notes }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.transfers.transfer({
        objectType: 'Computer',
        objectId: computerId,
        custodianId,
        siteId,
        notes,
      }, user.id));
    });
  });

  // ── Notes ──────────────────────────────────────────────────────────
  server.tool('list_notes', 'List notes for a Kit, Pack, or Computer', {
    objectType: z.enum(['Kit', 'Pack', 'Computer']),
    objectId: z.number(),
  }, async ({ objectType, objectId }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.notes.list(objectType, objectId));
    });
  });

  server.registerTool('create_note', {
    description: 'Add a note to a Kit, Pack, or Computer',
    inputSchema: {
      objectType: z.enum(['Kit', 'Pack', 'Computer']),
      objectId: z.number(),
      text: z.string(),
    },
    _meta: { requiresQM: true },
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.notes.create(args, user.id));
    });
  });

  server.registerTool('update_note', {
    description: 'Update an existing note',
    inputSchema: {
      id: z.number(),
      text: z.string(),
    },
    _meta: { requiresQM: true },
  }, async ({ id, text }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.notes.update(id, { text }, user.id));
    });
  });

  server.registerTool('delete_note', {
    description: 'Delete a note',
    inputSchema: {
      id: z.number(),
    },
    _meta: { requiresQM: true },
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.notes.delete(id);
      return ok({ deleted: true });
    });
  });

  // ─── Issues ─────────────────────────────────────────────────────────

  server.tool('list_issues', 'List issues, optionally filtered by status, type, pack (a pack designator: structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1"), kit_number, or computerId', {
    status: z.string().optional().describe('OPEN or RESOLVED'),
    type: z.string().optional().describe('MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER'),
    pack: zPackDesignator().optional(),
    kit_number: z.number().optional(),
    computerId: z.number().optional(),
  }, async ({ kit_number, pack, ...args }) => {
    return safeCall(async () => {
      const { services } = getContext();
      let kitId: number | undefined;
      if (kit_number != null) {
        const kit = await resolveKitByNumber(services.prisma, kit_number);
        kitId = kit.id;
      }
      let packId: number | undefined;
      if (pack != null) {
        const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
        packId = resolved.id;
      }
      return ok(await services.issues.list({ ...args, kitId, packId }));
    });
  });

  server.tool('create_issue', 'Create an issue on a pack, kit, or computer. At least one target entity is required. kit_number identifies the kit by its printed number, and pack identifies the pack by a pack designator (structured {kit_number, pack_number}, or the combined "kit_number/pack_number" string, e.g. "26/1") — neither by database ID.', {
    type: z.string().describe('MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER'),
    pack: zPackDesignator().optional(),
    itemId: z.number().optional(),
    kit_number: z.number().optional(),
    computerId: z.number().optional(),
    notes: z.string().optional(),
  }, async ({ kit_number, pack, ...args }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      let kitId: number | undefined;
      if (kit_number != null) {
        const kit = await resolveKitByNumber(services.prisma, kit_number);
        kitId = kit.id;
      }
      let packId: number | undefined;
      if (pack != null) {
        const resolved = await resolvePackByDesignator(services.prisma, toPackDesignator(pack));
        packId = resolved.id;
      }
      return ok(await services.issues.create({ ...args, kitId, packId }, user.id));
    });
  });

  server.tool('resolve_issue', 'Resolve an open issue', {
    id: z.number(),
    notes: z.string().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.issues.resolve(id, input, user.id));
    });
  });
}
