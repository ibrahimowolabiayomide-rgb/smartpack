import { expect, test } from '@playwright/test';
import { OWNER_STATE, UNVERIFIED_SESSION } from './accounts';
import { PORTS, baseUrlFor } from './ports';
import { expectNoHorizontalOverflow, trackBrowserErrors } from './helpers';

test.describe('overview with a live API and database', () => {
  test.use({ storageState: OWNER_STATE });

  test('shows real service status from the API, labelled as system status', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    await page.goto('/dashboard');
    const status = page.getByRole('region', { name: 'Service status' });
    await expect(status.getByText('All systems operational')).toBeVisible();
    await expect(status.getByText('Reachable')).toBeVisible();
    await expect(status.getByText('Connected')).toBeVisible();
    await expect(status.getByText('Enabled')).toBeVisible();
    await expect(status.getByText('test', { exact: true })).toBeVisible(); // API environment
    await expect(
      status.getByText('System status, not business activity', { exact: false }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('"Check again" repeats the live request and shows a busy state while it runs', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const checked = page.getByText(/^Checked /);
    const before = await checked.textContent();
    // Slow the next render slightly so the busy state is observable without changing behaviour.
    await page.route('**/dashboard?_rsc=*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.waitForTimeout(1100); // the API timestamp has one-second resolution
    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByRole('button', { name: 'Checking' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
    await expect(checked).not.toHaveText(before ?? '');
  });

  test('business measures say "Not available" and are not numbers', async ({ page }) => {
    await page.goto('/dashboard');
    const summary = page.getByRole('region', { name: 'Asset summary' });
    await expect(summary.getByText('Not available')).toHaveCount(6);
    const text = await summary.innerText();
    expect(text).not.toMatch(/\b\d{2,}\b/);
    for (const title of [
      'Recent operational activity',
      'Location overview',
      'Open incidents',
      'Recent inspections',
    ]) {
      await expect(page.getByRole('region', { name: title })).toContainText('Planned for Phase');
    }
  });

  test('the help page shows the same real status and diagnostic text', async ({ page }) => {
    await page.goto('/dashboard/help');
    const diag = page.getByRole('region', { name: 'Diagnostics' });
    await expect(diag.getByText('All systems operational')).toBeVisible();
  });
});

/**
 * Private pages need the API to answer "who is this?". When it cannot, the application must say so
 * and show no company pages. These browsers carry a session cookie the API has never issued, so
 * the only thing that varies is why the API cannot answer.
 */
const UNAVAILABLE_TITLE = 'The SmartPack service is not reachable';

test.describe('API unreachable', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webApiDown), storageState: UNVERIFIED_SESSION });

  test('private pages explain the failure and show no company content', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBe(200);
    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible();
    await expect(page.getByText('Your session could not be checked')).toBeVisible();
    // Nothing private is shown and the person is not told they are signed out.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Service status' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectNoHorizontalOverflow(page);
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('the sign-in page says the service is unreachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible();
  });

  test('the sign-in gateway answers 502 with the standard error envelope', async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', {
      data: { email: 'a@b.example', password: 'x' },
      headers: { origin: baseUrlFor(PORTS.webApiDown) },
    });
    expect(response.status()).toBe(502);
    const body = (await response.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBeTruthy();
    expect(body.error.requestId).toBeTruthy();
  });
});

test.describe('API address not configured', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webUnconfigured), storageState: UNVERIFIED_SESSION });

  test('private pages say the service is unavailable', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  });
});

test.describe('API up, database down', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webDbDown), storageState: UNVERIFIED_SESSION });

  test('the API answers 503 for a signed-in request while the database is down', async ({
    request,
  }) => {
    const response = await request.get(`${baseUrlFor(PORTS.apiDbDown)}/api/v1/auth/me`, {
      headers: { cookie: `sp_session=${'x'.repeat(43)}` },
    });
    expect(response.status()).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  test('the session cannot be checked, so no private page is shown', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Service status' })).toHaveCount(0);
  });

  test('the API itself reports the database outage with a 503 health report', async ({
    request,
  }) => {
    const response = await request.get(`${baseUrlFor(PORTS.apiDbDown)}/api/v1/health`);
    expect(response.status()).toBe(503);
    const body = (await response.json()) as {
      data: { status: string; checks: { database: { status: string } } };
    };
    expect(body.data.status).toBe('error');
    expect(body.data.checks.database.status).toBe('down');
  });
});
