import { describe, expect, it } from 'vitest';
import { accentCss, deriveAccentPalette, parseBrandConfig, parseLogoSrc } from './config';
import { contrastRatio, mix, parseHex, toHex } from './color';

describe('colour helpers', () => {
  it('parses and formats hex colours', () => {
    expect(parseHex('#2b6a4c')).toEqual([43, 106, 76]);
    expect(toHex([43, 106, 76])).toBe('#2b6a4c');
    expect(parseHex('2b6a4c')).toBeNull();
    expect(parseHex('#fff')).toBeNull();
    expect(parseHex('red')).toBeNull();
  });

  it('computes WCAG contrast', () => {
    const black = [0, 0, 0] as const;
    const white = [255, 255, 255] as const;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('mixes linearly', () => {
    expect(mix([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });
});

describe('accent palette', () => {
  it('accepts the default SmartPack green and keeps every text pair at AA', () => {
    const palette = deriveAccentPalette('#2b6a4c');
    expect(palette).not.toBeNull();
    if (!palette) return;
    const rgb = (hex: string) => parseHex(hex)!;
    expect(contrastRatio(rgb('#f7f4ee'), rgb(palette.accent))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rgb('#f7f4ee'), rgb(palette.accentHover))).toBeGreaterThanOrEqual(4.5);
    for (const background of ['#f7f4ee', '#efebe2', palette.accentTint]) {
      expect(contrastRatio(rgb(palette.accentText), rgb(background))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('rejects colours that cannot carry readable text', () => {
    expect(deriveAccentPalette('#f2e600')).toBeNull(); // yellow: label unreadable on it
    expect(deriveAccentPalette('#cccccc')).toBeNull();
    expect(deriveAccentPalette('not a colour')).toBeNull();
    expect(deriveAccentPalette('#fff')).toBeNull();
  });

  it('produces CSS from validated hex values only', () => {
    const palette = deriveAccentPalette('#1d4f91');
    expect(palette).not.toBeNull();
    if (!palette) return;
    expect(accentCss(palette)).toMatch(/^html:root\{(--accent[a-z-]*:#[0-9a-f]{6};){4}\}$/);
  });
});

describe('logo source', () => {
  it.each(['/brand/logo.svg', '/logo.png', 'https://cdn.example.com/logo.png'])(
    'accepts %s',
    (v) => {
      expect(parseLogoSrc(v)).not.toBeNull();
    },
  );

  it.each([
    'http://cdn.example.com/logo.png',
    '//evil.example.com/logo.png',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,AAAA',
    '/../secret.png',
    'https://user:pass@cdn.example.com/logo.png',
    '/brand/logo.svg" onerror="x',
    'logo.png',
  ])('rejects %s', (v) => {
    expect(parseLogoSrc(v)).toBeNull();
  });
});

describe('parseBrandConfig', () => {
  it('shows no company and the default palette when nothing is configured', () => {
    expect(parseBrandConfig({})).toEqual({
      companyName: null,
      logoSrc: null,
      accent: null,
      warnings: [],
    });
  });

  it('reads valid values', () => {
    const brand = parseBrandConfig({
      BRAND_COMPANY_NAME: '  Example Ltd  ',
      BRAND_LOGO_URL: '/brand/logo.svg',
      BRAND_ACCENT_COLOR: '#1d4f91',
    });
    expect(brand.companyName).toBe('Example Ltd');
    expect(brand.logoSrc).toBe('/brand/logo.svg');
    expect(brand.accent?.accent).toBe('#1d4f91');
    expect(brand.warnings).toEqual([]);
  });

  it('ignores invalid values, says so, and never echoes them', () => {
    const brand = parseBrandConfig({
      BRAND_COMPANY_NAME: 'x'.repeat(200),
      BRAND_LOGO_URL: 'javascript:alert(1)',
      BRAND_ACCENT_COLOR: '#f2e600',
    });
    expect(brand.companyName).toBeNull();
    expect(brand.logoSrc).toBeNull();
    expect(brand.accent).toBeNull();
    expect(brand.warnings).toHaveLength(3);
    expect(brand.warnings.join(' ')).not.toContain('javascript');
    expect(brand.warnings.join(' ')).not.toContain('f2e600');
  });

  it('strips control characters from the company name', () => {
    expect(parseBrandConfig({ BRAND_COMPANY_NAME: 'Acme\nCorp' }).companyName).toBe('Acme Corp');
  });
});
