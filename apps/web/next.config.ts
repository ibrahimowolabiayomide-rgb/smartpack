import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Security headers applied to every response.
 *
 * Deliberately NOT included yet: a `script-src` Content-Security-Policy. Next.js inlines
 * hydration scripts, so a strict policy needs per-request nonces, which forces every page to be
 * rendered dynamically. That trade-off is made together with authentication, when the pages
 * start to carry private data. See docs/PROJECT_ARCHITECTURE.md (Security).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  // Camera and geolocation are needed later (QR scanning, worker location). They are disabled
  // now and will be enabled for this origin only when those features exist.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` otherwise writes an AGENTS.md (guidance for AI coding tools) into the project.
  // It is not part of the product, so keep the working tree free of generated files.
  agentRules: false,
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
