// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Reads `--name: #rrggbb;` declarations out of tokens.css, so the test checks the real values. */
function readTokens(): Map<string, string> {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value);
  }
  return tokens;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const tokens = readTokens();
const token = (name: string): string => {
  const value = tokens.get(name);
  if (!value) throw new Error(`Token --${name} is missing from tokens.css`);
  return value;
};

/** [foreground, background, minimum ratio, where it is used] */
const TEXT_PAIRS: Array<[string, string, number, string]> = [
  ['ink', 'ground', 4.5, 'body text on the page'],
  ['ink', 'surface', 4.5, 'body text in panels'],
  ['ink-muted', 'ground', 4.5, 'secondary text on the page'],
  ['ink-muted', 'surface', 4.5, 'secondary text in panels'],
  ['ink-muted', 'sunken', 4.5, 'table headings and notices'],
  ['ink-subtle', 'ground', 4.5, 'tertiary text on the page'],
  ['ink-subtle', 'surface', 4.5, 'placeholders and hints in panels'],
  ['ink-subtle', 'sunken', 4.5, 'disabled field text'],
  ['nav-text', 'nav', 4.5, 'navigation labels'],
  ['nav-muted', 'nav', 4.5, 'inactive navigation items'],
  ['nav-dim', 'nav', 4.5, 'planned-module labels'],
  ['nav-text', 'nav-raised', 4.5, 'active navigation item'],
  ['nav-muted', 'nav-raised', 4.5, 'hovered navigation item'],
  ['accent-ink', 'accent', 4.5, 'primary button'],
  ['accent-ink', 'accent-hover', 4.5, 'primary button hover'],
  ['accent-text', 'surface', 4.5, 'eyebrow and positive text'],
  ['accent-text', 'ground', 4.5, 'eyebrow on the page'],
  ['accent-text', 'accent-tint', 4.5, 'positive badge'],
  ['accent', 'ground', 4.5, 'accent used as text'],
  ['warn-text', 'warn-bg', 4.5, 'warning badge and notice'],
  ['danger-text', 'danger-bg', 4.5, 'error badge and state'],
  ['neutral-text', 'neutral-bg', 4.5, 'neutral badge'],
  ['ground', 'ink', 4.5, 'skip link'],
];

describe('design tokens: text contrast (WCAG AA, 4.5:1)', () => {
  it.each(TEXT_PAIRS)('%s on %s meets %s:1 (%s)', (foreground, background, minimum) => {
    expect(contrastRatio(token(foreground), token(background))).toBeGreaterThanOrEqual(minimum);
  });
});

describe('design tokens: non-text contrast (WCAG 1.4.11, 3:1)', () => {
  it('form control borders are distinguishable from the surface they sit on', () => {
    expect(contrastRatio(token('line-strong'), token('surface'))).toBeGreaterThanOrEqual(3);
  });

  it('the focus ring is visible on light and dark backgrounds', () => {
    for (const background of ['ground', 'surface', 'sunken']) {
      expect(contrastRatio(token('focus'), token(background))).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(token('focus-on-dark'), token('nav'))).toBeGreaterThanOrEqual(3);
  });
});

describe('design tokens: palette rules', () => {
  it('never uses pure white or pure black', () => {
    for (const value of tokens.values()) {
      expect(value.toLowerCase()).not.toBe('#ffffff');
      expect(value.toLowerCase()).not.toBe('#000000');
    }
  });

  it('keeps the page background warm rather than white', () => {
    const ground = token('ground');
    expect(luminance(ground)).toBeLessThan(0.85);
  });
});
