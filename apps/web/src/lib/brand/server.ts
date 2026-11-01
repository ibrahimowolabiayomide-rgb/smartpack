import { connection } from 'next/server';
import { cache } from 'react';
import { parseBrandConfig, type BrandConfig } from './config';

/**
 * The brand for the current request. Reading it opts the page into per-request rendering, which
 * is what lets a changed environment variable take effect on restart without rebuilding.
 */
export const getBrandConfig = cache(async (): Promise<BrandConfig> => {
  await connection();
  return parseBrandConfig(process.env);
});
