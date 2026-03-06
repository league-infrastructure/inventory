import Anthropic from '@anthropic-ai/sdk';
import { ServiceRegistry } from './service.registry';
import { User } from '@prisma/client';

/** Tool definition in Anthropic format */
interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Whether this tool requires Quartermaster role */
  requiresQM: boolean;
}

/** A single message in the conversation */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Callback for streaming text deltas */
export type OnDelta = (text: string) => void;

/** Callback for tool use notifications */
export type OnToolUse = (name: string, input: Record<string, unknown>) => void;

/**
 * Inventory tool definitions for Claude.
 * Maps tool name → handler function and schema.
 */
function getToolDefinitions(): ToolDef[] {
  return [
    // ─── Sites ─────────────────────────────────────────
    { name: 'list_sites', description: 'List all active sites', input_schema: { type: 'object', properties: {}, required: [] }, requiresQM: false },
    { name: 'get_site', description: 'Get a site by ID', input_schema: { type: 'object', properties: { id: { type: 'number', description: 'Site ID' } }, required: ['id'] }, requiresQM: false },
    { name: 'create_site', description: 'Create a new site', input_schema: { type: 'object', properties: { name: { type: 'string' }, address: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, isHomeSite: { type: 'boolean' } }, required: ['name'] }, requiresQM: true },
    { name: 'update_site', description: 'Update an existing site', input_schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, address: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, isHomeSite: { type: 'boolean' }, isActive: { type: 'boolean' } }, required: ['id'] }, requiresQM: true },
    { name: 'delete_site', description: 'Delete a site (must have no kits assigned and be deactivated)', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Kits ──────────────────────────────────────────
    { name: 'list_kits', description: 'List all kits, optionally filtered by status', input_schema: { type: 'object', properties: { status: { type: 'string' } }, required: [] }, requiresQM: false },
    { name: 'get_kit', description: 'Get a kit by ID with packs and computers', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: false },
    { name: 'create_kit', description: 'Create a new kit', input_schema: { type: 'object', properties: { number: { type: 'number' }, containerType: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, siteId: { type: 'number' } }, required: ['number', 'name', 'siteId'] }, requiresQM: true },
    { name: 'update_kit', description: 'Update an existing kit', input_schema: { type: 'object', properties: { id: { type: 'number' }, number: { type: 'number' }, containerType: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, siteId: { type: 'number' }, status: { type: 'string' } }, required: ['id'] }, requiresQM: true },
    { name: 'delete_kit', description: 'Delete a kit (must be retired and have no packs or computers)', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Packs ─────────────────────────────────────────
    { name: 'list_packs', description: 'List packs, optionally filtered by kit ID', input_schema: { type: 'object', properties: { kitId: { type: 'number' } }, required: [] }, requiresQM: false },
    { name: 'create_pack', description: 'Create a new pack in a kit', input_schema: { type: 'object', properties: { kitId: { type: 'number' }, name: { type: 'string' }, description: { type: 'string' } }, required: ['kitId', 'name'] }, requiresQM: true },
    { name: 'update_pack', description: 'Update an existing pack', input_schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, description: { type: 'string' } }, required: ['id'] }, requiresQM: true },
    { name: 'delete_pack', description: 'Delete a pack', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Items ─────────────────────────────────────────
    { name: 'list_items', description: 'List items, optionally filtered by pack ID', input_schema: { type: 'object', properties: { packId: { type: 'number' } }, required: [] }, requiresQM: false },
    { name: 'create_item', description: 'Create a new item in a pack', input_schema: { type: 'object', properties: { packId: { type: 'number' }, name: { type: 'string' }, type: { type: 'string', description: 'COUNTED or CONSUMABLE' }, expectedQuantity: { type: 'number' } }, required: ['packId', 'name', 'type'] }, requiresQM: true },
    { name: 'update_item', description: 'Update an existing item', input_schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, type: { type: 'string' }, expectedQuantity: { type: 'number' } }, required: ['id'] }, requiresQM: true },
    { name: 'delete_item', description: 'Delete an item', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Computers ─────────────────────────────────────
    { name: 'list_computers', description: 'List all computers', input_schema: { type: 'object', properties: {}, required: [] }, requiresQM: false },
    { name: 'get_computer', description: 'Get a computer by ID', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: false },
    { name: 'create_computer', description: 'Create a new computer', input_schema: { type: 'object', properties: { serialNumber: { type: 'string' }, serviceTag: { type: 'string' }, model: { type: 'string' }, defaultUsername: { type: 'string' }, defaultPassword: { type: 'string' }, disposition: { type: 'string' }, notes: { type: 'string' }, siteId: { type: 'number' }, kitId: { type: 'number' }, hostNameId: { type: 'number' } }, required: [] }, requiresQM: true },
    { name: 'update_computer', description: 'Update an existing computer', input_schema: { type: 'object', properties: { id: { type: 'number' }, serialNumber: { type: 'string' }, serviceTag: { type: 'string' }, model: { type: 'string' }, defaultUsername: { type: 'string' }, defaultPassword: { type: 'string' }, disposition: { type: 'string' }, notes: { type: 'string' }, siteId: { type: 'number' }, kitId: { type: 'number' }, hostNameId: { type: 'number' } }, required: ['id'] }, requiresQM: true },
    { name: 'delete_computer', description: 'Delete a computer', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Host Names ────────────────────────────────────
    { name: 'list_hostnames', description: 'List all host names', input_schema: { type: 'object', properties: {}, required: [] }, requiresQM: false },
    { name: 'create_hostname', description: 'Create a new host name', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, requiresQM: true },
    { name: 'update_hostname', description: 'Rename a host name', input_schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } }, required: ['id', 'name'] }, requiresQM: true },
    { name: 'delete_hostname', description: 'Delete an unassigned host name', input_schema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }, requiresQM: true },

    // ─── Checkouts ─────────────────────────────────────
    { name: 'checkout_kit', description: 'Check out a kit (assigns it to the authenticated user)', input_schema: { type: 'object', properties: { kitId: { type: 'number' } }, required: ['kitId'] }, requiresQM: false },
    { name: 'checkin_kit', description: 'Check in a kit, returning it to a site', input_schema: { type: 'object', properties: { checkoutId: { type: 'number' }, returnSiteId: { type: 'number' } }, required: ['checkoutId', 'returnSiteId'] }, requiresQM: false },
  ];
}

