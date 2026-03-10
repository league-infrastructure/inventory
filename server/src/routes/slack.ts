import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ServiceRegistry } from '../services/service.registry';
import { AiChatService } from '../services/ai-chat.service';
import { prisma } from '../services/prisma';

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const BOT_TOKEN = process.env.SLACK_BOT_USER_OAUTH_TOKEN || '';
const APP_DOMAIN = process.env.APP_DOMAIN || 'inventory.jointheleague.org';
let BOT_USER_ID: string | null = null;
const recentEventIds = new Map<string, number>();

/** Fetch and cache the bot's own Slack user ID. */
async function getBotUserId(): Promise<string | null> {
  if (BOT_USER_ID) return BOT_USER_ID;
  if (!BOT_TOKEN) return null;
  const res = await fetch('https://slack.com/api/auth.test', {
    headers: { 'Authorization': `Bearer ${BOT_TOKEN}` },
  });
  const data = await res.json() as any;
  if (data.ok) BOT_USER_ID = data.user_id;
  return BOT_USER_ID;
}

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
async function postMessage(channel: string, text: string, threadTs?: string): Promise<void> {
  const payload: Record<string, string> = { channel, text: markdownToSlack(text) };
  if (threadTs) payload.thread_ts = threadTs;
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

/** Resolve a Slack user ID to an inventory User, or null. */
async function resolveInventoryUser(slackUserId: string) {
  const slackInfo = await getSlackUserInfo(slackUserId);
  let user = slackInfo.email
    ? await prisma.user.findUnique({ where: { email: slackInfo.email } })
    : null;
  if (!user && slackInfo.displayName) {
    user = await prisma.user.findFirst({
      where: { displayName: { equals: slackInfo.displayName, mode: 'insensitive' } },
    });
  }
  return user;
}

/** Standard guard for slash commands: verify signature and resolve user. */
function slashGuard(req: Request, res: Response): boolean {
  if (!verifySlackSignature(req)) {
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }
  return true;
}

export function slackRouter(services: ServiceRegistry): Router {
  const router = Router();
  const aiChat = new AiChatService();

  // ─── Slack Events API ───────────────────────────────────────────

  router.post('/slack/events', async (req: Request, res: Response) => {
    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }
    if (!verifySlackSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    res.status(200).json({ ok: true });

    // Deduplicate events (Slack retries can cause duplicates)
    const eventId = req.body?.event_id || req.body?.event?.client_msg_id;
    if (eventId) {
      if (recentEventIds.has(eventId)) return;
      recentEventIds.set(eventId, Date.now());
      if (recentEventIds.size > 200) {
        const cutoff = Date.now() - 120000;
        for (const [id, ts] of recentEventIds) {
          if (ts < cutoff) recentEventIds.delete(id);
        }
      }
    }

    const event = req.body?.event;
    if (!event) return;

    console.log('Slack event:', JSON.stringify({ type: event.type, subtype: event.subtype, bot_id: event.bot_id, channel_type: event.channel_type, channel: event.channel, user: event.user, text: event.text?.substring(0, 100) }));

    if (event.bot_id || event.subtype) return;

    const isDirectMessage = event.type === 'message' && event.channel_type === 'im';
    const isAppMention = event.type === 'app_mention';
    const botId = await getBotUserId();
    const rawText = event.text as string || '';
    const isBotMentioned = botId ? rawText.includes(`<@${botId}>`) : false;
    const isChannelMessage = event.type === 'message' && ['channel', 'group', 'mpim'].includes(event.channel_type);

    if (!isDirectMessage && !isAppMention && !(isChannelMessage && isBotMentioned)) return;

    const slackUserId = event.user as string;
    const channel = event.channel as string;
    let text = rawText.replace(/<@[A-Z0-9]+>\s*/g, '').trim();
    if (!text || !channel) return;

    const threadTs = !isDirectMessage ? (event.thread_ts || event.ts) : undefined;

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) {
        await postMessage(channel, "I couldn't match your Slack account to an inventory user. Please log in to the inventory system first.", threadTs);
        return;
      }

      if (aiChat.isConfigured) {
        const screening = await aiChat.screenMessage(text, []);
        if (!screening.allowed) {
          await postMessage(channel, screening.reason || 'This chat is for inventory management questions only.', threadTs);
          return;
        }
      } else {
        await postMessage(channel, 'AI is not configured — the ANTHROPIC_API_KEY is not set.', threadTs);
        return;
      }

      // Send immediate receipt so the user knows we're working on it
      await postMessage(channel, "Got your message — working on it now.", threadTs);

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      let fullResponse = '';
      const response = await aiChat.chat(
        text, [], user, aiServices,
        (delta) => { fullResponse += delta; },
        undefined,
      );
      await postMessage(channel, response || fullResponse || 'I processed your request but have no response to show.', threadTs);
    } catch (err: any) {
      console.error('Slack event processing error:', err);
      await postMessage(channel, `Sorry, something went wrong: ${err.message || 'unknown error'}`, threadTs);
    }
  });

  // ─── /inventory <name or number> ────────────────────────────────

  router.post('/slack/commands/inventory', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: query, user_id: slackUserId } = req.body || {};

    if (!query) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/inventory <name or number>`' });
    }

    res.json({ response_type: 'in_channel', text: `Looking up "${query}"...` });

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) return;

      // Try kit number first
      const kitNum = parseInt(query, 10);
      if (!isNaN(kitNum)) {
        const kit = await prisma.kit.findFirst({
          where: { number: kitNum },
          include: { site: true, custodian: true, category: true },
        });
        if (kit) {
          const dmChannel = await openDm(slackUserId);
          if (dmChannel) {
            await postMessage(dmChannel, formatKit(kit));
          }
          return;
        }
      }

      // Fall back to search
      const results = await services.search.search(query, 10);
      if (results.length === 0) {
        const dmChannel = await openDm(slackUserId);
        if (dmChannel) await postMessage(dmChannel, `No results found for "${query}".`);
        return;
      }

      const lines = results.map(r => `• *${r.title}* — ${r.subtitle} (https://${APP_DOMAIN}${r.url})`);
      const dmChannel = await openDm(slackUserId);
      if (dmChannel) {
        await postMessage(dmChannel, `*Search results for "${query}":*\n${lines.join('\n')}`);
      }
    } catch (err: any) {
      console.error('Slack /inventory error:', err);
    }
  });

  // ─── /haswhat <person> ──────────────────────────────────────────

  router.post('/slack/commands/haswhat', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: personName, user_id: slackUserId } = req.body || {};

    if (!personName) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/haswhat <person name>`' });
    }

    res.json({ response_type: 'in_channel', text: `Looking up what ${personName} has...` });

    try {
      const person = await prisma.user.findFirst({
        where: { displayName: { contains: personName, mode: 'insensitive' } },
        include: {
          custodiedKits: { include: { site: true } },
          custodiedComputers: { where: { kitId: null }, include: { site: true } },
        },
      });

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      if (!person) {
        await postMessage(dmChannel, `No user found matching "${personName}".`);
        return;
      }

      const lines: string[] = [`*${person.displayName}* has:`];

      if (person.custodiedKits.length === 0 && person.custodiedComputers.length === 0) {
        lines.push('Nothing checked out.');
      } else {
        for (const kit of person.custodiedKits) {
          lines.push(`• Kit #${(kit as any).number}: ${kit.name} — at ${(kit as any).site?.name || 'unknown site'}`);
        }
        for (const comp of person.custodiedComputers) {
          lines.push(`• Computer: ${comp.model || 'unknown'} (${comp.serialNumber}) — at ${(comp as any).site?.name || 'unknown site'}`);
        }
      }

      await postMessage(dmChannel, lines.join('\n'));
    } catch (err: any) {
      console.error('Slack /haswhat error:', err);
    }
  });

  // ─── /whereis <kit or computer> ─────────────────────────────────

  router.post('/slack/commands/whereis', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: query, user_id: slackUserId } = req.body || {};

    if (!query) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/whereis <kit name, number, or serial>`' });
    }

    res.json({ response_type: 'in_channel', text: `Looking up "${query}"...` });

    try {
      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      // Try kit by number
      const kitNum = parseInt(query, 10);
      if (!isNaN(kitNum)) {
        const kit = await prisma.kit.findFirst({
          where: { number: kitNum },
          include: { site: true, custodian: true },
        }) as any;
        if (kit) {
          await postMessage(dmChannel, formatLocation('Kit', `#${kit.number}: ${kit.name}`, kit.site, kit.custodian, kit.lastInventoried));
          return;
        }
      }

      // Try kit by name
      const kit = await prisma.kit.findFirst({
        where: { name: { contains: query, mode: 'insensitive' } },
        include: { site: true, custodian: true },
      }) as any;
      if (kit) {
        await postMessage(dmChannel, formatLocation('Kit', `#${kit.number}: ${kit.name}`, kit.site, kit.custodian, kit.lastInventoried));
        return;
      }

      // Try computer by serial
      const computer = await prisma.computer.findFirst({
        where: {
          OR: [
            { serialNumber: { contains: query, mode: 'insensitive' } },
            { serviceTag: { contains: query, mode: 'insensitive' } },
            { model: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { site: true, custodian: true, kit: true },
      }) as any;
      if (computer) {
        const label = `${computer.model || 'Computer'} (${computer.serialNumber})`;
        const extra = computer.kit ? `\nIn kit #${computer.kit.number}: ${computer.kit.name}` : '';
        await postMessage(dmChannel, formatLocation('Computer', label, computer.site, computer.custodian, computer.lastInventoried) + extra);
        return;
      }

      await postMessage(dmChannel, `Nothing found for "${query}".`);
    } catch (err: any) {
      console.error('Slack /whereis error:', err);
    }
  });

  // ─── /checkin <kit> ─────────────────────────────────────────────

  router.post('/slack/commands/checkin', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: cmdText, user_id: slackUserId } = req.body || {};

    if (!cmdText) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/checkin <kit name or number>`' });
    }

    res.json({ response_type: 'in_channel', text: `Checking in "${cmdText}"...` });

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) return;

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      const response = await aiChat.chat(
        `I want to check in / return: ${cmdText}`,
        [], user, aiServices, () => {}, undefined,
      );
      await postMessage(dmChannel, response || 'Done processing your check-in request.');
    } catch (err: any) {
      console.error('Slack /checkin error:', err);
    }
  });

  // ─── /checkout <kit> ────────────────────────────────────────────

  router.post('/slack/commands/checkout', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: cmdText, user_id: slackUserId } = req.body || {};

    if (!cmdText) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/checkout <kit name or QR code>`\n\nOr just DM me directly to manage inventory!' });
    }

    res.json({ response_type: 'in_channel', text: `Checking out "${cmdText}"...` });

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) return;

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      const response = await aiChat.chat(
        `I want to check out: ${cmdText}`,
        [], user, aiServices, () => {}, undefined,
      );
      await postMessage(dmChannel, response || 'Done processing your checkout request.');
    } catch (err: any) {
      console.error('Slack /checkout error:', err);
    }
  });

  // ─── /transfer <item> to <site or person> ──────────────────────

  router.post('/slack/commands/transfer', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: cmdText, user_id: slackUserId } = req.body || {};

    if (!cmdText) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/transfer <item> to <site or person>`' });
    }

    res.json({ response_type: 'in_channel', text: `Processing transfer: "${cmdText}"...` });

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) return;

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      const response = await aiChat.chat(
        `Transfer: ${cmdText}`,
        [], user, aiServices, () => {}, undefined,
      );
      await postMessage(dmChannel, response || 'Done processing your transfer request.');
    } catch (err: any) {
      console.error('Slack /transfer error:', err);
    }
  });

  // ─── /report <item> <issue> ────────────────────────────────────

  router.post('/slack/commands/report', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: cmdText, user_id: slackUserId } = req.body || {};

    if (!cmdText) {
      return res.json({ response_type: 'in_channel', text: 'Usage: `/report <item> <issue description>`' });
    }

    res.json({ response_type: 'in_channel', text: `Filing report: "${cmdText}"...` });

    try {
      const user = await resolveInventoryUser(slackUserId);
      if (!user) return;

      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      const aiServices = ServiceRegistry.create(undefined, 'MCP');
      const response = await aiChat.chat(
        `Report an issue: ${cmdText}`,
        [], user, aiServices, () => {}, undefined,
      );
      await postMessage(dmChannel, response || 'Done filing your report.');
    } catch (err: any) {
      console.error('Slack /report error:', err);
    }
  });

  // ─── /sites ────────────────────────────────────────────────────

  router.post('/slack/commands/sites', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { user_id: slackUserId } = req.body || {};

    res.json({ response_type: 'in_channel', text: 'Fetching sites...' });

    try {
      const sites = await services.sites.list();
      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      // Count kits per site
      const kitCounts = await prisma.kit.groupBy({
        by: ['siteId'],
        _count: { id: true },
        where: { status: 'ACTIVE' },
      });
      const countMap = new Map(kitCounts.map(k => [k.siteId, k._count.id]));

      const lines = sites.map(s => {
        const count = countMap.get(s.id) || 0;
        const home = s.isHomeSite ? ' (home)' : '';
        return `• *${s.name}*${home} — ${count} active kit${count !== 1 ? 's' : ''} — ${s.address || 'no address'}`;
      });

      await postMessage(dmChannel, `*Active Sites:*\n${lines.join('\n')}`);
    } catch (err: any) {
      console.error('Slack /sites error:', err);
    }
  });

  // ─── /kits [site] ─────────────────────────────────────────────

  router.post('/slack/commands/kits', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;
    const { text: siteFilter, user_id: slackUserId } = req.body || {};

    res.json({ response_type: 'in_channel', text: siteFilter ? `Fetching kits at "${siteFilter}"...` : 'Fetching all kits...' });

    try {
      const dmChannel = await openDm(slackUserId);
      if (!dmChannel) return;

      let kits = await services.kits.list('ACTIVE');

      if (siteFilter) {
        const site = await prisma.site.findFirst({
          where: { name: { contains: siteFilter, mode: 'insensitive' }, isActive: true },
        });
        if (!site) {
          await postMessage(dmChannel, `No site found matching "${siteFilter}".`);
          return;
        }
        kits = kits.filter(k => k.siteId === site.id);
      }

      if (kits.length === 0) {
        await postMessage(dmChannel, siteFilter ? `No active kits at "${siteFilter}".` : 'No active kits found.');
        return;
      }

      const lines = kits.map(k => {
        const site = k.site ? k.site.name : 'unassigned';
        const custodian = k.custodian ? k.custodian.displayName : 'no custodian';
        return `• *Kit #${k.number}: ${k.name}* — ${site} — ${custodian}`;
      });

      const header = siteFilter ? `*Active kits at "${siteFilter}":*` : '*All active kits:*';
      await postMessage(dmChannel, `${header}\n${lines.join('\n')}`);
    } catch (err: any) {
      console.error('Slack /kits error:', err);
    }
  });

  // ─── /inventory-help ───────────────────────────────────────────

  router.post('/slack/commands/inventory-help', async (req: Request, res: Response) => {
    if (!slashGuard(req, res)) return;

    res.json({
      response_type: 'in_channel',
      text: [
        '*Inventory Bot Commands:*',
        '',
        '• `/inventory <name or number>` — Look up a kit, computer, or pack',
        '• `/haswhat <person>` — See what someone has checked out',
        '• `/whereis <item>` — Find where a kit or computer is',
        '• `/checkout <kit>` — Check out a kit',
        '• `/checkin <kit>` — Return a kit',
        '• `/transfer <item> to <destination>` — Transfer equipment',
        '• `/report <item> <issue>` — Report a problem with equipment',
        '• `/sites` — List all sites with kit counts',
        '• `/kits [site]` — List kits, optionally filtered by site',
        '',
        'You can also DM me directly for conversational inventory management!',
      ].join('\n'),
    });
  });

  return router;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Open a DM channel with a Slack user and return the channel ID. */
