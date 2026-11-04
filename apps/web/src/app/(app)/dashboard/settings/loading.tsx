import { LoadingState } from '@/components/ui/loading-state';

/**
 * Shown inside the Settings layout (heading and section navigation stay in place) while a
 * Settings page waits for its data, so the area is never blank during a slow response.
 */
export default function SettingsLoading() {
  return <LoadingState label="Loading settings" rows={5} />;
}
