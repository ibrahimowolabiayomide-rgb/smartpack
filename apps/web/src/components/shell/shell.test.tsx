import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MODULES, modulesInGroup } from '@/lib/modules';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { HelpMenu } from './help-menu';
import { MobileNav } from './mobile-nav';
import { NavList } from './nav-list';

beforeEach(() => {
  navigation.pathname = '/dashboard';
});

describe('NavList', () => {
  it('has a Main and a Secondary navigation landmark', () => {
    render(<NavList />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secondary' })).toBeInTheDocument();
  });

  it('puts the nine main modules in Main and Settings and Help in Secondary', () => {
    render(<NavList />);
    const main = screen.getByRole('navigation', { name: 'Main' });
    const secondary = screen.getByRole('navigation', { name: 'Secondary' });
    expect(within(main).getAllByRole('link')).toHaveLength(9);
    expect(
      within(secondary)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('Settings'),
      expect.stringContaining('Help & Documentation'),
    ]);
  });

  it('renders every module as a link to its real route', () => {
    render(<NavList />);
    for (const entry of NAV_MODULES) {
      const link = screen.getByRole('link', { name: new RegExp(entry.label) });
      expect(link).toHaveAttribute('href', entry.href);
    }
  });

  it('marks exactly the current page with aria-current', () => {
    navigation.pathname = '/dashboard/workers';
    render(<NavList />);
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Workers');
  });

  it('keeps Overview inactive on other pages', () => {
    navigation.pathname = '/dashboard/tracking';
    render(<NavList />);
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('says "Planned" next to every module that is not built, and nowhere else', () => {
    render(<NavList />);
    for (const entry of NAV_MODULES) {
      const link = screen.getByRole('link', { name: new RegExp(entry.label) });
      if (entry.status === 'planned') expect(link).toHaveTextContent(/planned/i);
      else expect(link).not.toHaveTextContent(/planned/i);
    }
  });

  it('lists the groups from the registry', () => {
    expect(modulesInGroup('main')).toHaveLength(9);
    expect(modulesInGroup('secondary')).toHaveLength(2);
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
    expect(within(dialog).getByRole('link', { name: /Settings/ })).toBeInTheDocument();
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

  it('closes when the route changes underneath it', async () => {
    const { rerender } = render(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    navigation.pathname = '/dashboard/reports';
    rerender(<MobileNav />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('HelpMenu', () => {
  it('offers help, diagnostics and the legal pages', async () => {
    render(<HelpMenu />);
    await userEvent.click(screen.getByRole('button', { name: /Help/ }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Help & Documentation',
      'Diagnostics',
      'Privacy',
      'Terms',
    ]);
    expect(items[1]).toHaveAttribute('href', '/dashboard/help#diagnostics');
  });
});
