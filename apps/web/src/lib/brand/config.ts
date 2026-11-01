import { contrastRatio, mix, parseHex, toHex, type Rgb } from './color';

/*
 * Branding that a company can supply later without a code change or a rebuild.
 *
 * Values come from SERVER environment variables read on each request (see server.ts). They are validated here, and anything invalid is ignored and
 * reported on Settings rather than breaking the interface. Nothing is invented: with no variables
 * set, the application shows the SmartPack name and the default palette and states no company.
 *
 *   BRAND_COMPANY_NAME   display name of the company (max 80 characters)
 *   BRAND_LOGO_URL       a path in apps/web/public (starting with "/") or an https URL
 *   BRAND_ACCENT_COLOR   the one accent colour, as #rrggbb; must stay readable (checked below)
 */

/** Fixed light-theme surfaces from styles/tokens.css, used to check an override stays readable. */
const SURFACES = {
  ground: parseHex('#efebe2') as Rgb,
  surface: parseHex('#f7f4ee') as Rgb,
  ink: parseHex('#1c222b') as Rgb,
};
const ACCENT_INK = SURFACES.surface;
const MIN_TEXT_CONTRAST = 4.5;
const MAX_COMPANY_NAME = 80;

export interface AccentPalette {
  accent: string;
  accentHover: string;
  accentTint: string;
  accentText: string;
}

export interface BrandConfig {
  companyName: string | null;
  logoSrc: string | null;
  accent: AccentPalette | null;
  /** Human-readable reasons a supplied value was ignored. Never contains the value itself. */
  warnings: string[];
}

/** The part of the brand that client components may receive as props. */
export type PublicBrand = Pick<BrandConfig, 'companyName' | 'logoSrc'>;

export function parseCompanyName(raw: string | undefined): string | null {
  // Control characters and line breaks never belong in a display name.
  const cleaned = raw?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_COMPANY_NAME ? null : cleaned;
}

export function parseLogoSrc(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^\/(?!\/)[A-Za-z0-9._~\-/]*$/.test(value) && !value.includes('..')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Derives the four accent tokens from one colour and verifies every text pair the interface uses
 * stays at WCAG AA (4.5:1). Returns null when the colour cannot be made readable.
 */
export function deriveAccentPalette(hex: string): AccentPalette | null {
  const accent = parseHex(hex);
  if (!accent) return null;

  if (contrastRatio(ACCENT_INK, accent) < MIN_TEXT_CONTRAST) return null; // button label
  if (contrastRatio(accent, SURFACES.ground) < MIN_TEXT_CONTRAST) return null; // accent as text

  const hover = mix(accent, SURFACES.ink, 0.18);
  if (contrastRatio(ACCENT_INK, hover) < MIN_TEXT_CONTRAST) return null;

  const tint = mix(SURFACES.surface, accent, 0.16);
  // Darken the accent text until it reads on the tint and on both page surfaces.
  for (let step = 0.12; step <= 0.6; step += 0.06) {
    const text = mix(accent, SURFACES.ink, step);
    const readable = [tint, SURFACES.surface, SURFACES.ground].every(
      (background) => contrastRatio(text, background) >= MIN_TEXT_CONTRAST,
    );
    if (readable) {
      return {
        accent: toHex(accent),
        accentHover: toHex(hover),
        accentTint: toHex(tint),
        accentText: toHex(text),
      };
    }
  }
  return null;
}

export function parseBrandConfig(env: Record<string, string | undefined>): BrandConfig {
  const warnings: string[] = [];

  const rawName = env.BRAND_COMPANY_NAME;
  const companyName = parseCompanyName(rawName);
  if (rawName?.trim() && !companyName) {
    warnings.push(
      `BRAND_COMPANY_NAME was ignored: it must be 1 to ${MAX_COMPANY_NAME} characters.`,
    );
  }

  const rawLogo = env.BRAND_LOGO_URL;
  const logoSrc = parseLogoSrc(rawLogo);
  if (rawLogo?.trim() && !logoSrc) {
    warnings.push('BRAND_LOGO_URL was ignored: use a path starting with "/" or an https URL.');
  }

  const rawAccent = env.BRAND_ACCENT_COLOR;
  const accent = rawAccent?.trim() ? deriveAccentPalette(rawAccent) : null;
  if (rawAccent?.trim() && !accent) {
    warnings.push(
      'BRAND_ACCENT_COLOR was ignored: it must be #rrggbb and keep text on it readable (WCAG AA).',
    );
  }

  return { companyName, logoSrc, accent, warnings };
}

/** CSS that overrides the accent tokens. Built only from validated hex values. */
export function accentCss(accent: AccentPalette): string {
  return (
    `html:root{--accent:${accent.accent};--accent-hover:${accent.accentHover};` +
    `--accent-tint:${accent.accentTint};--accent-text:${accent.accentText};}`
  );
}
