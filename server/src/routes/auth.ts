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

        // Upsert user in database
        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: {
            displayName: profile.displayName || '',
            avatar: profile.photos?.[0]?.value || null,
            email,
          },
          create: {
            googleId: profile.id,
            email,
            displayName: profile.displayName || '',
            avatar: profile.photos?.[0]?.value || null,
          },
        });

        // Check Quartermaster patterns to determine role
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

        // Update role if changed
        if (user.role !== role) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role },
          });
          user.role = role;
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
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    hd: 'jointheleague.org',
  })(req, res, next);
});

// Google OAuth callback
authRouter.get('/auth/google/callback',
  (req: Request, res: Response, next) => {
    if (!(passport as any)._strategy('google')) {
      return res.status(501).json({ error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' })(req, res, next);
  },
  (_req: Request, res: Response) => {
    res.redirect('/');
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
