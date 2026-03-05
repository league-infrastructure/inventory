/**
 * Test-only authentication bypass routes.
 *
 * These routes allow automated tests (Supertest, Playwright) to create
 * authenticated sessions without going through Google OAuth.
 *
 * SAFETY: This module throws at load time if NODE_ENV is 'production'.
 * It is only require()'d conditionally in app.ts.
 */

import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../services/prisma';

if (process.env.NODE_ENV === 'production') {
  throw new Error('testAuth routes must NEVER be loaded in production');
}

export const testAuthRouter = Router();

/**
 * POST /api/test/login
 * For Supertest: creates an authenticated session with the given role.
 * Body: { role?: 'INSTRUCTOR' | 'QUARTERMASTER', email?: string }
 *
 * Upserts a real User record so Passport's deserializeUser can find it.
 */
testAuthRouter.post('/test/login', async (req: Request, res: Response) => {
  const role: UserRole = req.body.role === 'QUARTERMASTER' ? 'QUARTERMASTER' : 'INSTRUCTOR';
  const email = req.body.email || `test-${role.toLowerCase()}@jointheleague.org`;
  const googleId = `test-google-${role.toLowerCase()}`;

  // Try to find by googleId first, then by email, to avoid unique constraint conflicts
  let user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role, googleId, email },
    });
  } else {
    user = await prisma.user.create({
      data: {
        googleId,
        email,
        displayName: `Test ${role.charAt(0) + role.slice(1).toLowerCase()}`,
        role,
      },
    });
  }

  req.login(user, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, user });
  });
});

/**
 * GET /api/auth/test-login?role=ROLE
 * For Playwright: creates an authenticated session and redirects to /.
 * The browser receives a session cookie for subsequent navigation.
 */
testAuthRouter.get('/auth/test-login', async (req: Request, res: Response) => {
  const role: UserRole = req.query.role === 'QUARTERMASTER' ? 'QUARTERMASTER' : 'INSTRUCTOR';
  const googleId = `test-google-${role.toLowerCase()}`;

  const email = `test-${role.toLowerCase()}@jointheleague.org`;
  let user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role, googleId, email },
    });
  } else {
    user = await prisma.user.create({
      data: {
        googleId,
        email,
        displayName: `Test ${role.charAt(0) + role.slice(1).toLowerCase()}`,
        role,
      },
    });
  }

  req.login(user, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.redirect('/');
  });
});

/**
 * POST /api/test/admin-login
 * For Supertest: sets the admin session flag without a password.
 */
testAuthRouter.post('/test/admin-login', (req: Request, res: Response) => {
  req.session.isAdmin = true;
  res.json({ success: true });
});

/**
 * POST /api/test/logout
 * Clears both OAuth and admin sessions.
 */
testAuthRouter.post('/test/logout', (req: Request, res: Response) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});
