import { describe, it, expect } from 'vitest';
import { isInAppRoute } from './downloadLinks';

// Ticket 010-006: AiChat.tsx's markdown link renderer must never send a
// `/api/downloads/<token>` link through the SPA's `navigate()` — that path
// has no client-side route and would show a blank/404 page instead of
// downloading the file. In-app links like `/kits/42` must keep going
// through `navigate()` as before.
describe('isInAppRoute', () => {
  it('treats a download link as NOT an in-app route, even though it starts with "/"', () => {
    expect(isInAppRoute('/api/downloads/abc123def456')).toBe(false);
  });

  it('treats a download link with a long hex token as NOT an in-app route', () => {
    expect(isInAppRoute(`/api/downloads/${'a'.repeat(64)}`)).toBe(false);
  });

  it('still treats ordinary in-app routes as in-app routes', () => {
    expect(isInAppRoute('/kits/42')).toBe(true);
    expect(isInAppRoute('/computers/5')).toBe(true);
    expect(isInAppRoute('/sites')).toBe(true);
  });

  it('treats a fully absolute link as not an in-app route (falls through to target="_blank")', () => {
    expect(isInAppRoute('https://inventory.jointheleague.org/api/downloads/abc123')).toBe(false);
  });

  it('only matches the download path as a prefix, not merely as a substring', () => {
    expect(isInAppRoute('/kits/api/downloads/42')).toBe(true);
  });
});
