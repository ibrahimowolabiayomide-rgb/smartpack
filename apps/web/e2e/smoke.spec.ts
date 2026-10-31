import { expect, test, type Page } from '@playwright/test';

/** Fails the test if the page logs a console error or throws, which smoke tests must never allow. */
function trackBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('public pages', () => {
  test('landing page states what exists and what does not', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartPack/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SmartPack');
    await expect(page.getByText('Not implemented')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open development preview' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('login page is an honest, inert placeholder', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Sign-in is not implemented in this build')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeDisabled();
    await expect(page.getByLabel('Password')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('unknown routes show the not-found page with a 404 status', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('dashboard with a live API and database', () => {
  test('shows real platform status from the API', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

    const status = page.getByRole('region', { name: 'Platform status' });
    await expect(status.getByText('All systems operational')).toBeVisible();
    await expect(status.getByText('Connected')).toBeVisible();
    await expect(status.getByText('Enabled')).toBeVisible();
    await expect(status.getByText('test', { exact: true })).toBeVisible(); // API environment

    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('contains no fabricated company data', async ({ page }) => {
    await page.goto('/dashboard');
    const body = (await page.locator('main').innerText()).toLowerCase();
    for (const forbidden of ['john', 'jane', 'serial', 'sp-0', 'lagos', 'ibadan']) {
      expect(body).not.toContain(forbidden);
    }
    await expect(page.getByText('Not implemented').first()).toBeVisible();
  });

  test('every planned module is labelled and not clickable', async ({ page, isMobile }) => {
    await page.goto('/dashboard');
    if (isMobile) await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' }).first();
    await expect(nav.getByRole('link')).toHaveCount(1);
    await expect(nav.getByText('SmartPacks')).toBeVisible();
    await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(9);
  });
});

test.describe('responsive navigation', () => {
  test('desktop shows the sidebar and hides the menu button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop-only layout');
    await page.goto('/dashboard');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden();
  });

  test('mobile hides the sidebar and opens a drawer from the menu button', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile-only layout');
    await page.goto('/dashboard');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();

    const opener = page.getByRole('button', { name: 'Open navigation menu' });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Main navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Overview' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('mobile drawer closes when the close button is pressed', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only layout');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.getByRole('button', { name: 'Close navigation menu' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test.describe('accessibility basics', () => {
  test('the skip link is the first tab stop and moves focus to the main region', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('each page has exactly one h1 and a main landmark', async ({ page }) => {
    for (const path of ['/', '/login', '/dashboard']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
    }
  });

  test('keyboard focus is visibly indicated', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // wordmark link
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).toBe('solid');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('platform basics', () => {
  test('serves a valid web app manifest', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name: string;
      display: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.name).toBe('SmartPack Asset Intelligence Platform');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()['content-type']).toContain('image/png');
    }
  });

  test('asks crawlers not to index the preview', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow:\s*\//);
  });

  test('sends security headers and hides the framework banner', async ({ request }) => {
    const headers = (await request.get('/')).headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
