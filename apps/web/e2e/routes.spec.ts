import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { OWNER_STATE, SIGNED_OUT } from './accounts';
import {
  APP_ROUTES,
  PUBLIC_ROUTES,
  SETTINGS_ROUTES,
  expectNoHorizontalOverflow,
  trackBrowserErrors,
} from './helpers';

const SIGNED_IN_ROUTES = [
  ...new Set<string>([...APP_ROUTES.map((route) => route.path), ...SETTINGS_ROUTES]),
];
const ALL_ROUTES: string[] = [...PUBLIC_ROUTES, ...SIGNED_IN_ROUTES];

/** Public pages are viewed signed out; every other page is viewed as the signed-in Owner. */
const isPublic = (path: string) => (PUBLIC_ROUTES as readonly string[]).includes(path);

/** Declares one test per route, each with the right browser session for that route. */
function forEachRoute(
  title: string,
  routes: readonly string[],
  body: (path: string) => (args: { page: Page }) => Promise<void>,
) {
  test.describe(title, () => {
    for (const path of routes) {
      test.describe(path, () => {
        test.use({ storageState: isPublic(path) ? SIGNED_OUT : OWNER_STATE });
        test('checks', async ({ page }) => body(path)({ page }));
      });
    }
  });
}

// Words that would indicate invented company data. None may appear on any page.
const FORBIDDEN_DATA = ['john', 'jane', 'sp-0', 'lagos', 'ibadan', 'serial no', 'lorem'];

forEachRoute('every route renders correctly', ALL_ROUTES, (path) => async ({ page }) => {
  const errors = trackBrowserErrors(page);
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/SmartPack/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test.describe('module headings and truthful module status', () => {
  test.use({ storageState: OWNER_STATE });
  for (const route of APP_ROUTES) {
    test(`${route.path}: heading and module status`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      if (route.planned) {
        await expect(page.getByText('Not available in this build').first()).toBeVisible();
        await expect(page.getByText(/Planned for Phase \d+/).first()).toBeVisible();
      }
    });
  }
});

forEachRoute(
  'no fabricated data and no prohibited writing patterns',
  ALL_ROUTES,
  (path) =>
    async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const word of FORBIDDEN_DATA) expect(text, word).not.toContain(word);
      // The project brief prohibits em dashes anywhere in the interface.
      expect(text).not.toContain('—');
    },
);

test.describe('planned list pages show structure and no rows', () => {
  test.use({ storageState: OWNER_STATE });
  test('no invented records', async ({ page }) => {
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

forEachRoute(
  'no visible table needs sideways scrolling',
  SIGNED_IN_ROUTES,
  (path) =>
    async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[role="region"]')]
          .filter((region) => region.querySelector('table') && region.offsetParent !== null)
          .filter((region) => region.scrollWidth > region.clientWidth + 1)
          .map((region) => region.getAttribute('aria-label')),
      );
      expect(clipped, 'tables wider than their container').toEqual([]);
    },
);

forEachRoute(
  'accessibility rules (axe-core, WCAG 2.2 AA)',
  ALL_ROUTES,
  (path) =>
    async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    },
);

test.describe('not-found pages', () => {
  test.use({ storageState: OWNER_STATE });

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
});
