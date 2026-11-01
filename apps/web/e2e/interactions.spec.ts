import { expect, test } from '@playwright/test';

test.describe('login form', () => {
  test('validates required fields with specific messages and focuses the first problem', async ({
    page,
  }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(submit).toBeEnabled(); // enabled once the page has hydrated
    await submit.click();
    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeFocused();
    await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows a message for a malformed email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('x');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Enter a valid email address/)).toBeVisible();
  });

  test('password visibility toggle works with mouse and keyboard', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('a-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).focus();
    await page.keyboard.press('Enter');
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('valid input does not authenticate, send anything, or leave the password behind', async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.goto('/login');
    page.on('request', (request) => {
      if (request.method() !== 'GET' || request.url().includes('login'))
        requests.push(request.url());
    });
    await page.getByLabel('Email address').fill('name@company.com');
    await page.getByLabel('Password', { exact: true }).fill('a-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('Sign-in is not enabled yet');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    expect(page.url()).not.toContain('password');
    expect(page.url()).not.toContain('a-password');
    expect(requests).toEqual([]);
    await expect(page).toHaveURL(/\/login$/);
    // Nothing was stored in the browser.
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain('a-password');
    expect(await page.context().cookies()).toEqual([]);
  });

  test('the form can be completed with the keyboard alone', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').focus();
    await page.keyboard.type('name@company.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('a-password');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Sign-in is not enabled yet');
  });
});

test.describe('components in a real browser', () => {
  test('help menu: keyboard navigation, Escape and focus return', async ({ page }) => {
    await page.goto('/dashboard');
    const trigger = page.getByRole('button', { name: 'Help', exact: true });
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'Help & Documentation' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Diagnostics' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('help menu links reach their pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  });

  test('custody tabs: click and arrow keys switch panels', async ({ page }) => {
    await page.goto('/dashboard/custody');
    const tablist = page.getByRole('tablist', { name: 'Custody views' });
    await expect(tablist.getByRole('tab', { selected: true })).toHaveText('Current custody');
    await tablist.getByRole('tab', { name: 'Handover records' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Handover records' })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Current custody' })).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(tablist.getByRole('tab', { name: 'Assignment history' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Assignment history' })).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tabpanel', { name: 'Current custody' })).toBeVisible();
  });

  test('diagnostics dialog opens, copies, closes with Escape and returns focus', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission names differ by engine');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/dashboard/help');
    const opener = page.getByRole('button', { name: 'View diagnostic details' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Diagnostic details' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('SmartPack diagnostics');
    await expect(dialog).not.toContainText('http://');

    await dialog.getByRole('button', { name: 'Copy to clipboard' }).click();
    // Success closes the dialog so the confirmation is visible on the page.
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Diagnostics copied' })).toBeVisible();
    await expect(opener).toBeFocused();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('SmartPack diagnostics');
    expect(copied).toContain('Database: connected');
  });

  test('diagnostics dialog: Escape closes it and returns focus to the opener', async ({ page }) => {
    await page.goto('/dashboard/help');
    const opener = page.getByRole('button', { name: 'View diagnostic details' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Diagnostic details' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('a failed copy is reported inside the dialog', async ({ page, context }) => {
    await context.grantPermissions([]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
      });
    });
    await page.goto('/dashboard/help');
    await page.getByRole('button', { name: 'View diagnostic details' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diagnostic details' });
    await dialog.getByRole('button', { name: 'Copy to clipboard' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Could not copy automatically');
    await expect(dialog).toBeVisible();
  });

  test('dialog closes from its close button and its backdrop', async ({ page }) => {
    await page.goto('/dashboard/help');
    await page.getByRole('button', { name: 'View diagnostic details' }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'View diagnostic details' }).click();
    await page.mouse.click(4, 4); // outside the panel
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('toast can be dismissed', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/dashboard/help');
    await page.getByRole('button', { name: 'View diagnostic details' }).click();
    await page.getByRole('button', { name: 'Copy to clipboard' }).click();
    await page.getByRole('button', { name: 'Dismiss: Diagnostics copied' }).click();
    await expect(page.getByText('Diagnostics copied')).toBeHidden();
  });

  test('disabled controls on planned pages really are disabled and explain why', async ({
    page,
  }) => {
    await page.goto('/dashboard/smartpacks');
    await expect(page.getByRole('button', { name: 'Register SmartPack' })).toBeDisabled();
    await expect(page.getByLabel('Search')).toBeDisabled();
    await expect(page.getByLabel('Status')).toBeDisabled();
    await expect(page.getByText(/Search and filters turn on when records exist/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(page.getByText('No records to page through')).toBeVisible();
  });

  test('reports: export is disabled and nothing can be downloaded', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('button', { name: 'Export report' })).toBeDisabled();
    await expect(page.getByLabel('From')).toBeDisabled();
  });

  test('settings: section links jump within the page and the profile is read-only', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings');
    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: 'Data management' })
      .click();
    await expect(page).toHaveURL(/#data-management$/);
    await expect(page.getByRole('heading', { name: 'Data management' })).toBeInViewport();
    await expect(page.getByText('Company name', { exact: true })).toBeVisible();
    await expect(page.getByText('Not configured').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  });
});

test.describe('accessibility behaviour', () => {
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

  test('keyboard focus is visibly indicated on interactive controls', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').focus();
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).toBe('solid');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test('reduced motion is respected', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    const duration = await page.evaluate(() => getComputedStyle(document.body).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
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

  test('the API address never reaches the browser', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (response) => {
      const type = response.headers()['content-type'] ?? '';
      if (/javascript|html|json/.test(type)) bodies.push(await response.text().catch(() => ''));
    });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    for (const body of bodies) {
      expect(body).not.toContain('127.0.0.1:4100');
      expect(body).not.toContain('API_URL');
    }
  });

  test('the viewport allows pinch zoom and covers the safe area', async ({ page }) => {
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
    expect(content).not.toContain('user-scalable=no');
    expect(content).not.toContain('maximum-scale');
  });
});
