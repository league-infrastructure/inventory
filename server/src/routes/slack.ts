import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ServiceRegistry } from '../services/service.registry';
import { AiChatService } from '../services/ai-chat.service';
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

/** Convert Markdown to Slack mrkdwn format. */
function markdownToSlack(md: string): string {
  return md
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Bold: **text** → *text*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Italic: _text_ stays the same; *text* (single) → _text_
    // (only convert single * that aren't inside bold pairs)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_')
    // Headings: # text → *text*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // Bullet lists: - item → • item
    .replace(/^[-*]\s+/gm, '• ')
    // Numbered lists stay as-is (Slack handles them)
    // Horizontal rules
    .replace(/^---+$/gm, '───────────────');
}

/** Post a message to a Slack channel via the Web API. */
async function postMessage(channel: string, text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text: markdownToSlack(text) }),
  });
}

/** Look up a Slack user's profile via users.info. */
async function getSlackUserInfo(slackUserId: string): Promise<{ email: string | null; displayName: string | null }> {
  const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
    headers: { 'Authorization': `Bearer ${BOT_TOKEN}` },
  });
  const data = await res.json() as any;
  if (!data.ok) {
    console.error('Slack users.info failed:', data.error, '— does the bot have users:read.email scope?');
    return { email: null, displayName: null };
  }
  const profile = data.user?.profile;
  return {
    email: profile?.email || null,
    displayName: profile?.display_name || profile?.real_name || data.user?.name || null,
  };
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
      // Map Slack user to inventory user by email (primary) or display name (fallback)
      const slackInfo = await getSlackUserInfo(slackUserId);
      let user = slackInfo.email
        ? await prisma.user.findUnique({ where: { email: slackInfo.email } })
        : null;

      // Fallback: match by display name if email lookup failed
      if (!user && slackInfo.displayName) {
        user = await prisma.user.findFirst({
          where: { displayName: { equals: slackInfo.displayName, mode: 'insensitive' } },
        });
      }

      if (!user) {
        const hint = slackInfo.email
          ? `No inventory account found for ${slackInfo.email}.`
          : "I couldn't read your email from Slack (the bot may need the users:read.email scope — ask your admin to reinstall the app).";
        await postMessage(channel, `${hint} Please log in to the inventory system first.`);
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
      const slackInfo = await getSlackUserInfo(slackUserId);
      let user = slackInfo.email
        ? await prisma.user.findUnique({ where: { email: slackInfo.email } })
        : null;
      if (!user && slackInfo.displayName) {
        user = await prisma.user.findFirst({
          where: { displayName: { equals: slackInfo.displayName, mode: 'insensitive' } },
        });
      }
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
