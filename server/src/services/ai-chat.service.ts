import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { ServiceRegistry } from './service.registry';
import { User } from '@prisma/client';
import { hasQMAccess } from '../contracts';

const SYSTEM_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'ai-chat-system.txt'),
  'utf-8',
);

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
    { name: 'list_kits', description: 'List all kits, optionally filtered by status. Each kit has a user-facing "number" and a database "id" — when a user says "Kit 17" they mean number=17, NOT id=17. Use this tool to find the database ID for a given kit number.', input_schema: { type: 'object', properties: { status: { type: 'string' } }, required: [] }, requiresQM: false },
    { name: 'get_kit', description: 'Get a kit by database ID (not kit number!) with packs and computers. Use list_kits first to find the database ID from a kit number.', input_schema: { type: 'object', properties: { id: { type: 'number', description: 'Database ID of the kit (NOT the kit number)' } }, required: ['id'] }, requiresQM: false },
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

    // ─── Transfers ────────────────────────────────────
    { name: 'transfer_kit', description: 'Transfer a kit to a new custodian and/or site', input_schema: { type: 'object', properties: { kitId: { type: 'number' }, custodianId: { type: ['number', 'null'] }, siteId: { type: ['number', 'null'] }, notes: { type: 'string' } }, required: ['kitId'] }, requiresQM: false },
    { name: 'transfer_computer', description: 'Transfer a standalone computer to a new custodian and/or site', input_schema: { type: 'object', properties: { computerId: { type: 'number' }, custodianId: { type: ['number', 'null'] }, siteId: { type: ['number', 'null'] }, notes: { type: 'string' } }, required: ['computerId'] }, requiresQM: false },

    // ─── Issues ──────────────────────────────────────
    { name: 'list_issues', description: 'List issues with optional filters by status, type, kitId, packId, or computerId', input_schema: { type: 'object', properties: { status: { type: 'string', description: 'OPEN or RESOLVED' }, type: { type: 'string', description: 'MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER' }, kitId: { type: 'number' }, packId: { type: 'number' }, computerId: { type: 'number' } }, required: [] }, requiresQM: false },
    { name: 'create_issue', description: 'Create an issue on a kit, pack, or computer. Provide exactly one of kitId, packId, or computerId.', input_schema: { type: 'object', properties: { type: { type: 'string', description: 'MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, or OTHER' }, kitId: { type: 'number' }, packId: { type: 'number' }, computerId: { type: 'number' }, itemId: { type: 'number' }, notes: { type: 'string' } }, required: ['type'] }, requiresQM: true },
    { name: 'resolve_issue', description: 'Resolve an open issue by ID', input_schema: { type: 'object', properties: { id: { type: 'number' }, notes: { type: 'string' } }, required: ['id'] }, requiresQM: true },
  ];
}

/**
 * Build the system prompt with dynamic user context.
 */
/** Page context from the frontend — which page/entity the user is viewing. */
export interface PageContext {
  page: string;
  entityType?: string;
  entityId?: number;
}

