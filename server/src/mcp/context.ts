import { AsyncLocalStorage } from 'async_hooks';
import { User } from '@prisma/client';
import { ServiceRegistry } from '../services/service.registry';

export interface McpContext {
  user: User;
  services: ServiceRegistry;
}

export const mcpContext = new AsyncLocalStorage<McpContext>();
