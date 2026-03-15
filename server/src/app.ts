import express from 'express';
import session from 'express-session';
import pgSimple from 'connect-pg-simple';
import passport from 'passport';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { Writable } from 'stream';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { sitesRouter } from './routes/sites';
import { quartermasterRouter } from './routes/quartermasters';
import { kitsRouter } from './routes/kits';
import { packsRouter } from './routes/packs';
import { itemsRouter } from './routes/items';
import { qrRouter } from './routes/qr';
import { computersRouter } from './routes/computers';
import { hostnamesRouter } from './routes/hostnames';
import { operatingSystemsRouter } from './routes/operating-systems';
import { transfersRouter } from './routes/transfers';
import { inventoryChecksRouter } from './routes/inventory-checks';
import { issuesRouter } from './routes/issues';
import { labelsRouter } from './routes/labels';
import { importExportRouter } from './routes/import-export';
import { searchRouter } from './routes/search';
import { reportsRouter } from './routes/reports';
import { tokensRouter } from './routes/tokens';
import { aiChatRouter } from './routes/ai-chat';
import { imageRouter } from './routes/images';
import { categoriesRouter } from './routes/categories';
import { notesRouter } from './routes/notes';
import { errorHandler } from './middleware/errorHandler';
import { logBuffer } from './services/logBuffer';
import { prisma } from './services/prisma';
import { ServiceRegistry } from './services/service.registry';
import { tokenAuth } from './middleware/tokenAuth';
import { slackRouter } from './routes/slack';
import { oauthRouter } from './routes/oauth';
import { schedulerRouter } from './routes/scheduler';
import { SchedulerService } from './services/scheduler.service';
import { BackupService } from './services/backup.service';
import { BackupRotationService } from './services/backupRotation.service';
import { schedulerTickMiddleware } from './middleware/schedulerTick';
import { createMcpHandler } from './mcp/server';

const app = express();

// Trust first proxy (Caddy in production, Vite in dev)
app.set('trust proxy', 1);

// Parse JSON bodies; save raw body for Slack signature verification.
app.use(express.json({
  verify: (req: any, _res, buf) => {
    if (req.url?.startsWith('/slack')) {
      req.rawBody = buf;
    }
  },
}));

// Parse URL-encoded bodies (Slack slash commands)
app.use(express.urlencoded({ extended: false }));

// Pino logger: writes to stdout and in-memory ring buffer for the admin log viewer.
const logLevel = process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info');
const bufferStream = new Writable({
  write(chunk, _encoding, callback) {
    logBuffer.ingest(chunk.toString());
    callback();
  },
});
const logger = pino(
  { level: logLevel },
  pino.multistream([
    { stream: process.stdout },
    { stream: bufferStream },
  ]),
);

app.use(pinoHttp({ logger }));

// Scheduler tick piggyback — fires scheduler on incoming requests at a configurable interval.
if (process.env.DISABLE_SCHEDULER_TICK !== 'true') {
  app.use(schedulerTickMiddleware);
}

// Session middleware — PostgreSQL store for persistence across restarts.
// Falls back to MemoryStore in test environment.
const sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
  },
};

if (process.env.NODE_ENV !== 'test' && process.env.DATABASE_URL) {
  const PgStore = pgSimple(session);
  sessionConfig.store = new PgStore({
    conString: process.env.DATABASE_URL,
    // Table created by Prisma migration, not auto-created here.
  });
}

app.use(session(sessionConfig));

// Passport authentication — serialize User database ID to session,
// deserialize by loading from database.
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (serialized: any, done) => {
  try {
    // Handle legacy sessions that stored the full user object
    const userId = typeof serialized === 'number' ? serialized : serialized?.id;
    if (typeof userId !== 'number') {
      return done(null, false);
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});
app.use(passport.initialize());
app.use(passport.session());

// Create the service registry (composition root)
const services = ServiceRegistry.create();

// Scheduler service — instantiated here so routes and middleware can share it
const schedulerService = new SchedulerService(prisma);

// Backup rotation — wired into scheduled jobs
const backupService = new BackupService();
const backupRotation = new BackupRotationService(backupService);
schedulerService.registerHandler('daily-backup', () => backupRotation.runDaily());
schedulerService.registerHandler('weekly-backup', () => backupRotation.runWeekly());

// Routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', sitesRouter(services));
app.use('/api', quartermasterRouter);
app.use('/api', kitsRouter(services));
app.use('/api', packsRouter(services));
app.use('/api', itemsRouter(services));
app.use('/api', qrRouter(services));
app.use('/api', computersRouter(services));
app.use('/api', hostnamesRouter(services));
app.use('/api', operatingSystemsRouter(services));
app.use('/api', transfersRouter(services));
app.use('/api', inventoryChecksRouter(services));
app.use('/api', issuesRouter(services));
app.use('/api', labelsRouter(services));
app.use('/api', importExportRouter(services));
app.use('/api', searchRouter(services));
app.use('/api', reportsRouter(services));
app.use('/api', tokensRouter(services));
app.use('/api', aiChatRouter(services));
app.use('/api', imageRouter(services));
app.use('/api', categoriesRouter(services));
app.use('/api', notesRouter(services));
app.use('/api', schedulerRouter(schedulerService));
app.use('/api', adminRouter);

// Slack bot — mounted at root (not /api) to match Slack event subscription URLs
app.use(slackRouter(services));

// OAuth 2.0 endpoints for MCP connector authentication
app.use(oauthRouter(services.tokens, prisma));

// MCP server — token-authenticated endpoint for external AI clients
const mcpTokenAuth = tokenAuth(services.tokens, prisma);
app.all('/api/mcp', mcpTokenAuth, createMcpHandler(prisma));

// Test/dev auth bypass: allows automated tests and local development to
// create sessions without going through Google OAuth. Never loaded in production.
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { testAuthRouter } = require('./routes/testAuth');
  app.use('/api', testAuthRouter);
}

app.use(errorHandler);

// In production, serve the built React app from /app/public.
// All non-API routes fall through to index.html for SPA routing.
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

export { schedulerService };
export default app;
