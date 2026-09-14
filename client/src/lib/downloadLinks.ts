/**
 * Server-side download links (`/api/downloads/<token>`, minted by the
 * `generate_labels` / `export_list` MCP tools — sprint 010) always come
 * back absolute from the tools (built from `getBaseUrl()` on the
 * server), so `AiChat.tsx`'s markdown link renderer's existing
 * `target="_blank"` branch already handles the expected case correctly.
 * This check exists defensively for the case where a relative download
 * path is ever emitted instead: it must never be captured by the SPA's
 * client-side `navigate()`, which has no route for `/api/downloads/...`
 * and would show a blank/404 page instead of triggering the file
 * download the user asked for.
 */
const DOWNLOAD_PATH_PATTERN = /^\/api\/downloads\//;

/**
 * True when `href` should be intercepted by the SPA's client-side
 * router (`navigate()`) instead of behaving as a normal browser link.
 * In-app routes like `/kits/42` qualify; a `/api/downloads/<token>`
 * link does not, even though both start with `/` — see module doc
 * above. Non-in-app-route links (this returns false for) fall through
 * to a plain `<a target="_blank">`, which is what triggers a real
 * browser download for a `Content-Disposition: attachment` response.
 */
export function isInAppRoute(href: string): boolean {
  return href.startsWith('/') && !DOWNLOAD_PATH_PATTERN.test(href);
}
