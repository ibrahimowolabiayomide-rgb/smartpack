import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PRODUCT_FULL_NAME, PRODUCT_NAME } from '@/lib/app-info';
import { accentCss } from '@/lib/brand/config';
import { getBrandConfig } from '@/lib/brand/server';
import { plexMono, plexSans, sourceSerif } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: PRODUCT_FULL_NAME, template: `%s · ${PRODUCT_NAME}` },
  description:
    'Company platform for registering, identifying, verifying and tracking SmartPack backpacks.',
  applicationName: PRODUCT_NAME,
  // This is a development preview with no authentication. It must not be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#efebe2',
  colorScheme: 'light',
  // Lets the layout use the safe-area insets on phones with a notch or a home indicator.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const brand = await getBrandConfig();
  return (
    <html lang="en" className={`${plexSans.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body>
        {/* Only validated hex values reach this stylesheet (see lib/brand/config.ts). */}
        {brand.accent ? (
          <style href="brand-accent" precedence="default">
            {accentCss(brand.accent)}
          </style>
        ) : null}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-ground"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
