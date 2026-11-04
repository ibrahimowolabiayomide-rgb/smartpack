import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LegacyAnchorRedirect } from './legacy-anchor-redirect';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('LegacyAnchorRedirect', () => {
  beforeEach(() => replace.mockClear());
  afterEach(() => {
    window.location.hash = '';
  });

  it('forwards a Phase 2 anchor present when the page opens', () => {
    window.location.hash = '#user-management';
    render(<LegacyAnchorRedirect />);
    expect(replace).toHaveBeenCalledWith('/dashboard/settings/members');
  });

  it('forwards an anchor that appears later', () => {
    render(<LegacyAnchorRedirect />);
    expect(replace).not.toHaveBeenCalled();
    window.location.hash = '#roles-and-permissions';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(replace).toHaveBeenCalledWith('/dashboard/settings/roles');
  });

  it('does not forward an anchor that still exists, and renders nothing', () => {
    window.location.hash = '#company-profile';
    const { container } = render(<LegacyAnchorRedirect />);
    expect(replace).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('scrolls to an existing section that was not on the page when the browser looked for it', () => {
    const target = document.createElement('div');
    target.id = 'data-management';
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    document.body.append(target);
    window.location.hash = '#data-management';
    render(<LegacyAnchorRedirect />);
    expect(scroll).toHaveBeenCalledTimes(1);
    target.remove();
  });

  it('does not scroll for a forwarded anchor, an unknown anchor or a malformed fragment', () => {
    const target = document.createElement('div');
    target.id = 'user-management';
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    document.body.append(target);
    for (const hash of ['#user-management', '#no-such-section', '#%E0%A4%A']) {
      window.location.hash = hash;
      render(<LegacyAnchorRedirect />);
    }
    expect(scroll).not.toHaveBeenCalled();
    target.remove();
  });
});
