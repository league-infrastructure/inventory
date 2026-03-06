import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpContext } from './context';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

function getContext() {
  const ctx = mcpContext.getStore();
  if (!ctx) throw new Error('MCP context not available');
  return ctx;
}

function requireQM(): void {
  const { user } = getContext();
  if (user.role !== 'QUARTERMASTER') {
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
  // ─── Sites ──────────────────────────────────────────────────────────

  server.tool('list_sites', 'List all active sites', {}, async () => {
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
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.sites.update(id, input, user.id));
    });
  });

  // ─── Kits ───────────────────────────────────────────────────────────

  server.tool('list_kits', 'List all kits, optionally filtered by status', {
    status: z.string().optional(),
  }, async ({ status }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.kits.list(status));
    });
  });

  server.tool('get_kit', 'Get a kit by ID with packs and computers', { id: z.number() }, async ({ id }) => {
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

  server.tool('update_kit', 'Update an existing kit', {
    id: z.number(),
    number: z.number().optional(),
    containerType: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    siteId: z.number().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.kits.update(id, input as any, user.id));
    });
  });

  // ─── Packs ──────────────────────────────────────────────────────────

  server.tool('list_packs', 'List packs, optionally filtered by kit ID', {
    kitId: z.number().optional(),
  }, async ({ kitId }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.packs.list(kitId));
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

  server.tool('list_items', 'List items, optionally filtered by pack ID', {
    packId: z.number().optional(),
  }, async ({ packId }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.items.list(packId));
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

  // ─── Computers ──────────────────────────────────────────────────────

  server.tool('list_computers', 'List all computers', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.computers.list());
    });
  });

  server.tool('get_computer', 'Get a computer by ID', { id: z.number() }, async ({ id }) => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.computers.get(id));
    });
  });

  server.tool('create_computer', 'Create a new computer', {
    serialNumber: z.string().optional(),
    serviceTag: z.string().optional(),
    model: z.string().optional(),
    defaultUsername: z.string().optional(),
    defaultPassword: z.string().optional(),
    disposition: z.string().optional(),
    dateReceived: z.string().optional(),
    notes: z.string().optional(),
    siteId: z.number().optional(),
    kitId: z.number().optional(),
    hostNameId: z.number().optional(),
  }, async (args) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.computers.create(args, user.id));
    });
  });

  server.tool('update_computer', 'Update an existing computer', {
    id: z.number(),
    serialNumber: z.string().optional(),
    serviceTag: z.string().optional(),
    model: z.string().optional(),
    defaultUsername: z.string().optional(),
    defaultPassword: z.string().optional(),
    disposition: z.string().optional(),
    dateReceived: z.string().optional(),
    notes: z.string().optional(),
    siteId: z.number().optional(),
    kitId: z.number().optional(),
    hostNameId: z.number().optional(),
  }, async ({ id, ...input }) => {
    return safeCall(async () => {
      requireQM();
      const { services, user } = getContext();
      return ok(await services.computers.update(id, input, user.id));
    });
  });

  // ─── Host Names ─────────────────────────────────────────────────────

  server.tool('list_hostnames', 'List all host names', {}, async () => {
    return safeCall(async () => {
      const { services } = getContext();
      return ok(await services.hostNames.list());
    });
  });

  // ─── Checkouts ──────────────────────────────────────────────────────

  server.tool('checkout_kit', 'Check out a kit to a destination site', {
    kitId: z.number(),
    destinationSiteId: z.number(),
  }, async (args) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.checkouts.checkOut(args, user.id));
    });
  });

  server.tool('checkin_kit', 'Check in a kit, returning it to a site', {
    checkoutId: z.number(),
    returnSiteId: z.number(),
  }, async ({ checkoutId, returnSiteId }) => {
    return safeCall(async () => {
      const { services, user } = getContext();
      return ok(await services.checkouts.checkIn(checkoutId, { returnSiteId }, user.id));
    });
  });
}
