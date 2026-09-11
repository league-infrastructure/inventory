process.env.NODE_ENV = 'test';

// Set DATABASE_URL for tests that hit Prisma-backed routes.
// Falls back to the standard dev database if not already set.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5434/app';
}

import request from 'supertest';
import app from '../../server/src/app';

describe('OAuth discovery compliance', () => {
  describe('WWW-Authenticate header on /api/mcp 401s', () => {
    it('sets WWW-Authenticate when no Authorization header is present', async () => {
      const res = await request(app).post('/api/mcp').send({});
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toMatch(
        /^Bearer realm="mcp", resource_metadata=".+\/\.well-known\/oauth-protected-resource"$/,
      );
    });

    it('sets WWW-Authenticate when the Authorization header is malformed', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', 'NotBearer sometoken')
        .send({});
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toContain('resource_metadata=');
      expect(res.headers['www-authenticate']).toContain('.well-known/oauth-protected-resource');
    });

    it('sets WWW-Authenticate when the bearer token is invalid or expired', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({});
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toContain('resource_metadata=');
      expect(res.headers['www-authenticate']).toContain('.well-known/oauth-protected-resource');
    });
  });

  describe('protected-resource metadata (RFC 9728)', () => {
    it('serves the root document as JSON', async () => {
      const res = await request(app).get('/.well-known/oauth-protected-resource');
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
      expect(res.body.resource).toMatch(/\/api\/mcp$/);
      expect(Array.isArray(res.body.authorization_servers)).toBe(true);
      expect(res.body.authorization_servers.length).toBeGreaterThan(0);
      expect(res.body.scopes_supported).toEqual([]);
      expect(res.body.bearer_methods_supported).toEqual(['header']);
    });

    it('serves the path-aware document as JSON', async () => {
      const res = await request(app).get('/.well-known/oauth-protected-resource/api/mcp');
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
      expect(res.body.resource).toMatch(/\/api\/mcp$/);
      expect(res.body.scopes_supported).toEqual([]);
      expect(res.body.bearer_methods_supported).toEqual(['header']);
    });
  });

  describe('authorization-server metadata (RFC 8414)', () => {
    it('serves the root document with DCR/none additions', async () => {
      const res = await request(app).get('/.well-known/oauth-authorization-server');
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
      expect(res.body.token_endpoint_auth_methods_supported).toContain('none');
      expect(res.body.registration_endpoint).toMatch(/\/oauth\/register$/);
      expect(res.body.client_id_metadata_document_supported).toBe(true);
      expect(res.body.scopes_supported).toEqual([]);
    });

    it('serves the path-aware document with the same shape as the root document', async () => {
      const res = await request(app).get('/.well-known/oauth-authorization-server/api/mcp');
      expect(res.status).toBe(200);
      expect(res.type).toBe('application/json');
      expect(res.body.token_endpoint_auth_methods_supported).toContain('none');
      expect(res.body.registration_endpoint).toMatch(/\/oauth\/register$/);
      expect(res.body.client_id_metadata_document_supported).toBe(true);
      expect(res.body.scopes_supported).toEqual([]);
      expect(res.body.authorization_endpoint).toMatch(/\/oauth\/authorize$/);
      expect(res.body.token_endpoint).toMatch(/\/oauth\/token$/);
    });
  });

  describe('/.well-known/* 404 guard', () => {
    it('returns 404 JSON for an unhandled well-known path', async () => {
      const res = await request(app).get('/.well-known/some-unhandled-path');
      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body).toEqual({ error: 'not_found' });
    });

    it('never falls through to the SPA index.html', async () => {
      const res = await request(app).get('/.well-known/another-bogus-path');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('<!DOCTYPE html>');
    });
  });

  describe('POST /oauth/register', () => {
    it('accepts any JSON body and returns a generated client_id', async () => {
      const res = await request(app)
        .post('/oauth/register')
        .send({
          redirect_uris: ['http://localhost:12345/callback'],
          client_name: 'Test MCP Client',
          grant_types: ['authorization_code'],
        });
      expect(res.status).toBe(201);
      expect(typeof res.body.client_id).toBe('string');
      expect(res.body.client_id.length).toBeGreaterThan(0);
      expect(res.body.token_endpoint_auth_method).toBe('none');
      expect(res.body.redirect_uris).toEqual(['http://localhost:12345/callback']);
      expect(res.body.client_name).toBe('Test MCP Client');
      expect(res.body.grant_types).toEqual(['authorization_code']);
      expect(res.body.client_id_issued_at).toEqual(expect.any(Number));
    });

    it('defaults grant_types to authorization_code when omitted', async () => {
      const res = await request(app).post('/oauth/register').send({});
      expect(res.status).toBe(201);
      expect(res.body.grant_types).toEqual(['authorization_code']);
      expect(res.body.token_endpoint_auth_method).toBe('none');
    });

    it('generates distinct client_ids across calls', async () => {
      const [first, second] = await Promise.all([
        request(app).post('/oauth/register').send({}),
        request(app).post('/oauth/register').send({}),
      ]);
      expect(first.body.client_id).not.toBe(second.body.client_id);
    });
  });

  describe('/oauth/authorize redirect_uri allow-list', () => {
    it('accepts the claude.ai callback URL', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'https://claude.ai/api/mcp/auth_callback', response_type: 'code' });
      expect(res.status).not.toBe(400);
    });

    it('accepts the claude.com callback URL', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'https://claude.com/api/mcp/auth_callback', response_type: 'code' });
      expect(res.status).not.toBe(400);
    });

    it('accepts a localhost loopback redirect_uri on any port/path', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'http://localhost:54321/some/callback/path', response_type: 'code' });
      expect(res.status).not.toBe(400);
    });

    it('accepts a 127.0.0.1 loopback redirect_uri', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'http://127.0.0.1:9999/cb', response_type: 'code' });
      expect(res.status).not.toBe(400);
    });

    it('rejects an arbitrary external redirect_uri with 400 invalid_request', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'https://evil.example.com/callback', response_type: 'code' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });

    it('rejects an https loopback redirect_uri (wrong scheme)', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({ redirect_uri: 'https://localhost:3000/callback', response_type: 'code' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });
  });
});
