import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  APP_ROUTES,
  PUBLIC_ROUTES,
  expectNoHorizontalOverflow,
  trackBrowserErrors,
} from './helpers';

const ALL_ROUTES = [...PUBLIC_ROUTES, ...APP_ROUTES.map((route) => route.path)];

// Words that would indicate invented company data. None may appear on any page.
const FORBIDDEN_DATA = ['john', 'jane', 'sp-0', 'lagos', 'ibadan', 'serial no', 'lorem'];

test.describe('every route renders correctly', () => {
  for (const path of ALL_ROUTES) {
    test(`${path}: status, structure, layout, errors`, async ({ page }) => {
      const errors = trackBrowserErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(/SmartPack/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  for (const route of APP_ROUTES) {
    test(`${route.path}: heading and truthful module status`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      if (route.planned) {
        await expect(page.getByText('Not available in this build').first()).toBeVisible();
        await expect(page.getByText(/Planned for Phase \d+/).first()).toBeVisible();
      }
    });
  }
});

test.describe('no fabricated data and no prohibited writing patterns', () => {
  for (const path of ALL_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const word of FORBIDDEN_DATA) expect(text, word).not.toContain(word);
      // The project brief prohibits em dashes anywhere in the interface.
      expect(text).not.toContain('—');
    });
  }

  test('list pages show structure and no rows', async ({ page }) => {
    for (const path of [
      '/dashboard/smartpacks',
      '/dashboard/workers',
      '/dashboard/inspections',
      '/dashboard/alerts',
    ]) {
      await page.goto(path);
      expect(await page.locator('tbody tr').count(), path).toBeLessThanOrEqual(
        path === '/dashboard/alerts' ? 5 : 0, // alerts lists the five fixed categories
      );
    }
  });
});

test.describe('tables are never clipped', () => {
  for (const { path } of APP_ROUTES) {
    test(`${path}: no visible table needs sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[role="region"]')]
          .filter((region) => region.querySelector('table') && region.offsetParent !== null)
          .filter((region) => region.scrollWidth > region.clientWidth + 1)
          .map((region) => region.getAttribute('aria-label')),
      );
      expect(clipped, 'tables wider than their container').toEqual([]);
    });
  }
});

test.describe('accessibility rules (axe-core, WCAG 2.2 AA)', () => {
  for (const path of ALL_ROUTES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    });
  }
});

test('unknown routes show the not-found page with a 404 status', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to overview' })).toBeVisible();
});

test('a module path that does not exist is a 404, not a blank page', async ({ page }) => {
  const response = await page.goto('/dashboard/not-a-module');
  expect(response?.status()).toBe(404);
});
