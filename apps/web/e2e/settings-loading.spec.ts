import { expect, test } from '@playwright/test';
import { OWNER_STATE } from './accounts';

test.describe('Settings loading and legacy links', () => {
  test.use({ storageState: OWNER_STATE });

  test('a slow Settings page shows a loading state, never a blank area', async ({ page }) => {
    // The browser prefetches the other Settings pages after this one opens, in several requests
    // (the route tree, then the page and its loading boundary). Wait until all of that traffic for
    // the Audit page has finished and stayed quiet, so that the request held back below is the one
    // made by the click itself and the loading boundary is already known to the router.
    let seen = 0;
    let inFlight = 0;
    let lastActivity = Date.now();
    const isAudit = (url: string) => /\/dashboard\/settings\/audit/.test(url);
    page.on('request', (request) => {
      if (!isAudit(request.url())) return;
      seen += 1;
      inFlight += 1;
      lastActivity = Date.now();
    });
    const settled = (request: { url(): string }) => {
      if (!isAudit(request.url())) return;
      inFlight -= 1;
      lastActivity = Date.now();
    };
    page.on('requestfinished', settled);
    page.on('requestfailed', settled);

    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect
      .poll(() => seen > 0 && inFlight === 0 && Date.now() - lastActivity > 1000, {
        message: 'the prefetch of the Audit page should finish',
        timeout: 30_000,
      })
      .toBe(true);

    // Hold back the data for the next page (the browser's own request for it) to see what shows.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/dashboard\/settings\/audit/, async (route) => {
      const request = route.request();
      // Only the request made by the click is held; the browser's background prefetches and the
      // page document go through untouched.
      if (request.resourceType() === 'document' || request.headers()['next-router-prefetch']) {
        return route.continue();
      }
      await held;
      return route.continue();
    });

    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: 'Audit log' })
      .click();

    const loading = page.getByRole('status').filter({ hasText: 'Loading settings' });
    await expect(loading).toBeVisible();
    // The Settings heading and section navigation stay in place while waiting.
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible();

    release();
    await expect(page.getByRole('region', { name: 'Audit events, newest first' })).toBeVisible();
    await expect(loading).toHaveCount(0);
  });

  test('Phase 2 Settings anchors still reach their sections', async ({ page }) => {
    await page.goto('/dashboard/settings#security-settings');
    await expect(page).toHaveURL(/\/dashboard\/settings\/security$/);
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();

    await page.goto('/dashboard/settings#user-management');
    await expect(page).toHaveURL(/\/dashboard\/settings\/members$/);

    await page.goto('/dashboard/settings#roles-and-permissions');
    await expect(page).toHaveURL(/\/dashboard\/settings\/roles$/);

    // Anchors that still exist stay on the page and scroll as before, even though the page now
    // streams in behind a loading state (the browser's own jump can happen before the target exists).
    await page.goto('/dashboard/settings#company-profile');
    await expect(page).toHaveURL(/\/dashboard\/settings#company-profile$/);
    await expect(page.getByRole('heading', { name: 'Company profile' })).toBeInViewport();

    await page.goto('/dashboard/settings#data-management');
    await expect(page).toHaveURL(/\/dashboard\/settings#data-management$/);
    await expect(page.getByRole('heading', { name: 'Data management' })).toBeInViewport();
  });

  test('the Application preferences anchor stays on Settings (section not built)', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings#application-preferences');
    await expect(page).toHaveURL(/\/dashboard\/settings#application-preferences$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});
