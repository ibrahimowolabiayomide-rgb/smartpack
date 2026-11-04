import type { MetadataRoute } from 'next';

/** The whole site is private company software: ask crawlers to stay out entirely. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
