import { Router, Request, Response } from 'express';
import { User } from '@prisma/client';
import { AiChatService, ChatMessage } from '../services/ai-chat.service';
import { ServiceRegistry } from '../services/service.registry';

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
};

export function aiChatRouter(services: ServiceRegistry): Router {
  const router = Router();
  const aiChat = new AiChatService();

  // Status endpoint — is AI configured?
  router.get('/ai/status', (_req, res) => {
    res.json({ configured: aiChat.isConfigured });
  });

  // Chat endpoint — streams SSE
  router.post('/ai/chat', requireAuth, async (req: Request, res: Response) => {
    if (!aiChat.isConfigured) {
      return res.status(503).json({ error: 'AI is not configured — set ANTHROPIC_API_KEY' });
    }

    const { message, conversationHistory = [], pageContext } = req.body as {
      message: string;
      conversationHistory?: ChatMessage[];
      pageContext?: { page: string; entityType?: string; entityId?: number };
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Screen message with Haiku topic guard
    const screening = await aiChat.screenMessage(message, conversationHistory);
    if (!screening.allowed) {
      return res.json({ rejected: true, reason: screening.reason });
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Create a fresh service registry with MCP audit source for AI changes
      const aiServices = ServiceRegistry.create(undefined, 'MCP');

      const fullText = await aiChat.chat(
        message,
        conversationHistory,
        req.user as User,
        aiServices,
        (text) => sendEvent({ type: 'delta', text }),
        (name, input) => sendEvent({ type: 'tool_use', name, input }),
        pageContext,
      );

      sendEvent({ type: 'done', fullText });
    } catch (err: any) {
      sendEvent({ type: 'error', error: err.message || 'AI request failed' });
    }

    res.end();
  });

  return router;
}
