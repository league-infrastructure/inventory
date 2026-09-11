import { Request } from 'express';

/**
 * Resolve this server's externally-visible base URL.
 *
 * Prefers `PUBLIC_URL` (set in production behind Caddy) and falls back to
 * reconstructing it from the request's protocol/host, matching what
 * `oauth.ts` has always done. Shared by `oauth.ts`, `wellKnown.ts`, and
 * `tokenAuth.ts` so the base-URL logic has one source of truth.
 */
export function getPublicUrl(req: Request): string {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}
