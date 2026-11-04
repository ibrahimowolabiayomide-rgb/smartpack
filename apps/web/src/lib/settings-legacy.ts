import type { Route } from 'next';

/**
 * Phase 2 Settings was one page with in-page anchors. Phase 3 split the sections that became
 * real into their own routes. A bookmark or link such as `/dashboard/settings#security-settings`
 * still works because the page forwards these anchors to the new address.
 *
 * Anchors that still exist on the Settings page (`company-profile`, `notification-preferences`,
 * `integrations`, `data-management`) are deliberately absent: the browser scrolls to them as
 * before. `application-preferences` has no destination: that section was never built (see
 * DEFERRED.md), so the link keeps the person on the Settings page.
 */
const LEGACY_ANCHORS: Readonly<Record<string, Route>> = {
  'security-settings': '/dashboard/settings/security',
  'user-management': '/dashboard/settings/members',
  'roles-and-permissions': '/dashboard/settings/roles',
};

/** The new address for a Phase 2 anchor (with or without the leading "#"), or null. */
export function legacySettingsTarget(hash: string): Route | null {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  return Object.hasOwn(LEGACY_ANCHORS, id) ? (LEGACY_ANCHORS[id] ?? null) : null;
}
