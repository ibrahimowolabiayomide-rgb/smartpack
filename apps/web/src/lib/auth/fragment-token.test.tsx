import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetFragmentTokenForTests, useFragmentToken } from './fragment-token';

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);

function visit(hash: string) {
  window.history.replaceState(null, '', `/accept-invitation${hash}`);
}

describe('useFragmentToken', () => {
  beforeEach(() => {
    resetFragmentTokenForTests();
    visit('');
  });
  afterEach(() => visit(''));

  it('reads a valid token and removes it from the address bar', () => {
    visit(`#token=${TOKEN_A}`);
    const { result } = renderHook(() => useFragmentToken());
    expect(result.current).toBe(TOKEN_A);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/accept-invitation');
  });

  it('reports null for a missing or malformed token', () => {
    const { result } = renderHook(() => useFragmentToken());
    expect(result.current).toBeNull();
    resetFragmentTokenForTests();
    visit('#token=too-short');
    const second = renderHook(() => useFragmentToken());
    expect(second.result.current).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('picks up a different link pasted into the already-open page', () => {
    visit(`#token=${TOKEN_A}`);
    const { result } = renderHook(() => useFragmentToken());
    expect(result.current).toBe(TOKEN_A);

    act(() => {
      window.history.replaceState(null, '', `/accept-invitation#token=${TOKEN_B}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe(TOKEN_B);
    expect(window.location.hash).toBe('');
  });
});
