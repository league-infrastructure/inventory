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
import { checkoutsRouter } from './routes/checkouts';
import { tokensRouter } from './routes/tokens';
import { aiChatRouter } from './routes/ai-chat';
import { errorHandler } from './middleware/errorHandler';
import { logBuffer } from './services/logBuffer';
import { prisma } from './services/prisma';
import { ServiceRegistry } from './services/service.registry';
import { tokenAuth } from './middleware/tokenAuth';
import { createMcpHandler } from './mcp/server';

const app = express();

// Trust first proxy (Caddy in production, Vite in dev)
app.set('trust proxy', 1);

app.use(express.json());

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
app.use('/api', checkoutsRouter(services));
app.use('/api', tokensRouter(services));
app.use('/api', aiChatRouter(services));
app.use('/api', adminRouter);

// MCP server — token-authenticated endpoint for external AI clients
const mcpTokenAuth = tokenAuth(services.tokens, prisma);
app.all('/api/mcp', mcpTokenAuth, createMcpHandler(prisma));

// Test-only auth bypass: allows automated tests to create sessions
// without going through Google OAuth. Never loaded in production.
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e') {
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

export default app;