const SYSTEM_PROMPT = `You are an AI assistant for the League of Amazing Programmers inventory management system. You help users manage equipment kits, packs, items, computers, sites, and checkouts.

You have access to tools that let you read and modify inventory data. Use them to fulfill user requests.

Key concepts:
- **Sites** are physical locations where equipment is stored.
- **Kits** are containers (bags, totes) that hold packs and are assigned to a site.
- **Packs** are groups of related items within a kit (e.g., "Laptops", "Cables").
- **Items** are individual pieces within a pack, either COUNTED (with expected quantity) or CONSUMABLE (variable quantity).
- **Computers** are tracked hardware assets with serial numbers, host names, and disposition status.
- **Checkouts** track when kits are borrowed and returned.

Be concise and helpful. When you make changes, summarize what you did.`;

/**
 * Execute a tool call against the service layer.
 */
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  services: ServiceRegistry,
  user: User,
): Promise<string> {
  const userId = user.id;

  try {
    switch (name) {
      // Sites
      case 'list_sites': return JSON.stringify(await services.sites.list(), null, 2);
      case 'get_site': return JSON.stringify(await services.sites.get(input.id as number), null, 2);
      case 'create_site': return JSON.stringify(await services.sites.create(input as any, userId), null, 2);
      case 'update_site': { const { id, ...rest } = input; return JSON.stringify(await services.sites.update(id as number, rest as any, userId), null, 2); }
      case 'delete_site': { await services.prisma.site.delete({ where: { id: input.id as number } }); return JSON.stringify({ deleted: true }); }

      // Kits
      case 'list_kits': return JSON.stringify(await services.kits.list(input.status as string | undefined), null, 2);
      case 'get_kit': return JSON.stringify(await services.kits.get(input.id as number), null, 2);
      case 'create_kit': return JSON.stringify(await services.kits.create(input as any, userId), null, 2);
      case 'update_kit': { const { id, ...rest } = input; return JSON.stringify(await services.kits.update(id as number, rest as any, userId), null, 2); }
      case 'delete_kit': { await services.prisma.kit.delete({ where: { id: input.id as number } }); return JSON.stringify({ deleted: true }); }

      // Packs
      case 'list_packs': return JSON.stringify(await services.packs.list(input.kitId as number | undefined), null, 2);
      case 'create_pack': { const { kitId, ...rest } = input; return JSON.stringify(await services.packs.create(rest as any, userId, kitId as number), null, 2); }
      case 'update_pack': { const { id, ...rest } = input; return JSON.stringify(await services.packs.update(id as number, rest as any, userId), null, 2); }
      case 'delete_pack': { await services.packs.delete(input.id as number, userId); return JSON.stringify({ deleted: true }); }

      // Items
      case 'list_items': return JSON.stringify(await services.items.list(input.packId as number | undefined), null, 2);
      case 'create_item': { const { packId, ...rest } = input; return JSON.stringify(await services.items.create(rest as any, userId, packId as number), null, 2); }
      case 'update_item': { const { id, ...rest } = input; return JSON.stringify(await services.items.update(id as number, rest as any, userId), null, 2); }
      case 'delete_item': { await services.items.delete(input.id as number, userId); return JSON.stringify({ deleted: true }); }

      // Computers
      case 'list_computers': return JSON.stringify(await services.computers.list(), null, 2);
      case 'get_computer': return JSON.stringify(await services.computers.get(input.id as number), null, 2);
      case 'create_computer': return JSON.stringify(await services.computers.create(input as any, userId), null, 2);
      case 'update_computer': { const { id, ...rest } = input; return JSON.stringify(await services.computers.update(id as number, rest as any, userId), null, 2); }
      case 'delete_computer': { await services.prisma.computer.delete({ where: { id: input.id as number } }); return JSON.stringify({ deleted: true }); }

      // Host Names
      case 'list_hostnames': return JSON.stringify(await services.hostNames.list(), null, 2);
      case 'create_hostname': return JSON.stringify(await services.hostNames.create({ name: input.name as string }, userId), null, 2);
      case 'update_hostname': return JSON.stringify(await services.hostNames.update(input.id as number, { name: input.name as string }, userId), null, 2);
      case 'delete_hostname': { await services.hostNames.delete(input.id as number); return JSON.stringify({ deleted: true }); }

      // Checkouts
      case 'checkout_kit': return JSON.stringify(await services.checkouts.checkOut({ kitId: input.kitId as number }, userId), null, 2);
      case 'checkin_kit': return JSON.stringify(await services.checkouts.checkIn(input.checkoutId as number, { returnSiteId: input.returnSiteId as number }, userId), null, 2);

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || 'Tool execution failed' });
  }
}

