'use client';

import { tokenSchema } from '@smartpack/shared';
import { useSyncExternalStore } from 'react';

/**
 * One-time links (invitation, password reset, email verification) carry their token after the
 * `#` in the address. A fragment is never sent to any server, never appears in access logs, and is
 * not passed on in the Referer header. As soon as the page has read it, the address is rewritten
 * without it, so it does not stay in the address bar, history or a screenshot.
 *
 * `undefined` = not known yet (server render and hydration); `null` = no valid token in the link;
 * a string = the token.
 */
let captured: string | null | undefined;

function read(): string | null {
  if (captured !== undefined) return captured;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const candidate = params.get('token');
  const parsed = candidate ? tokenSchema.safeParse(candidate) : undefined;
  captured = parsed?.success ? parsed.data : null;
  if (window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  return captured;
}

/**
 * A person can paste a different link into a page that is already open; that changes only the
 * fragment, so the browser does not reload. Forget the captured token when that happens so the new
 * link is read (and removed from the address bar) like the first one.
 */
function subscribe(onChange: () => void): () => void {
  const onHashChange = () => {
    captured = undefined;
    onChange();
  };
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}

export function useFragmentToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** Test helper: forget the captured token so the next read parses the address again. */
export function resetFragmentTokenForTests(): void {
  captured = undefined;
}
