import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ServiceRegistry } from '../services/service.registry';
import { AiChatService, ChatMessage } from '../services/ai-chat.service';
import { prisma } from '../services/prisma';

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const BOT_TOKEN = process.env.SLACK_BOT_USER_OAUTH_TOKEN || '';

/** Verify Slack request signature using HMAC-SHA256. */
function verifySlackSignature(req: Request): boolean {
  if (!SIGNING_SECRET) return false;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) return false;

  const baseString = `v0:${timestamp}:${rawBody.toString()}`;
  const computed = 'v0=' + crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(baseString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature),
  );
}

/** Post a message to a Slack channel via the Web API. */
async function postMessage(channel: string, text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  });
}

/** Look up a Slack user's email via users.info. */
async function getSlackUserEmail(slackUserId: string): Promise<string | null> {
  const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
    headers: { 'Authorization': `Bearer ${BOT_TOKEN}` },
  });
  const data = await res.json() as any;
  return data.ok ? (data.user?.profile?.email || null) : null;
}

export function slackRouter(services: ServiceRegistry): Router {
  const router = Router();
  const aiChat = new AiChatService();

  // Slack Events API endpoint
  router.post('/slack/events', async (req: Request, res: Response) => {
    // URL verification challenge (Slack sends this when you set the URL)
    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // Verify signature for all other requests
    if (!verifySlackSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Acknowledge immediately (Slack requires response within 3 seconds)
    res.status(200).json({ ok: true });

    // Process the event asynchronously
    const event = req.body?.event;
    if (!event) return;

    // Only handle DM messages (not bot messages to avoid loops)
    if (event.type !== 'message' || event.subtype || event.bot_id) return;

    const slackUserId = event.user as string;
    const channel = event.channel as string;
    const text = event.text as string;

    if (!text || !channel) return;

    try {
      // Map Slack user to inventory user by email
      const email = await getSlackUserEmail(slackUserId);
      if (!email) {
        await postMessage(channel, "I couldn't find your email in Slack. Make sure your email is visible in your Slack profile.");
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        await postMessage(channel, `No inventory account found for ${email}. Please log in to the inventory system first.`);
        return;
      }

      // Screen with Haiku topic guard
      if (aiChat.isConfigured) {
        const screening = await aiChat.screenMessage(text, []);
        if (!screening.allowed) {
          await postMessage(channel, screening.reason || 'This chat is for inventory management questions only.');
          return;
        }
      } else {
        await postMessage(channel, 'AI is not configured — the ANTHROPIC_API_KEY is not set.');
        return;
      }

      // Route through AiChatService (collect full response, no streaming in Slack)
      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      let fullResponse = '';
      const response = await aiChat.chat(
        text,
        [],  // No conversation history for now (stateless DMs)
        user,
        aiServices,
        (delta) => { fullResponse += delta; },
        undefined,
      );

      await postMessage(channel, response || fullResponse || 'I processed your request but have no response to show.');
    } catch (err: any) {
      console.error('Slack event processing error:', err);
      await postMessage(channel, `Sorry, something went wrong: ${err.message || 'unknown error'}`);
    }
  });

  // /checkout slash command
  router.post('/slack/commands/checkout', async (req: Request, res: Response) => {
    if (!verifySlackSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Slash commands come as URL-encoded form data
    const { text: cmdText, user_id: slackUserId } = req.body || {};

    // Acknowledge with a helpful message
    res.json({
      response_type: 'ephemeral',
      text: cmdText
        ? `Looking up "${cmdText}"... I'll send you a DM with the result.`
        : 'Usage: `/checkout <kit name or QR code>`\n\nOr just DM me directly to manage inventory!',
    });

    if (!cmdText) return;

    try {
      const email = await getSlackUserEmail(slackUserId);
      if (!email) return;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return;

      // Open a DM channel with the user
      const dmRes = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: slackUserId }),
      });
      const dmData = await dmRes.json() as any;
      const dmChannel = dmData.channel?.id;
      if (!dmChannel) return;

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      const response = await aiChat.chat(
        `I want to check out: ${cmdText}`,
        [],
        user,
        aiServices,
        () => {},
        undefined,
      );

      await postMessage(dmChannel, response || 'Done processing your checkout request.');
    } catch (err: any) {
      console.error('Slack /checkout error:', err);
    }
  });

  return router;
}
