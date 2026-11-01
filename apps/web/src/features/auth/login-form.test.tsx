import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('has labelled email and password fields and a submit button', async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows a specific message under each empty field and moves focus to the first', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email address')).toBeInvalid();
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();
    expect(screen.getByText('Check the highlighted fields')).toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument();
  });

  it('reveals the password with the visibility toggle', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('with valid input says sign-in is not enabled, clears the password, and signs nobody in', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'name@company.com');
    await userEvent.type(screen.getByLabelText('Password'), 'a-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('status')).toHaveTextContent('Sign-in is not enabled yet');
    expect(screen.getByRole('status')).toHaveTextContent('not sent, stored');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email address')).toHaveValue('name@company.com');
    expect(screen.queryByText('Check the highlighted fields')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('never stores the password in browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'name@company.com');
    await userEvent.type(screen.getByLabelText('Password'), 'a-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
