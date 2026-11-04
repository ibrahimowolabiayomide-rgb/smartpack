import { describe, expect, it } from 'vitest';
import { legacySettingsTarget } from './settings-legacy';

describe('legacySettingsTarget', () => {
  it('forwards the Phase 2 anchors whose sections became pages', () => {
    expect(legacySettingsTarget('#security-settings')).toBe('/dashboard/settings/security');
    expect(legacySettingsTarget('#user-management')).toBe('/dashboard/settings/members');
    expect(legacySettingsTarget('#roles-and-permissions')).toBe('/dashboard/settings/roles');
  });

  it('accepts the anchor with or without the leading hash', () => {
    expect(legacySettingsTarget('security-settings')).toBe('/dashboard/settings/security');
  });

  it('leaves anchors that still exist on the Settings page alone', () => {
    for (const id of [
      'company-profile',
      'notification-preferences',
      'integrations',
      'data-management',
    ]) {
      expect(legacySettingsTarget(`#${id}`)).toBeNull();
    }
  });

  it('has no destination for the section that was never built, and ignores anything else', () => {
    expect(legacySettingsTarget('#application-preferences')).toBeNull();
    expect(legacySettingsTarget('')).toBeNull();
    expect(legacySettingsTarget('#unknown')).toBeNull();
    expect(legacySettingsTarget('#constructor')).toBeNull();
    expect(legacySettingsTarget('#__proto__')).toBeNull();
  });
});