async function buildSystemPrompt(
  user: User,
  services: ServiceRegistry,
  pageContext?: PageContext,
): Promise<string> {
  let prompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{{userName}}', user.displayName)
    .replace('{{userRole}}', user.role)
    .replace('{{userId}}', String(user.id));

  // Remove location section placeholder (we don't have coords from the web chat)
  prompt = prompt.replace(/\{\{#userLocation\}\}[\s\S]*?\{\{\/userLocation\}\}/g, '');

  // Inject page context if available
  if (pageContext?.entityType && pageContext?.entityId) {
    let entityDesc = `${pageContext.entityType} (ID: ${pageContext.entityId})`;
    try {
      if (pageContext.entityType === 'kit') {
        const kit = await services.kits.get(pageContext.entityId);
        entityDesc = `Kit #${kit.number}: ${kit.name}`;
      } else if (pageContext.entityType === 'computer') {
        const computer = await services.computers.get(pageContext.entityId);
        entityDesc = `Computer: ${computer.hostName?.name || computer.model || `#${computer.id}`}`;
      } else if (pageContext.entityType === 'site') {
        const site = await services.sites.get(pageContext.entityId);
        entityDesc = `Site: ${site.name}`;
      }
    } catch { /* use fallback description */ }
    prompt += `\n\n## Current Page\n\nThe user is currently viewing the **${pageContext.page}** page for **${entityDesc}**. When they say "this kit", "this computer", or similar, they are referring to this entity.\n`;
  } else if (pageContext?.page) {
    prompt += `\n\n## Current Page\n\nThe user is currently on the **${pageContext.page}** page.\n`;
  }

  // Fetch recent activity for context
  try {
    const activity = await services.reports.getUserActivity(user.id, 5);
    if (activity.length > 0) {
      const lines = activity.map((a: any) =>
        `- ${a.objectType} #${a.objectId}: ${a.field} changed from "${a.oldValue || '—'}" to "${a.newValue || '—'}" (${new Date(a.createdAt).toLocaleDateString()})`,
      ).join('\n');
      prompt = prompt
        .replace('{{#recentActivity}}', '')
        .replace('{{/recentActivity}}', '')
        .replace('{{recentActivity}}', lines);
    } else {
      prompt = prompt.replace(/\{\{#recentActivity\}\}[\s\S]*?\{\{\/recentActivity\}\}/g, '');
    }
  } catch {
    prompt = prompt.replace(/\{\{#recentActivity\}\}[\s\S]*?\{\{\/recentActivity\}\}/g, '');
  }

  return prompt;
}

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

      // Transfers
      case 'transfer_kit': return JSON.stringify(await services.transfers.transfer({ objectType: 'Kit', objectId: input.kitId as number, custodianId: input.custodianId as number | null | undefined, siteId: input.siteId as number | null | undefined, notes: input.notes as string | undefined }, userId), null, 2);
      case 'transfer_computer': return JSON.stringify(await services.transfers.transfer({ objectType: 'Computer', objectId: input.computerId as number, custodianId: input.custodianId as number | null | undefined, siteId: input.siteId as number | null | undefined, notes: input.notes as string | undefined }, userId), null, 2);

      // Issues
      case 'list_issues': return JSON.stringify(await services.issues.list(input as any), null, 2);
      case 'create_issue': return JSON.stringify(await services.issues.create(input as any, userId), null, 2);
      case 'resolve_issue': return JSON.stringify(await services.issues.resolve(input.id as number, { notes: input.notes as string | undefined }, userId), null, 2);

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
    const filtered = hasQMAccess(role)
      ? allTools
      : allTools.filter(t => !t.requiresQM);

    return filtered.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));
  }

  /**
   * Screen a message with Haiku to check if it's inventory-related.
   * Returns true if the message should be allowed through.
   */
  async screenMessage(message: string, recentMessages: ChatMessage[]): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.client) return { allowed: true };

    const context = recentMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const screenPrompt = context
      ? `Recent conversation:\n${context}\n\nNew message: ${message}`
      : `Message: ${message}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: `You are a topic guard for an inventory management system. Determine if the user's message is reasonably related to inventory management (equipment kits, computers, sites, transfers, items, packs, hostnames, reports, or general questions about the system). Allow greetings, clarifications, and follow-ups to previous inventory topics. Reply with ONLY "yes" or "no".`,
        messages: [{ role: 'user', content: screenPrompt }],
      });

      const answer = response.content[0]?.type === 'text' ? response.content[0].text.trim().toLowerCase() : 'yes';
      if (answer.startsWith('no')) {
        return { allowed: false, reason: 'This chat is for inventory management. Please ask about kits, computers, sites, transfers, or other inventory topics.' };
      }
      return { allowed: true };
    } catch {
      // If screening fails, allow the message through
      return { allowed: true };
    }
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
    pageContext?: PageContext,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('AI is not configured — set ANTHROPIC_API_KEY');
    }

    const tools = this.getToolsForRole(user.role);
    const systemPrompt = await buildSystemPrompt(user, services, pageContext);

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
        system: systemPrompt,
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
