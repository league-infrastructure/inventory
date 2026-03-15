import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User } from '@prisma/client';
import { ServiceRegistry } from '../services/service.registry';
import { mcpContext } from './context';
import { registerTools } from './tools';

const MCP_INSTRUCTIONS = `CRITICAL RULES FOR COMMUNICATING WITH USERS:

1. NEVER mention database IDs, primary keys, or foreign keys to the user
   unless they explicitly ask for them. Users do not know or care about
   internal database identifiers.

2. Kits have a user-facing "number" field AND a database "id". These are
   NOT the same. When a user says "Kit 17", they mean the kit whose number
   is 17, NOT database ID 17. Always look up and refer to kits by their
   number field.

3. Computers are identified by their host name (e.g. "Aho") or model, not
   by database ID. Sites are identified by name, not ID.

4. All sorting, searching, and reporting should use human-meaningful fields
   (number, name, host name), not database IDs.

5. Use database IDs internally to call tools, but NEVER surface them in
   responses to the user. The only exception is when the user explicitly
   asks for database IDs.`;

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'inventory', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );
  server.prompt('instructions', 'Critical rules for using inventory tools and communicating with users', () => ({
    messages: [{ role: 'user', content: { type: 'text', text: MCP_INSTRUCTIONS } }],
  }));
  registerTools(server);
  return server;
}

export function createMcpHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const user = req.user as User;
    const services = ServiceRegistry.create(prisma, 'MCP');

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    mcpContext.run({ user, services }, async () => {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
  };
}
