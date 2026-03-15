import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpContext } from './context';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { hasQMAccess } from '../contracts';

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

  server.tool('create_site', 'Create a new site', {
    name: z.string(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isHomeSite: z.boolean().optional(),
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.sites.create(args, user.id));
    });
  });

  server.tool('update_site', 'Update an existing site', {
    id: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isHomeSite: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.sites.update(id, input, user.id));
    });
  });

  server.tool('delete_site', 'Delete a site (must have no kits assigned and be deactivated)', {
    id: z.number(),
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

  server.tool('get_kit', 'Get a kit by database ID with packs and computers. NOTE: Users refer to kits by their "number" field, not database ID. Use list_kits to find the database ID for a given kit number, then call this tool.', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.kits.get(id));
    });
  });

  server.tool('create_kit', 'Create a new kit', {
    number: z.number(),
    containerType: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    siteId: z.number(),
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.kits.create(args as any, user.id));
    });
  });

  server.tool('update_kit', 'Update an existing kit. Set siteId/custodianId/categoryId to null to clear. All ID fields expect numeric database IDs — use list tools (list_sites, list_kits, etc.) to look up valid IDs first.', {
    id: z.number(),
    number: z.number().optional(),
    containerType: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    siteId: zIdParam(),
    custodianId: zIdParam(),
    categoryId: zIdParam().describe('Numeric category ID. Use list_kits to see existing categories, or null to clear.'),
    status: z.string().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.kits.update(id, input as any, user.id));
    });
  });

  server.tool('delete_kit', 'Delete a kit (must be retired and have no packs or computers)', {
    id: z.number(),
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      const kit = await services.kits.get(id);
      if (kit.status !== 'RETIRED') {
        throw new Error('Cannot delete active kit — retire it first');
      }
      if (kit.packs.length > 0) {
        throw new Error(`Cannot delete kit: ${kit.packs.length} pack(s) still assigned`);
      }
      if (kit.computers.length > 0) {
        throw new Error(`Cannot delete kit: ${kit.computers.length} computer(s) still assigned`);
      }
      await services.prisma.kit.delete({ where: { id } });
      return ok({ deleted: true });
    });
  });

  server.tool('set_kit_last_inventoried', 'Set or clear the last inventoried date for a kit. Pass a date string to set, or "clear" to remove all inventory check records.', {
    kitId: z.number(),
    date: z.string().describe('ISO date string (e.g. "2026-03-07") to set, or "clear" to remove all inventory checks'),
    notes: z.string().optional().describe('Optional notes for the inventory check'),
  }, async ({ kitId, date, notes }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
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

  server.tool('list_packs', 'List packs. If kitId is provided, lists packs for that kit. If omitted, lists all packs with their kit info.', {
    kitId: z.number().optional(),
  }, async ({ kitId }) => {
    return safeCall(async () => {
      const { services } = getContext();
      if (kitId != null) {
        return ok(await services.packs.list(kitId));
      }
      return ok(await services.packs.listAll());
    });
  });

  server.tool('create_pack', 'Create a new pack in a kit', {
    kitId: z.number(),
    name: z.string(),
    description: z.string().optional(),
  }, async ({ kitId, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.packs.create(input, user.id, kitId));
    });
  });

  server.tool('update_pack', 'Update an existing pack', {
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.packs.update(id, input, user.id));
    });
  });

  server.tool('delete_pack', 'Delete a pack', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      await services.packs.delete(id, user.id);
      return ok({ deleted: true });
    });
  });

  // ─── Items ──────────────────────────────────────────────────────────

  server.tool('list_items', 'List items. If packId is provided, lists items for that pack. If omitted, lists all items with their pack and kit info.', {
    packId: z.number().optional(),
  }, async ({ packId }) => {
    return safeCall(async () => {
      const { services } = getContext();
      if (packId != null) {
        return ok(await services.items.list(packId));
      }
      return ok(await services.items.listAll());
    });
  });

  server.tool('create_item', 'Create a new item in a pack', {
    packId: z.number(),
    name: z.string(),
    type: z.string(),
    expectedQuantity: z.number().optional(),
  }, async ({ packId, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.items.create(input, user.id, packId));
    });
  });

  server.tool('update_item', 'Update an existing item', {
    id: z.number(),
    name: z.string().optional(),
    type: z.string().optional(),
    expectedQuantity: z.number().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.items.update(id, input, user.id));
    });
  });

  server.tool('delete_item', 'Delete an item', { id: z.number() }, async ({ id }) => {
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

  server.tool('create_operating_system', 'Create a new operating system entry', {
    name: z.string(),
  }, async ({ name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.os.create({ name }, user.id));
    });
  });

  server.tool('update_operating_system', 'Rename an operating system entry', {
    id: z.number(),
    name: z.string(),
  }, async ({ id, name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.os.update(id, { name }, user.id));
    });
  });

  server.tool('delete_operating_system', 'Delete an operating system (must not be assigned to any computers)', {
    id: z.number(),
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.os.delete(id);
      return ok({ deleted: true });
    });
  });

  // ─── Computers ──────────────────────────────────────────────────────

  server.tool('list_computers', 'List all computers. IMPORTANT: When presenting computers to users, identify them by host name or model, never by database ID.', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.computers.list());
    });
  });

  server.tool('get_computer', 'Get a computer by database ID. NOTE: Users identify computers by host name or model, not database ID. Use list_computers to find the database ID first.', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.computers.get(id));
    });
  });

  server.tool('create_computer', 'Create a new computer', {
    serialNumber: z.string().optional(),
    serviceTag: z.string().optional(),
    model: z.string().optional(),
    modelNumber: z.string().optional(),
    adminUsername: z.string().optional(),
    adminPassword: z.string().optional(),
    disposition: z.string().optional(),
    dateReceived: z.string().optional(),
    notes: z.string().optional(),
    siteId: zIdParam(),
    kitId: zIdParam(),
    osId: zIdParam(),
    custodianId: zIdParam(),
    hostNameId: zIdParam(),
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.computers.create(args, user.id));
    });
  });

  server.tool('update_computer', 'Update an existing computer. For nullable ID fields, pass null or "null" to clear. For lastInventoried, pass "clear" to remove.', {
    id: z.number(),
    serialNumber: z.string().optional(),
    serviceTag: z.string().optional(),
    model: z.string().optional(),
    modelNumber: z.string().optional(),
    adminUsername: z.string().optional(),
    adminPassword: z.string().optional(),
    disposition: z.string().optional(),
    dateReceived: z.string().optional(),
    lastInventoried: z.string().optional().describe('ISO date string (e.g. "2026-03-07") to set, or "clear" to remove'),
    notes: z.string().optional(),
    siteId: zIdParam(),
    kitId: zIdParam(),
    osId: zIdParam(),
    custodianId: zIdParam(),
    hostNameId: zIdParam(),
    categoryId: zIdParam(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      const cleaned: any = { ...input };
      if (cleaned.lastInventoried === 'clear') cleaned.lastInventoried = null;
      return ok(await services.computers.update(id, cleaned, user.id));
    });
  });

  server.tool('delete_computer', 'Delete a computer', {
    id: z.number(),
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

  // ─── Host Names ─────────────────────────────────────────────────────

  server.tool('list_hostnames', 'List all host names', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.hostNames.list());
    });
  });

  server.tool('create_hostname', 'Create a new host name', {
    name: z.string(),
  }, async ({ name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.hostNames.create({ name }, user.id));
    });
  });

  server.tool('update_hostname', 'Rename a host name', {
    id: z.number(),
    name: z.string(),
  }, async ({ id, name }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.hostNames.update(id, { name }, user.id));
    });
  });

  server.tool('delete_hostname', 'Delete an unassigned host name', {
    id: z.number(),
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

  server.tool('create_image', 'Create an image record from a URL', {
    url: z.string().describe('URL of the image'),
    fileName: z.string().optional().describe('Original filename for matching purposes'),
  }, async ({ url, fileName }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      return ok(await services.images.createFromUrl(url, fileName));
    });
  });

  server.tool('delete_image', 'Delete an image record and remove from S3 if applicable. Unlinks from any attached computers/kits/packs.', {
    id: z.number(),
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

  server.tool('attach_image', 'Attach an image to a Computer, Kit, or Pack (sets its imageId)', {
    imageId: z.number(),
    objectType: z.enum(['Computer', 'Kit', 'Pack']),
    objectId: z.number(),
  }, async ({ imageId, objectType, objectId }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.images.attach(imageId, objectType, objectId);
      return ok({ attached: true, imageId, objectType, objectId });
    });
  });

  server.tool('detach_image', 'Remove the image link from a Computer, Kit, or Pack (sets imageId to null)', {
    objectType: z.enum(['Computer', 'Kit', 'Pack']),
    objectId: z.number(),
  }, async ({ objectType, objectId }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.images.detach(objectType, objectId);
      return ok({ detached: true, objectType, objectId });
    });
  });

  // ─── Transfers ─────────────────────────────────────────────────────

  server.tool('transfer_kit', 'Transfer a kit to a new custodian and/or site', {
    kitId: z.number(),
    custodianId: zIdParam(),
    siteId: zIdParam(),
    notes: z.string().optional(),
  }, async ({ kitId, custodianId, siteId, notes }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.transfers.transfer({
        objectType: 'Kit',
        objectId: kitId,
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

  server.tool('create_note', 'Add a note to a Kit, Pack, or Computer', {
    objectType: z.enum(['Kit', 'Pack', 'Computer']),
    objectId: z.number(),
    text: z.string(),
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.notes.create(args, user.id));
    });
  });

  server.tool('update_note', 'Update an existing note', {
    id: z.number(),
    text: z.string(),
  }, async ({ id, text }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.notes.update(id, { text }, user.id));
    });
  });

  server.tool('delete_note', 'Delete a note', {
    id: z.number(),
  }, async ({ id }) => {
    return safeCall(async () => {
      requireQM();
      const { services } = getContext();
      await services.notes.delete(id);
      return ok({ deleted: true });
    });
  });

  // ─── Issues ─────────────────────────────────────────────────────────

  server.tool('list_issues', 'List issues, optionally filtered by status, type, packId, kitId, or computerId', {
    status: z.string().optional().describe('OPEN or RESOLVED'),
    type: z.string().optional().describe('MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER'),
    packId: z.number().optional(),
    kitId: z.number().optional(),
    computerId: z.number().optional(),
  }, async (args) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.issues.list(args));
    });
  });

  server.tool('create_issue', 'Create an issue on a pack, kit, or computer. At least one target entity is required.', {
    type: z.string().describe('MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER'),
    packId: z.number().optional(),
    itemId: z.number().optional(),
    kitId: z.number().optional(),
    computerId: z.number().optional(),
    notes: z.string().optional(),
  }, async (args) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.issues.create(args, user.id));
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
