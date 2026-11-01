import { expect, test } from '@playwright/test';
import { APP_ROUTES, openNavigation, usesDrawer } from './helpers';

test.describe('responsive navigation', () => {
  test('wide screens show the sidebar; narrow screens show a menu button instead', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
    if (usesDrawer(page)) {
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
      await expect(menuButton).toBeVisible();
    } else {
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
      await expect(menuButton).toBeHidden();
    }
  });

  test('main navigation lists the nine modules and secondary lists settings and help', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const nav = await openNavigation(page);
    await expect(nav.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveCount(9);
    await expect(nav.getByRole('navigation', { name: 'Secondary' }).getByRole('link')).toHaveCount(
      2,
    );
  });

  test('every navigation link opens its page and is marked current there', async ({ page }) => {
    await page.goto('/dashboard');
    for (const route of APP_ROUTES) {
      const nav = await openNavigation(page);
      await nav.getByRole('link', { name: route.navLabel }).click();
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      // The drawer closes after navigating.
      if (usesDrawer(page)) await expect(page.getByRole('dialog')).toBeHidden();
      const current = (await openNavigation(page)).locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toContainText(route.navLabel);
      if (usesDrawer(page)) await page.keyboard.press('Escape');
    }
  });

  test('planned modules say so in the navigation', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = await openNavigation(page);
    const planned = nav.getByText('Planned', { exact: false });
    await expect(planned).toHaveCount(APP_ROUTES.filter((r) => r.planned).length);
  });

  test('breadcrumbs lead back to the overview', async ({ page }) => {
    await page.goto('/dashboard/workers');
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(crumbs.getByText('Workers')).toHaveAttribute('aria-current', 'page');
    await crumbs.getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('the drawer opens, traps focus, closes with Escape and returns focus', async ({ page }) => {
    test.skip(!usesDrawer(page), 'drawer exists only on narrow screens');
    await page.goto('/dashboard');
    const opener = page.getByRole('button', { name: 'Open navigation menu' });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Main navigation' });
    await expect(drawer).toBeVisible();

    // Focus stays inside while tabbing past the last control.
    for (let i = 0; i < 16; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(
      true,
    );

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the drawer closes from its close button and from the backdrop', async ({ page }) => {
    test.skip(!usesDrawer(page), 'drawer exists only on narrow screens');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.getByRole('button', { name: 'Close navigation menu' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const width = page.viewportSize()?.width ?? 360;
    await page.mouse.click(width - 5, 400); // the dim area to the right of the drawer
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('page behind an open drawer does not scroll', async ({ page }) => {
    test.skip(!usesDrawer(page), 'drawer exists only on narrow screens');
    await page.goto('/dashboard/help');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow);
    expect(overflow).toBe('hidden');
  });

  test('touch targets in the navigation are at least 44px tall on touch screens', async ({
    page,
    hasTouch,
  }) => {
    test.skip(!hasTouch, 'only meaningful with a coarse pointer');
    await page.goto('/dashboard');
    if (usesDrawer(page)) {
      const box = await page.getByRole('button', { name: 'Open navigation menu' }).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const nav = await openNavigation(page);
    for (const link of await nav.getByRole('navigation').getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
