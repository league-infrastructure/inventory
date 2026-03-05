/**
 * Supertest helpers for creating authenticated test agents.
 *
 * Usage:
 *   const agent = createAuthAgent('QUARTERMASTER');
 *   // agent is now a Supertest agent with a session cookie.
 *   const res = await agent.get('/api/computers');
 */

import request from 'supertest';

// Ensure test environment before importing app
process.env.NODE_ENV = 'test';

// Set DATABASE_URL for tests that hit Prisma-backed routes.
// Falls back to the standard dev database if not already set.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5433/app';
}

import app from '../../../server/src/app';

/**
 * Creates a Supertest agent authenticated as the given role.
 * The agent preserves cookies across requests (session-based auth).
 *
 * Call this at describe() scope — it sets up beforeAll/afterAll hooks
 * to login/logout automatically.
 */
export function createAuthAgent(role: 'INSTRUCTOR' | 'QUARTERMASTER' = 'INSTRUCTOR') {
  const agent = request.agent(app);

  beforeAll(async () => {
    await agent
      .post('/api/test/login')
      .send({ role });
  });

  afterAll(async () => {
    await agent.post('/api/test/logout');
  });

  return agent;
}

/**
 * Creates a Supertest agent authenticated as an admin (password-based).
 */
export function createAdminAgent() {
  const agent = request.agent(app);

  beforeAll(async () => {
    await agent.post('/api/test/admin-login');
  });

  afterAll(async () => {
    await agent.post('/api/test/logout');
  });

  return agent;
}

/**
 * Creates an unauthenticated Supertest agent (for testing 401 responses).
 */
export function createUnauthenticatedAgent() {
  return request(app);
}
