/**
 * Playwright auth fixtures for role-based testing.
 *
 * Provides pre-authenticated Page objects for each role:
 *   - authenticatedPage: logged in as INSTRUCTOR
 *   - quartermasterPage: logged in as QUARTERMASTER
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *
 *   test('instructor sees list', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/computers');
 *     await expect(authenticatedPage.locator('h1')).toHaveText('Computers');
 *   });
 */

import { test as base, expect, Page } from '@playwright/test';

export const test = base.extend<{
  authenticatedPage: Page;
  quartermasterPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await page.request.get('/api/auth/test-login?role=INSTRUCTOR');
    await use(page);
  },

  quartermasterPage: async ({ page }, use) => {
    await page.request.get('/api/auth/test-login?role=QUARTERMASTER');
    await use(page);
  },
});

export { expect };
