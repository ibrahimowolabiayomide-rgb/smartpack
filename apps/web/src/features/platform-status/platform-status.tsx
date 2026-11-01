import { getApiHealth } from '@/lib/api/health';
import { PlatformStatusView } from './platform-status-view';

/**
 * Fetches the live health report on the server for every request and renders it. The fetch uses
 * `cache: 'no-store'` (see lib/api/client.ts), so the page never shows a stale "healthy" state.
 */
export async function PlatformStatus() {
  const result = await getApiHealth();
  return <PlatformStatusView result={result} />;
}
