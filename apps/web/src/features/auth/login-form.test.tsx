import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { LoginForm } from './login-form';

const USER = {
  user: {
    id: crypto.randomUUID(),
    email: 'name@company.com',
    displayName: 'N C',
    firstName: 'N',
    lastName: 'C',
    emailVerified: true,
    status: 'active',
  },
  organization: { id: crypto.randomUUID(), name: 'Acme', slug: 'acme', timeZone: 'Africa/Lagos' },
  membership: {
    id: crypto.randomUUID(),
    status: 'active',
    role: { key: 'owner', name: 'Company Owner' },
  },
  permissions: [],
  session: {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  },
};

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
const errorBody = (
  code: string,
  statusCode: number,
  details?: Array<{ path: string; message: string }>,
) => ({
  error: { code, message: 'x', statusCode, requestId: 'r1', ...(details ? { details } : {}) },
});

async function fill(email = 'name@company.com', password = 'a-password') {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    router.replace.mockClear();
    router.refresh.mockClear();
  });
  afterEach(() => fetchSpy.mockRestore());

  it('has labelled email and password fields, a submit button and a reset link', async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows a specific message under each empty field, focuses the first and sends nothing', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed email without sending', async () => {
    render(<LoginForm />);
    await fill('not-an-email', 'x');
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reveals the password with the visibility toggle', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('posts the credentials to the same-origin API and goes to the dashboard', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(reply(200, { data: USER })));
    render(<LoginForm />);
    await fill();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'name@company.com',
      password: 'a-password',
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it('returns to the page the person was heading to, but never to another site', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(reply(200, { data: USER })));
    const { unmount } = render(<LoginForm next="/dashboard/settings/members" />);
    await fill();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard/settings/members'));
    unmount();

    router.replace.mockClear();
    render(<LoginForm next="https://evil.example/steal" />);
    await fill();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows one generic message for bad credentials and clears the password', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(reply(401, errorBody('INVALID_CREDENTIALS', 401))),
    );
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'email address or password is not correct',
    );
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Email address')).toHaveValue('name@company.com');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('tells the person when to retry after too many attempts', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(reply(429, errorBody('RATE_LIMITED', 429), { 'retry-after': '45' })),
    );
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 45 seconds');
  });

  it('asks for the company reference when the account belongs to several companies', async () => {
    fetchSpy.mockResolvedValueOnce(
      reply(
        400,
        errorBody('VALIDATION_FAILED', 400, [
          { path: 'organizationSlug', message: 'Enter the company reference.' },
        ]),
      ),
    );
    render(<LoginForm />);
    await fill();
    const field = await screen.findByLabelText('Company reference');
    expect(field).toHaveFocus();
    fetchSpy.mockResolvedValueOnce(reply(200, { data: USER }));
    await userEvent.type(field, 'acme');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(
      JSON.parse(String((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body))
        .organizationSlug,
    ).toBe('acme');
  });

  it('reports an unreachable service honestly', async () => {
    fetchSpy.mockRejectedValue(new TypeError('network'));
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the SmartPack service',
    );
  });

  it('never stores the password in browser storage or the address', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(reply(401, errorBody('INVALID_CREDENTIALS', 401))),
    );
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<LoginForm />);
    await fill();
    await screen.findByRole('alert');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain('a-password');
    setItem.mockRestore();
  });

  it('shows the expired-session and signed-out notices', () => {
    const { rerender } = render(<LoginForm notice="expired" />);
    expect(screen.getByText('Your session has ended')).toBeInTheDocument();
    rerender(<LoginForm notice="signed-out" />);
    expect(screen.getByText('You have been signed out')).toBeInTheDocument();
  });
});
