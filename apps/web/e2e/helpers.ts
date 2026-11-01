import { expect, type Page } from '@playwright/test';

/** Records console errors and uncaught exceptions; smoke tests must never allow either. */
export function trackBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(0);
}

/** Below the `lg` breakpoint (1024px) the sidebar is replaced by a drawer. */
export function usesDrawer(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

export const PUBLIC_ROUTES = ['/', '/login', '/privacy', '/terms'] as const;

/** Every signed-in route, with the heading it must show and whether its module is planned. */
export const APP_ROUTES: ReadonlyArray<{
  path: string;
  heading: string;
  navLabel: string;
  planned: boolean;
}> = [
  { path: '/dashboard', heading: 'Overview', navLabel: 'Overview', planned: false },
  { path: '/dashboard/smartpacks', heading: 'SmartPacks', navLabel: 'SmartPacks', planned: true },
  { path: '/dashboard/workers', heading: 'Workers', navLabel: 'Workers', planned: true },
  {
    path: '/dashboard/verification',
    heading: 'Verification',
    navLabel: 'Verification',
    planned: true,
  },
  { path: '/dashboard/tracking', heading: 'Tracking', navLabel: 'Tracking', planned: true },
  {
    path: '/dashboard/custody',
    heading: 'Custody & Handover',
    navLabel: 'Custody & Handover',
    planned: true,
  },
  {
    path: '/dashboard/inspections',
    heading: 'Inspections',
    navLabel: 'Inspections',
    planned: true,
  },
  {
    path: '/dashboard/alerts',
    heading: 'Alerts & Incidents',
    navLabel: 'Alerts & Incidents',
    planned: true,
  },
  { path: '/dashboard/reports', heading: 'Reports', navLabel: 'Reports', planned: true },
  { path: '/dashboard/settings', heading: 'Settings', navLabel: 'Settings', planned: true },
  {
    path: '/dashboard/help',
    heading: 'Help & Documentation',
    navLabel: 'Help & Documentation',
    planned: false,
  },
];

/** Opens the navigation (drawer on narrow screens) and returns the container to search within. */
export async function openNavigation(page: Page) {
  if (usesDrawer(page)) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    return page.getByRole('dialog', { name: 'Main navigation' });
  }
  return page.locator('aside');
}
