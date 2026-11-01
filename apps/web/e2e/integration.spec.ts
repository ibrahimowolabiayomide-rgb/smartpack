import { expect, test } from '@playwright/test';
import { PORTS, baseUrlFor } from './ports';
import { expectNoHorizontalOverflow, trackBrowserErrors } from './helpers';

test.describe('overview with a live API and database', () => {
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

test.describe('API unreachable', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webApiDown) });

  test('the overview explains the failure, not an empty success', async ({ page }) => {
    const errors = trackBrowserErrors(page);
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBe(200); // the page still renders; only the panel fails
    const status = page.getByRole('region', { name: 'Service status' });
    await expect(status.getByRole('alert')).toContainText('The API could not be reached');
    await expect(status.getByText('All systems operational')).toHaveCount(0);
    await expect(status.getByText(/Request ID/)).toBeVisible();
    // The rest of the application keeps working.
    await expect(
      page
        .getByRole('navigation', { name: 'Main' })
        .or(page.getByRole('button', { name: 'Open navigation menu' })),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('retrying while the API is still down stays honest', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Check again' }).click();
    await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Service status' }).getByRole('alert'),
    ).toContainText('The API could not be reached');
  });

  test('diagnostics say the API is unreachable', async ({ page }) => {
    await page.goto('/dashboard/help');
    await page.getByRole('button', { name: 'View diagnostic details' }).click();
    await expect(page.getByRole('dialog')).toContainText('API: unreachable');
  });
});

test.describe('API address not configured', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webUnconfigured) });

  test('the overview says the address is missing', async ({ page }) => {
    await page.goto('/dashboard');
    const status = page.getByRole('region', { name: 'Service status' });
    await expect(status.getByRole('alert')).toContainText('The API address is not configured');
    await expect(status.getByText('API_URL is not set.')).toBeVisible();
  });
});

test.describe('API up, database down', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webDbDown) });

  test('reports a database outage separately from API reachability', async ({ page }) => {
    await page.goto('/dashboard');
    const status = page.getByRole('region', { name: 'Service status' });
    await expect(status.getByText('Database unavailable')).toBeVisible();
    await expect(status.getByText('Reachable')).toBeVisible(); // the API itself answered
    await expect(status.getByText('Down')).toBeVisible(); // the database row
    await expect(status.getByText('All systems operational')).toHaveCount(0);
    await expect(status.getByRole('alert')).toHaveCount(0); // it is a report, not a transport failure
  });
});
