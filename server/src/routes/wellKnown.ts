import { Router, Request, Response } from 'express';
import { getPublicUrl } from './publicUrl';
import { buildAuthorizationServerMetadata } from './oauth';

/**
 * Builds the OAuth 2.0 Protected Resource Metadata document (RFC 9728) for
 * this server's MCP endpoint.
 */
function buildProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: [],
    bearer_methods_supported: ['header'],
  };
}

/**
 * Owns the `/.well-known/` namespace: RFC 9728 protected-resource metadata,
 * the path-aware RFC 8414 authorization-server metadata, and a 404 guard
 * for every other unhandled `/.well-known/*` path.
 *
 * This is a routing/publication concern, distinct from oauth.ts's
 * authorization-server protocol (authorize/token/register) — see
 * sprint.md's Design Rationale for why it's a separate module.
 *
 * Must be mounted in app.ts *before* the production SPA `app.get('*')`
 * catch-all, or every path here (including the 404 guard) would never be
 * reached — the catch-all would serve index.html instead.
 */
export function wellKnownRouter(): Router {
  const router = Router();

  router.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
    res.json(buildProtectedResourceMetadata(getPublicUrl(req)));
  });

  router.get('/.well-known/oauth-protected-resource/api/mcp', (req: Request, res: Response) => {
    res.json(buildProtectedResourceMetadata(getPublicUrl(req)));
  });

  router.get('/.well-known/oauth-authorization-server/api/mcp', (req: Request, res: Response) => {
    res.json(buildAuthorizationServerMetadata(getPublicUrl(req)));
  });

  // Any other /.well-known/* path is unhandled — return 404 JSON, never
  // fall through to the SPA catch-all in app.ts. Must stay after the
  // specific routes above so they get first crack at matching.
  router.use('/.well-known', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  return router;
}
