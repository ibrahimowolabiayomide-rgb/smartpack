// @vitest-environment node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  IMPLEMENTED_CAPABILITIES,
  NAV_MODULES,
  getModule,
  isModuleActive,
  modulesInGroup,
} from './modules';

const appDir = fileURLToPath(new URL('../app', import.meta.url));

describe('module registry', () => {
  it('lists the navigation required by the project brief, in order', () => {
    expect(modulesInGroup('main').map((entry) => entry.label)).toEqual([
      'Overview',
      'SmartPacks',
      'Workers',
      'Verification',
      'Tracking',
      'Custody & Handover',
      'Inspections',
      'Alerts & Incidents',
      'Reports',
    ]);
    expect(modulesInGroup('secondary').map((entry) => entry.label)).toEqual([
      'Settings',
      'Help & Documentation',
    ]);
  });

  it('uses unique ids and unique routes', () => {
    const ids = NAV_MODULES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const hrefs = NAV_MODULES.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('never links to a page that does not exist', () => {
    for (const entry of NAV_MODULES) {
      const folder = entry.href.replace(/^\//, '');
      const page = `${appDir}/(app)/${folder}/page.tsx`;
      expect(existsSync(page), `${entry.label} -> ${entry.href}`).toBe(true);
    }
  });

  it('gives every planned module a phase between 3 and 10 and a stated dependency', () => {
    for (const entry of NAV_MODULES.filter((m) => m.status === 'planned')) {
      expect(entry.phase, entry.label).toBeGreaterThanOrEqual(3);
      expect(entry.phase, entry.label).toBeLessThanOrEqual(10);
      expect(entry.requires?.length, entry.label).toBeGreaterThan(5);
    }
  });

  it('carries no phase or dependency on an available module', () => {
    for (const entry of NAV_MODULES.filter((m) => m.status === 'available')) {
      expect(entry.phase).toBeUndefined();
      expect(entry.requires).toBeUndefined();
    }
  });

  it('marks only Overview and Help as available in Phase 2', () => {
    expect(
      NAV_MODULES.filter((entry) => entry.status === 'available').map((entry) => entry.id),
    ).toEqual(['overview', 'help']);
  });

  it('describes every module', () => {
    for (const entry of NAV_MODULES) expect(entry.description.length).toBeGreaterThan(10);
  });

  it('throws for an unknown module id rather than guessing', () => {
    expect(() => getModule('nope')).toThrow(/Unknown navigation module/);
  });
});

describe('isModuleActive', () => {
  it('matches the page itself and pages beneath it', () => {
    expect(isModuleActive('/dashboard/workers', '/dashboard/workers')).toBe(true);
    expect(isModuleActive('/dashboard/workers/123', '/dashboard/workers')).toBe(true);
  });

  it('keeps Overview active only on its own page', () => {
    expect(isModuleActive('/dashboard', '/dashboard')).toBe(true);
    expect(isModuleActive('/dashboard/workers', '/dashboard')).toBe(false);
  });

  it('does not confuse a route that merely starts with the same letters', () => {
    expect(isModuleActive('/dashboard/workers-archive', '/dashboard/workers')).toBe(false);
  });
});

describe('implemented capabilities', () => {
  it('has unique ids and descriptions', () => {
    expect(new Set(IMPLEMENTED_CAPABILITIES.map((item) => item.id)).size).toBe(
      IMPLEMENTED_CAPABILITIES.length,
    );
    for (const item of IMPLEMENTED_CAPABILITIES)
      expect(item.description.length).toBeGreaterThan(10);
  });
});
