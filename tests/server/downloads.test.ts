import request from 'supertest';

process.env.NODE_ENV = 'test';

import app from '../../server/src/app';
import { getPrisma, getRegistry, setupTestUser, teardown, getSuffix } from './services/setup';

describe('GET /api/downloads/:token', () => {
  const suffix = getSuffix();
  const prisma = getPrisma();
  const createdUserIds: number[] = [];

  async function createOwner(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `dl-${label}-${suffix}@example.com`,
        googleId: `dl-${label}-${suffix}`,
        displayName: `DL ${label}`,
        role: 'INSTRUCTOR',
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  /**
   * Logs an agent in via the non-production test-auth bypass
   * (`POST /api/test/login`, `server/src/routes/testAuth.ts`) and
   * resolves the actual session user's id — `test-login` upserts a
   * fixed row per role, so callers that need to control ownership
   * must ask what id it landed on rather than assume one.
   */
  async function loginAgent(role: string) {
    const agent = request.agent(app);
    await agent.post('/api/test/login').send({ role });
    const me = await agent.get('/api/auth/me');
    createdUserIds.push(me.body.id);
    return { agent, userId: me.body.id as number };
  }

  beforeAll(async () => {
    await setupTestUser();
  });

  afterAll(async () => {
    await prisma.generatedFile.deleteMany({ where: { ownerId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await teardown();
  });

  it('logged-out request redirects (302) to /api/auth/google?returnTo=/api/downloads/<token>, not a JSON 401', async () => {
    const owner = await createOwner('redir-owner');
    const { token } = await getRegistry().generatedFiles.store(owner.id, Buffer.from('pdf-bytes'), 'labels.pdf', 'application/pdf');

    const res = await request(app).get(`/api/downloads/${token}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/api/auth/google?returnTo=/api/downloads/${token}`);
  });

  it('full round trip: logged-out -> redirect -> test-auth login bypass -> redirected back -> 200 with bytes', async () => {
    const owner = await createOwner('roundtrip-owner');
    const { token } = await getRegistry().generatedFiles.store(
      owner.id,
      Buffer.from('round-trip-bytes'),
      'roundtrip.pdf',
      'application/pdf',
    );

    const agent = request.agent(app);

    // Step 1: logged-out request is redirected to the login endpoint,
    // carrying this exact download URL as returnTo.
    const first = await agent.get(`/api/downloads/${token}`);
    expect(first.status).toBe(302);
    const location = first.headers.location as string;
    expect(location).toMatch(/^\/api\/auth\/google\?returnTo=/);
    const returnTo = decodeURIComponent(location.split('returnTo=')[1]);
    expect(returnTo).toBe(`/api/downloads/${token}`);

    // Step 2: stand in for the real Google login with the non-production
    // test-auth bypass (`GET /api/auth/test-login`, testAuth.ts), which
    // implements the *same* returnTo-stash-and-redirect mechanism as
    // `/api/auth/google` (auth.ts) — this exercises that shared mechanism
    // end to end without needing real Google OAuth credentials.
    const login = await agent.get('/api/auth/test-login').query({ role: 'QUARTERMASTER', returnTo });
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe(returnTo);

    // Step 3: the browser lands back on the same download URL, now
    // authenticated, and gets the file (as QUARTERMASTER, regardless of
    // who owns it).
    const final = await agent.get(returnTo);
    expect(final.status).toBe(200);
    expect(final.headers['content-type']).toMatch(/application\/pdf/);
    expect(final.headers['content-disposition']).toBe('attachment; filename="roundtrip.pdf"');
    expect(Buffer.from(final.body).toString()).toBe('round-trip-bytes');
  });

  it('owner can download: 200 with bytes, Content-Type, and Content-Disposition', async () => {
    const { agent, userId } = await loginAgent('INSTRUCTOR');
    const { token } = await getRegistry().generatedFiles.store(userId, Buffer.from('owner-bytes'), 'owner-file.pdf', 'application/pdf');

    const res = await agent.get(`/api/downloads/${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="owner-file.pdf"');
    expect(Buffer.from(res.body).toString()).toBe('owner-bytes');
  });

  it('quartermaster can download a file they do not own: 200 with bytes', async () => {
    const owner = await createOwner('qm-target-owner');
    const { token } = await getRegistry().generatedFiles.store(owner.id, Buffer.from('qm-bytes'), 'qm-file.pdf', 'application/pdf');
    const { agent } = await loginAgent('QUARTERMASTER');

    const res = await agent.get(`/api/downloads/${token}`);

    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString()).toBe('qm-bytes');
  });

  it('a non-owner, non-QM user is forbidden: 403, no bytes', async () => {
    const owner = await createOwner('forbidden-owner');
    const { token } = await getRegistry().generatedFiles.store(owner.id, Buffer.from('secret-bytes'), 'secret.pdf', 'application/pdf');
    const { agent, userId } = await loginAgent('INSTRUCTOR');
    expect(userId).not.toBe(owner.id);

    const res = await agent.get(`/api/downloads/${token}`);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('data');
  });

  it('an unknown token is 404', async () => {
    const { agent } = await loginAgent('INSTRUCTOR');

    const res = await agent.get(`/api/downloads/${'0'.repeat(64)}`);

    expect(res.status).toBe(404);
  });

  it('an expired token is 404 (indistinguishable from unknown)', async () => {
    const owner = await createOwner('expired-owner');
    const { token } = await getRegistry().generatedFiles.store(
      owner.id,
      Buffer.from('expired-bytes'),
      'expired.pdf',
      'application/pdf',
      -1000,
    );
    const { agent } = await loginAgent('INSTRUCTOR');

    const res = await agent.get(`/api/downloads/${token}`);

    expect(res.status).toBe(404);
  });

  it('a loanee-role (STUDENT) user is denied the same way requireAuth-gated routes deny them', async () => {
    const owner = await createOwner('loanee-target-owner');
    const { token } = await getRegistry().generatedFiles.store(owner.id, Buffer.from('loanee-bytes'), 'loanee.pdf', 'application/pdf');
    const { agent } = await loginAgent('STUDENT');

    const res = await agent.get(`/api/downloads/${token}`);

    expect(res.status).toBe(403);
  });
});
