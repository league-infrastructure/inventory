import { Router, Request, Response } from 'express';
import passport from 'passport';
import { prisma } from '../services/prisma';

export const authRouter = Router();

// --- Google OAuth Strategy ---
// Restricted to jointheleague.org domain.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      proxy: true,
      scope: ['profile', 'email'],
      hd: 'jointheleague.org',
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value || '';

        // Defense in depth: validate domain even though hd param restricts it
        if (!email.endsWith('@jointheleague.org')) {
          return done(null, false, { message: 'Only jointheleague.org accounts are allowed' });
        }

        // Find existing user by googleId or email, then create/update
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
        if (!user) {
          user = await prisma.user.findUnique({ where: { email } });
        }

        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              displayName: profile.displayName || '',
              avatar: profile.photos?.[0]?.value || null,
              email,
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email,
              displayName: profile.displayName || '',
              avatar: profile.photos?.[0]?.value || null,
            },
          });
        }

        // Check Quartermaster patterns to determine role (skip if ADMIN)
        if (user.role !== 'ADMIN') {
          const patterns = await prisma.quartermasterPattern.findMany();
          let role: 'INSTRUCTOR' | 'QUARTERMASTER' = 'INSTRUCTOR';
          for (const p of patterns) {
            if (p.isRegex) {
              try {
                if (new RegExp(p.pattern, 'i').test(email)) {
                  role = 'QUARTERMASTER';
                  break;
                }
              } catch {
                // Invalid regex — skip
              }
            } else {
              if (email.toLowerCase() === p.pattern.toLowerCase()) {
                role = 'QUARTERMASTER';
                break;
              }
            }
          }

          if (user.role !== role) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role },
            });
            user.role = role;
          }
        }

        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  ));
  if (process.env.NODE_ENV !== 'test') console.log('Google OAuth strategy registered (jointheleague.org)');
} else {
  if (process.env.NODE_ENV !== 'test') console.log('Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}

// Google OAuth initiation
authRouter.get('/auth/google', (req: Request, res: Response, next) => {
  if (!(passport as any)._strategy('google')) {
    return res.status(501).json({
      error: 'Google OAuth not configured',
      docs: 'https://console.cloud.google.com/apis/credentials',
    });
  }
  // Store returnTo for post-login redirect (validate relative path to prevent open redirect)
  const returnTo = req.query.returnTo as string | undefined;
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    req.session.returnTo = returnTo;
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    hd: 'jointheleague.org',
  } as any)(req, res, next);
});

// Google OAuth callback
authRouter.get('/auth/google/callback',
  (req: Request, res: Response, next) => {
    if (!(passport as any)._strategy('google')) {
      return res.status(501).json({ error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' })(req, res, next);
  },
  (req: Request, res: Response) => {
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  },
);

// --- Shared auth endpoints ---

// Get current user
authRouter.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = req.user as any;
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
  });
});

// List all users (for transfer modal custodian selection)
authRouter.get('/auth/users', async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  });
  res.json(users);
});

// Logout
authRouter.post('/auth/logout', (req: Request, res: Response, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
  });
});
