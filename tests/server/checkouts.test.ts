process.env.NODE_ENV = 'test';

import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

describe('Checkouts API', () => {
  const agent = createAuthAgent('INSTRUCTOR');
  const qmAgent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();

  let siteId: number;
  let site2Id: number;
  let kitId: number;

  beforeAll(async () => {
    // Create two sites for checkout/checkin (unique names to avoid conflicts)
    const suffix = Date.now();
    const s1 = await qmAgent
      .post('/api/sites')
      .send({ name: `CO-Test-Site-A-${suffix}`, address: '123 Main St' });
    siteId = s1.body.id;

    const s2 = await qmAgent
      .post('/api/sites')
      .send({ name: `CO-Test-Site-B-${suffix}`, address: '456 Oak Ave' });
    site2Id = s2.body.id;

    // Create a kit
    const k = await qmAgent
      .post('/api/kits')
      .send({ name: `CO-Test-Kit-${suffix}`, siteId });
    kitId = k.body.id;
  });

  describe('POST /api/checkouts', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed
        .post('/api/checkouts')
        .send({ kitId: 1, destinationSiteId: 1 });
      expect(res.status).toBe(401);
    });

    it('creates a checkout and returns 201', async () => {
      const res = await agent
        .post('/api/checkouts')
        .send({ kitId, destinationSiteId: site2Id });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.kitId).toBe(kitId);
      expect(res.body.destinationSiteId).toBe(site2Id);
      expect(res.body.checkedOutAt).toBeDefined();
      expect(res.body.checkedInAt).toBeNull();
    });

    it('prevents double checkout (400)', async () => {
      const res = await agent
        .post('/api/checkouts')
        .send({ kitId, destinationSiteId: siteId });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already/i);
    });

    it('returns 404 for nonexistent kit', async () => {
      const res = await agent
        .post('/api/checkouts')
        .send({ kitId: 999999, destinationSiteId: siteId });
      expect(res.status).toBe(404);
    });

    it('returns 400 for missing kitId', async () => {
      const res = await agent
        .post('/api/checkouts')
        .send({ destinationSiteId: siteId });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/checkouts', () => {
    it('returns open checkouts by default', async () => {
      const res = await agent.get('/api/checkouts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((c: any) => c.kitId === kitId);
      expect(found).toBeDefined();
      expect(found.checkedInAt).toBeNull();
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed.get('/api/checkouts');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/checkouts/history/:kitId', () => {
    it('returns checkout history for a kit', async () => {
      const res = await agent.get(`/api/checkouts/history/${kitId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for nonexistent kit', async () => {
      const res = await agent.get('/api/checkouts/history/999999');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/checkouts/:id/checkin', () => {
    let checkoutId: number;

    beforeAll(async () => {
      // Get the open checkout for our kit
      const res = await agent.get('/api/checkouts');
      const found = res.body.find((c: any) => c.kitId === kitId);
      checkoutId = found.id;
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed
        .patch(`/api/checkouts/${checkoutId}/checkin`)
        .send({ returnSiteId: siteId });
      expect(res.status).toBe(401);
    });

    it('checks in a kit and returns 200', async () => {
      const res = await agent
        .patch(`/api/checkouts/${checkoutId}/checkin`)
        .send({ returnSiteId: siteId });
      expect(res.status).toBe(200);
      expect(res.body.checkedInAt).toBeDefined();
      expect(res.body.returnSiteId).toBe(siteId);
    });

    it('prevents double check-in (400)', async () => {
      const res = await agent
        .patch(`/api/checkouts/${checkoutId}/checkin`)
        .send({ returnSiteId: siteId });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already/i);
    });

    it('returns 404 for nonexistent checkout', async () => {
      const res = await agent
        .patch('/api/checkouts/999999/checkin')
        .send({ returnSiteId: siteId });
      expect(res.status).toBe(404);
    });

    it('returns 400 for missing returnSiteId', async () => {
      // Create a new checkout to test with
      const co = await agent
        .post('/api/checkouts')
        .send({ kitId, destinationSiteId: site2Id });
      expect(co.status).toBe(201);

      const res = await agent
        .patch(`/api/checkouts/${co.body.id}/checkin`)
        .send({});
      expect(res.status).toBe(400);

      // Clean up - check it back in
      await agent
        .patch(`/api/checkouts/${co.body.id}/checkin`)
        .send({ returnSiteId: siteId });
    });
  });

  describe('POST /api/sites/nearest', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await unauthed
        .post('/api/sites/nearest')
        .send({ latitude: 37.7749, longitude: -122.4194 });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing latitude', async () => {
      const res = await agent
        .post('/api/sites/nearest')
        .send({ longitude: -122.4194 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid longitude', async () => {
      const res = await agent
        .post('/api/sites/nearest')
        .send({ latitude: 37.7749, longitude: 'abc' });
      expect(res.status).toBe(400);
    });
  });

  describe('checkout then re-checkout flow', () => {
    it('allows checkout after check-in', async () => {
      // Kit should be available (checked in above)
      const co = await agent
        .post('/api/checkouts')
        .send({ kitId, destinationSiteId: siteId });
      expect(co.status).toBe(201);

      // Check in
      const ci = await agent
        .patch(`/api/checkouts/${co.body.id}/checkin`)
        .send({ returnSiteId: site2Id });
      expect(ci.status).toBe(200);

      // History should show multiple entries
      const hist = await agent.get(`/api/checkouts/history/${kitId}`);
      expect(hist.status).toBe(200);
      expect(hist.body.length).toBeGreaterThanOrEqual(2);
    });
  });
});
