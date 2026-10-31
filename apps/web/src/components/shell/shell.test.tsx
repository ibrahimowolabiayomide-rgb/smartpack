import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MODULES } from '@/lib/modules';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

import { MobileNav } from './mobile-nav';
import { NavList } from './nav-list';

beforeAll(() => {
  // jsdom does not implement <dialog> modal behaviour; model the parts the component relies on.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  navigation.pathname = '/dashboard';
});

describe('NavList', () => {
  it('is a labelled navigation landmark', () => {
    render(<NavList />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders Overview as a link to the dashboard, marked current on that page', () => {
    render(<NavList />);
    const link = screen.getByRole('link', { name: 'Overview' });
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Overview current on other pages', () => {
    navigation.pathname = '/login';
    render(<NavList />);
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('renders planned modules as inert, clearly labelled items, not links', () => {
    render(<NavList />);
    const planned = NAV_MODULES.filter((entry) => entry.status === 'planned');
    expect(planned.length).toBeGreaterThan(0);
    for (const entry of planned) {
      expect(screen.queryByRole('link', { name: new RegExp(entry.label) })).not.toBeInTheDocument();
      const item = screen.getByText(entry.label).closest('[aria-disabled="true"]');
      expect(item).not.toBeNull();
      expect(item).toHaveTextContent(/planned/i);
    }
  });

  it('exposes exactly one link in Phase 1', () => {
    render(<NavList />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('MobileNav', () => {
  it('has an accessible trigger that opens the navigation dialog', async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Main navigation' });
    expect(within(dialog).getByRole('link', { name: 'Overview' })).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes after following a link', async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('link', { name: 'Overview' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
