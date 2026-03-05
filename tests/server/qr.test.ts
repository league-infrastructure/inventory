process.env.NODE_ENV = 'test';

import { createAuthAgent, createUnauthenticatedAgent } from './helpers/auth';

describe('QR API - Computer', () => {
  const agent = createAuthAgent('QUARTERMASTER');
  const unauthed = createUnauthenticatedAgent();

  it('GET /api/qr/c/:id returns computer info (no auth required)', async () => {
    // Create a computer first
    const created = await agent
      .post('/api/computers')
      .send({ model: 'QR Test Computer' });
    expect(created.status).toBe(201);

    const res = await unauthed.get(`/api/qr/c/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('Computer');
    expect(res.body.name).toBe('QR Test Computer');
    expect(res.body.qrDataUrl).toBeDefined();
  });

  it('GET /api/qr/c/:id returns 404 for nonexistent computer', async () => {
    const res = await unauthed.get('/api/qr/c/999999');
    expect(res.status).toBe(404);
  });
});
