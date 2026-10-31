import type { MetadataRoute } from 'next';
import { PRODUCT_FULL_NAME, PRODUCT_NAME } from '@/lib/app-info';

/**
 * Web app manifest: lets the site be installed to a home screen or desktop. Offline support (a
 * service worker) is intentionally not part of Phase 1: caching private asset data safely needs
 * the authentication design first. See docs/PROJECT_ARCHITECTURE.md.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_FULL_NAME,
    short_name: PRODUCT_NAME,
    description: 'Register, identify, verify and track SmartPack backpacks.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#efebe2',
    theme_color: '#171d26',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