export class AiChatService {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get available tools filtered by user role.
   */
  getToolsForRole(role: string): Anthropic.Tool[] {
    const allTools = getToolDefinitions();
    const filtered = role === 'QUARTERMASTER'
      ? allTools
      : allTools.filter(t => !t.requiresQM);

    return filtered.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));
  }

  /**
   * Process a chat message with streaming.
   */
  async chat(
    message: string,
    conversationHistory: ChatMessage[],
    user: User,
    services: ServiceRegistry,
    onDelta: OnDelta,
    onToolUse?: OnToolUse,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('AI is not configured — set ANTHROPIC_API_KEY');
    }

    const tools = this.getToolsForRole(user.role);

    // Build messages array from history + current message
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    let fullText = '';

    // Agentic loop: keep calling Claude until we get a final response
    while (true) {
      const stream = this.client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      const response = await stream.finalMessage();

      // Collect text and tool use blocks
      let responseText = '';
      const toolUseBlocks: Anthropic.ContentBlock[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
          onDelta(block.text);
          fullText += block.text;
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
        }
      }

      // If no tool calls, we're done
      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        break;
      }

      // Execute tool calls and build tool results
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        if (block.type !== 'tool_use') continue;
        if (onToolUse) onToolUse(block.name, block.input as Record<string, unknown>);
        const result = await executeTool(block.name, block.input as Record<string, unknown>, services, user);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return fullText;
  }
}
