import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { StatusBadge } from './status-badge';
import { TextField } from './text-field';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is busy, disabled and unclickable while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('binds the label to the input', () => {
    render(<TextField label="Email address" />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('links hint text through aria-describedby', () => {
    render(<TextField label="Name" hint="As shown on the badge" />);
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('As shown on the badge');
  });

  it('marks the field invalid and announces the error', () => {
    render(<TextField label="Name" hint="Hint" error="Name is required" />);
    const input = screen.getByLabelText('Name');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Hint Name is required');
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('is valid and silent without an error', () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText('Name')).toBeValid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gives two fields different ids', () => {
    render(
      <>
        <TextField label="One" />
        <TextField label="Two" />
      </>,
    );
    expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
  });
});

describe('StatusBadge', () => {
  it('always shows its status as text', () => {
    render(<StatusBadge tone="critical">Database down</StatusBadge>);
    expect(screen.getByText('Database down')).toBeVisible();
  });
});

describe('state components', () => {
  it('EmptyState says what is missing and offers an action', () => {
    render(
      <EmptyState
        title="No SmartPacks yet"
        description="Registered backpacks will appear here."
        action={<Button>Register</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No SmartPacks yet' })).toBeInTheDocument();
    expect(screen.getByText('Registered backpacks will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('LoadingState announces itself once and hides the placeholder blocks', () => {
    const { container } = render(<LoadingState label="Loading overview" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading overview…');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('ErrorState is announced as an alert and shows its detail', () => {
    render(<ErrorState title="Failed" description="Could not load." detail="HTTP 502" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByText('HTTP 502')).toBeInTheDocument();
  });
});