async function openDm(slackUserId: string): Promise<string | null> {
  const res = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: slackUserId }),
  });
  const data = await res.json() as any;
  return data.channel?.id || null;
}

/** Format a kit record for display. */
function formatKit(kit: any): string {
  const lines = [
    `*Kit #${kit.number}: ${kit.name}*`,
    `Status: ${kit.status}`,
    `Site: ${kit.site?.name || 'unassigned'}`,
    `Custodian: ${kit.custodian?.displayName || 'none'}`,
    `Category: ${kit.category?.name || 'none'}`,
  ];
  if (kit.lastInventoried) {
    lines.push(`Last inventoried: ${new Date(kit.lastInventoried).toLocaleDateString()}`);
  }
  lines.push(`https://${APP_DOMAIN}/kits/${kit.id}`);
  return lines.join('\n');
}

/** Format location info for /whereis responses. */
function formatLocation(type: string, label: string, site: any, custodian: any, lastInventoried: Date | null): string {
  const lines = [
    `*${type}: ${label}*`,
    `Site: ${site?.name || 'unassigned'}`,
    `Custodian: ${custodian?.displayName || 'none'}`,
  ];
  if (lastInventoried) {
    lines.push(`Last inventoried: ${new Date(lastInventoried).toLocaleDateString()}`);
  }
  return lines.join('\n');
}
