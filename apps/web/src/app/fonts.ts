import localFont from 'next/font/local';

/*
 * Typefaces are self-hosted from files in ./fonts: no request to a third-party font service is
 * made by visitors, and builds do not depend on network access. Licences and sources are recorded
 * in docs/PROJECT_ARCHITECTURE.md; each licence text sits beside its font files.
 *
 *   IBM Plex Sans     interface text            SIL OFL 1.1
 *   Source Serif 4    headings and wordmark     SIL OFL 1.1
 *   IBM Plex Mono     identifiers, versions     SIL OFL 1.1
 */
export const plexSans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const sourceSerif = localFont({
  src: './fonts/source-serif-4-latin-wght-normal.woff2',
  weight: '200 900',
  style: 'normal',
  variable: '--font-source-serif',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
});
