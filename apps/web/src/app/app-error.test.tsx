import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppError from './(app)/error';

describe('Signed-in error boundary', () => {
  it('explains that the page could not be displayed and offers a retry that calls reset', async () => {
    const reset = vi.fn();
    render(<AppError error={new Error('boom')} reset={reset} />);
    expect(screen.getByText('This page could not be displayed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does not print the error message to the person', () => {
    render(<AppError error={new Error('secret-detail')} reset={() => undefined} />);
    expect(screen.queryByText(/secret-detail/)).toBeNull();
  });
});
