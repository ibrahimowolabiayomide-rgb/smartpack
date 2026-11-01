import { expect, test } from '@playwright/test';
import { PORTS, baseUrlFor } from './ports';

test.describe('configured branding (no rebuild: environment variables only)', () => {
  test.use({ baseURL: baseUrlFor(PORTS.webBranded) });

  test('company name and logo appear in the shell', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText('Example Manufacturing Ltd').first()).toBeAttached();
    await expect(
      page.locator('header img[src*="icon-192"], aside img[src*="icon-192"]').first(),
    ).toBeAttached();
    const profile = page.locator('#company-profile');
    await expect(profile).toContainText('Example Manufacturing Ltd');
    await expect(profile).toContainText('Custom logo in use');
    await expect(profile).toContainText('#1d4f91');
  });

  test('the configured accent colour is applied to primary actions', async ({ page }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(submit).toBeEnabled();
    const background = await submit.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(background).toBe('rgb(29, 79, 145)');
  });

  test('the public footer shows the company name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo')).toContainText('Example Manufacturing Ltd');
  });
});

test.describe('default branding', () => {
  test('states no company and uses the default green', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('#company-profile')).toContainText('Not configured');
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(submit).toBeEnabled();
    expect(await submit.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
      'rgb(43, 106, 76)',
    );
  });
});
