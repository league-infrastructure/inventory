import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User } from '@prisma/client';
import { ServiceRegistry } from '../services/service.registry';
import { mcpContext } from './context';
import { registerTools } from './tools';

const mcpServer = new McpServer(
  { name: 'inventory', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

registerTools(mcpServer);

export function createMcpHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const user = req.user as User;
    const services = ServiceRegistry.create(prisma, 'MCP');

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    mcpContext.run({ user, services }, async () => {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
  };
}
