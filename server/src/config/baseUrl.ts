/**
 * Resolves this server's externally-visible base URL without an Express
 * `Request` — needed by anything that builds absolute links outside
 * request scope (MCP tools, background jobs).
 *
 * Fallback chain: `QR_DOMAIN` (set in prod, e.g.
 * `https://inventory.jointheleague.org` — originally introduced for QR
 * codes but already means "this server's public URL"), then
 * `APP_BASE_URL` (dev/staging), then `http://localhost:9311` (local
 * dev default port). No new env var is introduced — see sprint 010
 * Design Rationale for why a `PUBLIC_URL` var was considered and
 * rejected.
 *
 * Extracted from `LabelService`'s constructor, which used to inline
 * this chain privately. Callers that need a clean URL join (no double
 * slash) strip a trailing slash themselves — this function does not
 * normalize, matching `LabelService`'s pre-existing behavior exactly.
 */
export function getBaseUrl(): string {
  return process.env.QR_DOMAIN ?? process.env.APP_BASE_URL ?? 'http://localhost:9311';
}
