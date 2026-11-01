import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';
import { Dialog } from './dialog';
import { Drawer } from './drawer';
import { DropdownMenu } from './dropdown-menu';
import { Tabs } from './tabs';
import { ToastProvider, useToast } from './toast';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onOpenChange={setOpen} title="Details" description="About this thing">
        <p>Body text</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is not exposed until opened, then named and described', async () => {
    render(<DialogHarness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAccessibleDescription('About this thing');
    expect(within(dialog).getByText('Body text')).toBeVisible();
  });

  it('closes from its close button', async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on a click on the backdrop but not on its content', async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.click(screen.getByText('Body text'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('dialog', { hidden: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reports a native close (such as Escape) to its owner', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="T" />);
    screen.getByRole('dialog').dispatchEvent(new Event('close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('ConfirmDialog', () => {
  it('confirms only when asked, and cancel never confirms', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Remove item"
        description="This cannot be undone."
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Remove item' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('marks Cancel as the initial focus target', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="T"
        description="D"
        confirmLabel="Go"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-autofocus');
  });

  it('blocks a second press while the action runs', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        pending
        onOpenChange={() => {}}
        title="T"
        description="D"
        confirmLabel="Go"
        onConfirm={onConfirm}
      />,
    );
    const go = screen.getByRole('button', { name: 'Go' });
    expect(go).toBeDisabled();
    expect(go).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Drawer', () => {
  it('is labelled and shows its content when open', () => {
    render(
      <Drawer open onOpenChange={() => {}} label="Filters" side="right">
        <p>Panel</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveTextContent('Panel');
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Alpha', content: <p>Alpha content</p> },
    { id: 'b', label: 'Beta', content: <p>Beta content</p> },
    { id: 'c', label: 'Gamma', content: <p>Gamma content</p> },
  ];

  it('shows the first panel and labels panels by their tabs', () => {
    render(<Tabs label="Views" tabs={tabs} />);
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Alpha' })).toHaveTextContent('Alpha content');
    expect(screen.queryByText('Beta content')).not.toBeVisible();
  });

  it('switches on click', async () => {
    render(<Tabs label="Views" tabs={tabs} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Beta' })).toBeVisible();
    expect(screen.queryByText('Alpha content')).not.toBeVisible();
  });

  it('uses a single tab stop (roving tabindex)', () => {
    render(<Tabs label="Views" tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves with arrow keys, wraps, and supports Home and End', async () => {
    render(<Tabs label="Views" tabs={tabs} />);
    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('DropdownMenu', () => {
  it('opens on click, focuses the first item and reports expanded state', async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        label="Actions"
        items={[
          { id: 'one', label: 'One', onSelect },
          { id: 'two', label: 'Two', href: '/dashboard' },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
  });

  it('moves with arrow keys, wraps and supports Home and End', async () => {
    render(
      <DropdownMenu
        label="Actions"
        items={[
          { id: 'a', label: 'A', onSelect: () => {} },
          { id: 'b', label: 'B', onSelect: () => {} },
          { id: 'c', label: 'C', onSelect: () => {} },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'B' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'C' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'A' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'C' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'A' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<DropdownMenu label="Actions" items={[{ id: 'a', label: 'A', onSelect: () => {} }]} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside press', async () => {
    render(
      <>
        <DropdownMenu label="Actions" items={[{ id: 'a', label: 'A', onSelect: () => {} }]} />
        <p>Elsewhere</p>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(screen.getByText('Elsewhere'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('runs an action item and closes', async () => {
    const onSelect = vi.fn();
    render(<DropdownMenu label="Actions" items={[{ id: 'a', label: 'Do it', onSelect }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens with ArrowDown from the keyboard', async () => {
    render(<DropdownMenu label="Actions" items={[{ id: 'a', label: 'A', onSelect: () => {} }]} />);
    screen.getByRole('button', { name: 'Actions' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

function ToastHarness() {
  const { notify } = useToast();
  return (
    <>
      <button onClick={() => notify({ tone: 'success', title: 'Saved', description: 'All good' })}>
        ok
      </button>
      <button onClick={() => notify({ tone: 'error', title: 'Failed' })}>bad</button>
    </>
  );
}

describe('Toast', () => {
  it('announces success politely and errors assertively, each in its own region', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    await userEvent.click(screen.getByRole('button', { name: 'bad' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('status')).toHaveTextContent('All good');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('can be dismissed', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'bad' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss: Failed' }));
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('removes a success message after its duration but keeps an error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <ToastProvider>
          <ToastHarness />
        </ToastProvider>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'ok' }));
      await userEvent.click(screen.getByRole('button', { name: 'bad' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_000);
      });
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses to be used outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
