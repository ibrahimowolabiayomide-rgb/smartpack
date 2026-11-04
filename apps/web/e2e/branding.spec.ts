import { expect, test } from '@playwright/test';
import { OWNER_STATE, SIGNED_OUT } from './accounts';
import { PORTS, baseUrlFor } from './ports';

test.describe('configured branding (no rebuild: environment variables only)', () => {
  test.describe('signed in', () => {
    // Cookies belong to the host, not the port, so the Owner's session also works on the branded
    // web server, which talks to the same API.
    test.use({ baseURL: baseUrlFor(PORTS.webBranded), storageState: OWNER_STATE });

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

    test('valid values produce no warning', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await expect(page.getByRole('heading', { name: 'Web branding' })).toBeVisible();
      await expect(page.getByText('Some branding values were ignored')).toHaveCount(0);
    });
  });

  test.describe('signed out', () => {
    test.use({ baseURL: baseUrlFor(PORTS.webBranded), storageState: SIGNED_OUT });

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
});

test.describe('default branding', () => {
  test.describe('signed in', () => {
    test.use({ storageState: OWNER_STATE });

    test('settings states no company name and the default mark and colour', async ({ page }) => {
      await page.goto('/dashboard/settings');
      const profile = page.locator('#company-profile');
      await expect(profile).toContainText('Not configured');
      await expect(profile).toContainText('SmartPack mark (default)');
      await expect(profile).toContainText('SmartPack green (default)');
      await expect(page.getByText('Some branding values were ignored')).toHaveCount(0);
    });
  });

  test.describe('signed out', () => {
    test.use({ storageState: SIGNED_OUT });

    test('uses the default green', async ({ page }) => {
      await page.goto('/login');
      const submit = page.getByRole('button', { name: 'Sign in', exact: true });
      await expect(submit).toBeEnabled();
      expect(await submit.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        'rgb(43, 106, 76)',
      );
    });
  });
});

test.describe('invalid branding values', () => {
  test.describe('signed in', () => {
    test.use({ baseURL: baseUrlFor(PORTS.webBrandInvalid), storageState: OWNER_STATE });

    test('Settings names each rejected variable, never its value, and uses the defaults', async ({
      page,
    }) => {
      await page.goto('/dashboard/settings');
      const profile = page.locator('#company-profile');
      await expect(profile.getByText('Some branding values were ignored')).toBeVisible();
      await expect(profile).toContainText('BRAND_COMPANY_NAME was ignored');
      await expect(profile).toContainText('BRAND_LOGO_URL was ignored');
      await expect(profile).toContainText('BRAND_ACCENT_COLOR was ignored');
      await expect(profile).not.toContainText('insecure.example');
      await expect(profile).not.toContainText('#f2e600');
      await expect(profile).toContainText('Not configured');
      await expect(profile).toContainText('SmartPack mark (default)');
      await expect(profile).toContainText('SmartPack green (default)');
    });
  });

  test.describe('signed out', () => {
    test.use({ baseURL: baseUrlFor(PORTS.webBrandInvalid), storageState: SIGNED_OUT });

    test('the rejected accent colour is not applied (default green stays)', async ({ page }) => {
      await page.goto('/login');
      const submit = page.getByRole('button', { name: 'Sign in', exact: true });
      await expect(submit).toBeEnabled();
      expect(await submit.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        'rgb(43, 106, 76)',
      );
    });
  });
});
