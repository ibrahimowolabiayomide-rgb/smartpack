import type { MetadataRoute } from 'next';

/** Phase 1 is a preview with no authentication: ask crawlers to stay out entirely. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
