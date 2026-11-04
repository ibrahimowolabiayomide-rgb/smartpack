'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { legacySettingsTarget } from '@/lib/settings-legacy';

/**
 * Handles address fragments on the Settings page. It renders nothing and changes no data.
 *
 * - A Phase 2 anchor whose section moved to its own page is forwarded there. The fragment never
 *   reaches the server, so this has to run in the browser.
 * - Any other fragment that names an element on the page is scrolled to once the page is shown.
 *   The Settings page streams in behind a loading state, so the browser's own jump to the fragment
 *   can happen before the target exists and then never repeats.
 */
export function LegacyAnchorRedirect() {
  const router = useRouter();

  useEffect(() => {
    const forward = () => {
      const target = legacySettingsTarget(window.location.hash);
      if (target) router.replace(target);
    };
    forward();
    // On arrival only: later fragment changes are scrolled by the browser itself, because the
    // target already exists by then.
    const id = decodeFragment(window.location.hash);
    if (id && !legacySettingsTarget(window.location.hash)) {
      document.getElementById(id)?.scrollIntoView();
    }
    window.addEventListener('hashchange', forward);
    return () => window.removeEventListener('hashchange', forward);
  }, [router]);

  return null;
}

/** The element id named by a fragment, or null if there is none or it is not valid encoding. */
function decodeFragment(hash: string): string | null {
  if (hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}
