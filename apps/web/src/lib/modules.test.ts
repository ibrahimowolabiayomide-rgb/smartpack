import { describe, expect, it } from 'vitest';
import { BUILD_CONTENTS, NAV_MODULES } from './modules';

describe('module registry', () => {
  it('lists the navigation labels required by the project brief, in order', () => {
    expect(NAV_MODULES.map((entry) => entry.label)).toEqual([
      'Overview',
      'SmartPacks',
      'Workers',
      'Verification',
      'Tracking',
      'Custody',
      'Inspections',
      'Alerts',
      'Reports',
      'Settings',
    ]);
  });

  it('uses unique ids', () => {
    const ids = NAV_MODULES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives a route to every available module and to no planned module', () => {
    for (const entry of NAV_MODULES) {
      if (entry.status === 'available') expect(entry.href).toBeDefined();
      else expect(entry.href).toBeUndefined();
    }
  });

  it('marks only the Overview as available in Phase 1', () => {
    const available = NAV_MODULES.filter((entry) => entry.status === 'available');
    expect(available.map((entry) => entry.id)).toEqual(['overview']);
  });

  it('describes every module', () => {
    for (const entry of NAV_MODULES) expect(entry.description.length).toBeGreaterThan(10);
  });
});

describe('build contents', () => {
  it('has unique ids and descriptions', () => {
    expect(new Set(BUILD_CONTENTS.map((item) => item.id)).size).toBe(BUILD_CONTENTS.length);
    for (const item of BUILD_CONTENTS) expect(item.description.length).toBeGreaterThan(10);
  });
});
