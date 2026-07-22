import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ServiceRegistry } from './service.registry';
import { User } from '@prisma/client';
import { hasQMAccess } from '../contracts';
import { createMcpServer } from '../mcp/server';
import { mcpContext } from '../mcp/context';

const SYSTEM_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'ai-chat-system.txt'),
  'utf-8',
);

/**
 * Anthropic model IDs, configurable via environment.
 *
 * AI_CHAT_MODEL      — the main conversational assistant (agentic tool loop + streaming).
 * AI_SCREENING_MODEL — the cheap topic-guard that gates messages before the chat model runs.
 *
 * Defaults are current, non-dated aliases so a retired snapshot can't silently
 * 404 the assistant (as claude-sonnet-4-20250514 did after its 2026-06-15 retirement).
 */
const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'claude-sonnet-5';
const SCREENING_MODEL = process.env.AI_SCREENING_MODEL || 'claude-haiku-4-5';

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
 * The shape every tool in `mcp/tools.ts` actually returns (via its `ok()` /
 * `toolError()` helpers): a text-content array plus an optional `isError`
 * flag. The MCP SDK's `callTool()` return type is a wider union that also
 * covers a structured `toolResult` shape no registered tool here produces;
 * narrowing to this shape keeps the mapping to Anthropic's tool-result
 * block straightforward.
 */
interface McpToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
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
   *
   * The catalog itself comes from the MCP server's own `tools/list` —
   * there is no second, hand-maintained tool table. This connects a
   * throwaway in-process client to a fresh `McpServer` (the same one
   * external MCP clients use, via the shared `createMcpServer()`), lists
   * its tools, and hides the ones `_meta.requiresQM` marks as
   * Quartermaster-only from non-QM roles. Listing tools involves no
   * handler execution, so unlike tool *calls* it needs no `mcpContext`.
   */
  async getToolsForRole(role: string): Promise<Anthropic.Tool[]> {
    const server = createMcpServer();
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'ai-chat-tool-list', version: '1.0.0' });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const visible = hasQMAccess(role)
        ? tools
        : tools.filter(t => (t._meta as { requiresQM?: boolean } | undefined)?.requiresQM !== true);

      return visible.map(t => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
      }));
    } finally {
      await client.close();
      await server.close();
    }
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
        model: SCREENING_MODEL,
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
   * Run `fn` with an in-process MCP client connected to a fresh `McpServer`
   * — the same server (and the same `registerTools()` catalog) external
   * MCP clients use — for the duration of one request. Mirrors
   * `createMcpHandler`'s per-HTTP-request lifecycle: one fresh
   * server/transport-pair/client, one `mcpContext.run({ user, services })`
   * spanning every tool call `fn` makes (not re-established per call — see
   * the sprint's Design Rationale on why that would be a needless
   * deviation from the proven HTTP-path shape), resources closed on exit
   * either way.
   *
   * Exposed as its own method — distinct from `chat()`'s Anthropic loop —
   * so tests can exercise real tool execution (QM enforcement, pack
   * delegation, etc.) without driving the Anthropic API.
   */
  async withMcpClient<T>(
    user: User,
    services: ServiceRegistry,
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const server = createMcpServer();
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'ai-chat', version: '1.0.0' });

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      return await mcpContext.run({ user, services }, () => fn(client));
    } finally {
      await client.close();
      await server.close();
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
    const anthropic = this.client;

    const tools = await this.getToolsForRole(user.role);
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

    await this.withMcpClient(user, services, async (mcpClient) => {
      // Agentic loop: keep calling Claude until we get a final response
      while (true) {
        const stream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 4096,
          // Sonnet 5 runs adaptive thinking by default; disable it to preserve the
          // prior (Sonnet 4) no-thinking behavior and keep the full 4096-token
          // budget for the reply rather than sharing it with thinking.
          thinking: { type: 'disabled' },
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
          const result = await mcpClient.callTool({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          }) as McpToolCallResult;
          const content = Array.isArray(result.content)
            ? result.content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map(c => c.text)
              .join('\n')
            : '';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content,
            is_error: result.isError,
          });
        }

        messages.push({ role: 'user', content: toolResults });
      }
    });

    return fullText;
  }
}
