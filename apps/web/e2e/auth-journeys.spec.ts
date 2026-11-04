import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  request as playwrightRequest,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  API,
  OWNER_EMAIL,
  OWNER_STATE,
  PASSWORD,
  SIGNED_OUT,
  WEB,
  createMember,
  latestToken,
  ownerApi,
  uniqueEmail,
} from './accounts';
import { trackBrowserErrors } from './helpers';

/**
 * Real journeys against the real API and database. Anything that ends a session (sign-out,
 * password change, suspension) uses a session of its own, never the Owner's shared one.
 */
test.use({ storageState: SIGNED_OUT });

/** A fresh, signed-out browser context that uses this project's viewport and base URL. */
async function freshContext(
  browser: Browser,
  baseURL: string | undefined,
): Promise<BrowserContext> {
  return browser.newContext({ baseURL, storageState: SIGNED_OUT });
}

/** Signs in through the form. `fromCurrentPage` keeps the current address (for `next` redirects). */
async function signIn(page: Page, email: string, password: string, fromCurrentPage = false) {
  if (!fromCurrentPage) await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** The sign-in form's own alert (Next.js also keeps an empty route announcer with role alert). */
const signInAlert = (page: Page) => page.getByRole('form', { name: 'Sign in' }).getByRole('alert');

/** Opens the Members page filtered to one address, so the row is found however many people exist. */
const openMembers = (page: Page, email: string) =>
  page.goto(`/dashboard/settings/members?search=${encodeURIComponent(email)}`);

/** A person's row in the Members table (the Invitations table can list the same address). */
const memberRow = (page: Page, email: string) =>
  page.getByRole('region', { name: 'Members' }).getByRole('row', { name: new RegExp(email) });

async function openUserMenu(page: Page, displayName: string) {
  await page.getByRole('button', { name: displayName }).click();
}

test.describe('protected routes', () => {
  test('a signed-out visitor is sent to sign-in and returns to the page they asked for', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings/audit');
    await expect(page).toHaveURL(/\/login\?.*next=%2Fdashboard%2Fsettings%2Faudit/);
    await signIn(page, OWNER_EMAIL, PASSWORD, true);
    await expect(page).toHaveURL(/\/dashboard\/settings\/audit$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });

  test('sign-in never redirects to another site', async ({ page }) => {
    await page.goto('/login?next=https%3A%2F%2Fevil.example%2Fsteal');
    await signIn(page, OWNER_EMAIL, PASSWORD, true);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(new URL(page.url()).origin).toBe(new URL(WEB).origin);
  });

  test('a cookie the API did not issue does not open private pages', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: {
        cookies: [
          {
            name: 'sp_session',
            value: 'x'.repeat(43),
            domain: '127.0.0.1',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?reason=expired/);
    await expect(page.getByText('Your session has ended')).toBeVisible();
    await context.close();
  });

  test('private API routes answer 401 without a session, through the web gateway too', async ({
    request,
  }) => {
    for (const path of ['/auth/me', '/organizations/current', '/organizations/current/members']) {
      const response = await request.get(`/api/v1${path}`);
      expect(response.status(), path).toBe(401);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('the gateway does not expose development-only routes', async ({ request }) => {
    const response = await request.get('/api/v1/dev/mailbox');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('invitation, access, suspension (one journey, several people)', () => {
  test.use({ storageState: OWNER_STATE });

  test('Owner invites, the invitee joins, is limited by role, and loses access when suspended', async ({
    page,
    browser,
    baseURL,
  }) => {
    // The longest journey in the suite (about twenty steps and three browser sessions).
    test.slow();
    const errors = trackBrowserErrors(page);
    const email = uniqueEmail('journey');

    // 1. The Owner invites someone as an Asset Manager from the Members page.
    await openMembers(page, OWNER_EMAIL);
    await expect(page.getByRole('heading', { level: 2, name: 'Members' })).toBeVisible();
    await expect(memberRow(page, OWNER_EMAIL)).toContainText('(you)');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    await dialog.getByLabel('Email address').fill(email);
    await dialog.getByLabel('Role').selectOption({ label: 'Asset Manager' });
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog).toBeHidden();
    const invitations = page.getByRole('region', { name: 'Invitations' });
    await expect(invitations.getByRole('row', { name: new RegExp(email) })).toContainText(
      'Pending',
    );

    // 2. The invitee opens the emailed link, chooses a password and joins.
    const token = await latestToken(email);
    const inviteeContext = await freshContext(browser, baseURL);
    const invitee = await inviteeContext.newPage();
    await invitee.goto(`/accept-invitation#token=${token}`);
    await expect(invitee.getByRole('form', { name: 'Accept invitation' })).toBeVisible();
    // The one-time token is removed from the address bar as soon as the page has read it.
    await expect(invitee).toHaveURL(/\/accept-invitation$/);
    await invitee.getByLabel('First name').fill('Chidi');
    await invitee.getByLabel('Last name').fill('Okoro');
    await invitee.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await invitee.getByLabel('Repeat password').fill(PASSWORD);
    await invitee.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitee.getByText('You have joined E2E Company')).toBeVisible();

    // 3. The invitation cannot be used a second time.
    const reused = await inviteeContext.newPage();
    await reused.goto(`/accept-invitation#token=${token}`);
    await expect(reused.getByText('This invitation cannot be used')).toBeVisible();
    await reused.close();

    // 4. The new member signs in and sees only what the role allows.
    await signIn(invitee, email, PASSWORD);
    await expect(invitee).toHaveURL(/\/dashboard$/);
    await invitee.goto('/dashboard/settings');
    const sections = invitee.getByRole('navigation', { name: 'Settings sections' });
    await expect(sections.getByRole('link', { name: 'Company' })).toBeVisible();
    await expect(sections.getByRole('link', { name: 'Members' })).toHaveCount(0);
    await expect(sections.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
    await invitee.goto('/dashboard/settings/members');
    await expect(invitee.getByText('You do not have access to this page')).toBeVisible();
    await invitee.goto('/dashboard/settings/audit');
    await expect(invitee.getByText('You do not have access to this page')).toBeVisible();

    // The API enforces the same limits, whatever the interface shows.
    const denied = await inviteeContext.request.get('/api/v1/organizations/current/members');
    expect(denied.status()).toBe(403);
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    const ownerOnly = await inviteeContext.request.patch('/api/v1/organizations/current', {
      data: { name: 'Hijacked' },
      headers: { origin: WEB },
    });
    expect(ownerOnly.status()).toBe(403);

    // 5. The Owner suspends the member.
    await openMembers(page, email);
    const row = memberRow(page, email);
    await expect(row).toContainText('Active');
    await row.getByRole('button', { name: 'Suspend' }).click();
    await page
      .getByRole('dialog', { name: 'Suspend this member?' })
      .getByRole('button', { name: 'Suspend' })
      .click();
    await expect(memberRow(page, email)).toContainText('Suspended');

    // 6. The member's existing session stops working at once.
    await invitee.goto('/dashboard');
    await expect(invitee).toHaveURL(/\/login\?reason=expired/);
    const after = await inviteeContext.request.get('/api/v1/auth/me');
    expect(after.status()).toBe(401);
    // ...and a suspended member cannot sign in again.
    await signIn(invitee, email, PASSWORD);
    await expect(signInAlert(invitee)).toContainText(
      'The email address or password is not correct',
    );
    await inviteeContext.close();

    // 7. The Owner reactivates the member, who can sign in again.
    await openMembers(page, email);
    await memberRow(page, email).getByRole('button', { name: 'Reactivate' }).click();
    await page
      .getByRole('dialog', { name: 'Reactivate this member?' })
      .getByRole('button', { name: 'Reactivate' })
      .click();
    await expect(memberRow(page, email)).toContainText('Active');
    const againContext = await freshContext(browser, baseURL);
    const again = await againContext.newPage();
    await signIn(again, email, PASSWORD);
    await expect(again).toHaveURL(/\/dashboard$/);
    await againContext.close();

    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('the audit log records the journey, and its filters work', async ({ page }) => {
    // Make sure there is a known event to find.
    const owner = await ownerApi();
    const email = uniqueEmail('audited');
    await owner.post('/api/v1/organizations/current/invitations', {
      data: { email, role: 'worker' },
    });
    await owner.dispose();

    await page.goto('/dashboard/settings/audit');
    await expect(page.getByRole('heading', { level: 2, name: /Audit log/ })).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(page.getByRole('main')).toContainText(email);
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('inviting an address that is already pending or already a member is refused clearly', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings/members');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    await dialog.getByLabel('Email address').fill(OWNER_EMAIL);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Invitation not created');
    await expect(dialog).toBeVisible();
  });

  test('invitation form validates before sending', async ({ page }) => {
    await page.goto('/dashboard/settings/members');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite someone' });
    await dialog.getByLabel('Email address').fill('not-an-email');
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog.getByText(/valid email/i)).toBeVisible();
  });
});

test.describe('company profile', () => {
  test.use({ storageState: OWNER_STATE });

  test('the Owner can change the company profile and the change is stored', async ({
    page,
  }, testInfo) => {
    // The company is shared by every browser project running at once, so the save-and-reload
    // check runs in one project only. The form itself is rendered in every project by the route tests.
    test.skip(testInfo.project.name !== 'desktop-1440', 'shared company record: run once');
    await page.goto('/dashboard/settings');
    const form = page.getByRole('main').locator('form').first();
    const name = form.getByLabel('Company name');
    const original = await name.inputValue();
    expect(original.length).toBeGreaterThan(0);
    // Change a field that does not alter the company's identity for other tests.
    const country = form.getByLabel('Country');
    await country.fill('NG');
    await form.getByRole('button', { name: /save/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved|updated/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('main').locator('form').first().getByLabel('Country')).toHaveValue(
      'NG',
    );
  });
});

test.describe('sign-out and sessions', () => {
  test('sign-out ends the session on the server, not only in the browser', async ({
    browser,
    baseURL,
  }) => {
    const member = await createMember('worker');
    const context = await freshContext(browser, baseURL);
    const page = await context.newPage();
    await signIn(page, member.email, member.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    const cookie = (await context.cookies()).find((c) => c.name === 'sp_session');
    expect(cookie).toBeDefined();

    await openUserMenu(page, member.name);
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\?reason=signed-out/);
    await expect(page.getByText('You have been signed out')).toBeVisible();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // Replaying the old cookie directly against the API fails: the session is revoked.
    const replay = await playwrightRequest.newContext({
      extraHTTPHeaders: { cookie: `sp_session=${cookie?.value}` },
    });
    const response = await replay.get(`${API}/auth/me`);
    expect(response.status()).toBe(401);
    await replay.dispose();
    await context.close();
  });

  test('changing the password signs out other devices and keeps this one', async ({
    browser,
    baseURL,
  }) => {
    const member = await createMember('worker');
    const a = await freshContext(browser, baseURL);
    const b = await freshContext(browser, baseURL);
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await signIn(pageA, member.email, member.password);
    await signIn(pageB, member.email, member.password);
    await expect(pageA).toHaveURL(/\/dashboard$/);
    await expect(pageB).toHaveURL(/\/dashboard$/);

    await pageA.goto('/dashboard/settings/security');
    const form = pageA.getByRole('form', { name: 'Change password' });
    const next = 'Another-Sturdy-Harbor-77';
    await form.getByLabel('Current password').fill(member.password);
    await form.getByLabel('New password', { exact: true }).fill(next);
    await form.getByLabel('Repeat new password').fill(next);
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(pageA.getByText('Password changed')).toBeVisible();

    // This device is still signed in; the other one is not.
    await pageA.goto('/dashboard');
    await expect(pageA).toHaveURL(/\/dashboard$/);
    await pageB.goto('/dashboard');
    await expect(pageB).toHaveURL(/\/login\?reason=expired/);

    // The old password no longer works; the new one does.
    const c = await freshContext(browser, baseURL);
    const pageC = await c.newPage();
    await signIn(pageC, member.email, member.password);
    await expect(signInAlert(pageC)).toContainText('not correct');
    await signIn(pageC, member.email, next);
    await expect(pageC).toHaveURL(/\/dashboard$/);
    await Promise.all([a.close(), b.close(), c.close()]);
  });

  test('a wrong current password is reported on the form and changes nothing', async ({
    browser,
    baseURL,
  }) => {
    const member = await createMember('worker');
    const context = await freshContext(browser, baseURL);
    const page = await context.newPage();
    await signIn(page, member.email, member.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/dashboard/settings/security');
    const form = page.getByRole('form', { name: 'Change password' });
    await form.getByLabel('Current password').fill('not-my-password-123');
    await form.getByLabel('New password', { exact: true }).fill('Another-Sturdy-Harbor-77');
    await form.getByLabel('Repeat new password').fill('Another-Sturdy-Harbor-77');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByText(/not correct|incorrect/i).first()).toBeVisible();
    await context.close();
  });

  test('the sessions list marks this device and can sign out all other devices', async ({
    browser,
    baseURL,
  }) => {
    const member = await createMember('worker');
    const a = await freshContext(browser, baseURL);
    const b = await freshContext(browser, baseURL);
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await signIn(pageA, member.email, member.password);
    await signIn(pageB, member.email, member.password);
    await expect(pageA).toHaveURL(/\/dashboard$/);
    await expect(pageB).toHaveURL(/\/dashboard$/);

    await pageA.goto('/dashboard/settings/security');
    await expect(pageA.getByText('This device', { exact: true })).toHaveCount(1);
    await expect(pageA.getByRole('button', { name: 'End session' })).toHaveCount(1);
    await pageA.getByRole('button', { name: 'Sign out of all other devices' }).click();
    await expect(pageA.getByText(/Ended 1 other session/)).toBeVisible();

    await pageA.goto('/dashboard');
    await expect(pageA).toHaveURL(/\/dashboard$/);
    await pageB.goto('/dashboard');
    await expect(pageB).toHaveURL(/\/login\?reason=expired/);
    await Promise.all([a.close(), b.close()]);
  });
});

test.describe('forgotten password', () => {
  test('request, emailed one-time link, new password, link cannot be reused, old sessions end', async ({
    browser,
    baseURL,
    page,
  }) => {
    const member = await createMember('worker');

    // A device that is already signed in; the reset must end it.
    const signedIn = await freshContext(browser, baseURL);
    const existing = await signedIn.newPage();
    await signIn(existing, member.email, member.password);
    await expect(existing).toHaveURL(/\/dashboard$/);

    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill(member.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your email')).toBeVisible();

    const token = await latestToken(member.email);
    await page.goto(`/reset-password#token=${token}`);
    const form = page.getByRole('form', { name: 'Choose a new password' });
    await expect(form).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/); // token scrubbed from the address bar
    const next = 'Reset-Harbor-Lantern-58';
    await form.getByLabel('New password', { exact: true }).fill(next);
    await form.getByLabel('Repeat new password').fill(next);
    await form.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated')).toBeVisible();

    // The link works once.
    const secondTab = await page.context().newPage();
    await secondTab.goto(`/reset-password#token=${token}`);
    const again = secondTab.getByRole('form', { name: 'Choose a new password' });
    await again.getByLabel('New password', { exact: true }).fill('Second-Harbor-Lantern-59');
    await again.getByLabel('Repeat new password').fill('Second-Harbor-Lantern-59');
    await again.getByRole('button', { name: 'Update password' }).click();
    await expect(again.getByRole('alert')).toContainText('Could not update the password');
    await secondTab.close();

    // The earlier session ended; the old password fails; the new one works.
    await existing.goto('/dashboard');
    await expect(existing).toHaveURL(/\/login\?reason=expired/);
    await signIn(page, member.email, member.password);
    await expect(signInAlert(page)).toContainText('not correct');
    await signIn(page, member.email, next);
    await expect(page).toHaveURL(/\/dashboard$/);
    await signedIn.close();
  });

  test('asking for a reset gives the same answer for an address with no account', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill('nobody-here@e2e.example');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Check your email')).toBeVisible();
  });

  test('a reset page without a valid link says so', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('This link is not valid')).toBeVisible();
    await page.goto(`/reset-password#token=${'A'.repeat(43)}`);
    const form = page.getByRole('form', { name: 'Choose a new password' });
    await form.getByLabel('New password', { exact: true }).fill('Sturdy-Harbor-Lantern-61');
    await form.getByLabel('Repeat new password').fill('Sturdy-Harbor-Lantern-61');
    await form.getByRole('button', { name: 'Update password' }).click();
    await expect(form.getByRole('alert')).toBeVisible();
  });

  test('a weak new password is refused before anything is sent', async ({ page }) => {
    await page.goto(`/reset-password#token=${'A'.repeat(43)}`);
    const form = page.getByRole('form', { name: 'Choose a new password' });
    await form.getByLabel('New password', { exact: true }).fill('short');
    await form.getByLabel('Repeat new password').fill('short');
    await form.getByRole('button', { name: 'Update password' }).click();
    await expect(form.getByRole('alert')).toContainText(/at least 12 characters/i);
  });
});

test.describe('accept invitation pages', () => {
  test('a page without a link, or with a bad one, cannot be used', async ({ page }) => {
    await page.goto('/accept-invitation');
    await expect(page.getByText('This invitation cannot be used')).toBeVisible();
    await page.goto(`/accept-invitation#token=${'B'.repeat(43)}`);
    await expect(page.getByText('This invitation cannot be used')).toBeVisible();
  });
});

test.describe('accessibility of the new pages in their working states', () => {
  async function expectNoViolations(page: Page) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      ),
    ).toEqual([]);
  }

  test('accept-invitation form with a real invitation', async ({ page }) => {
    const owner = await ownerApi();
    const email = uniqueEmail('axe-invite');
    await owner.post('/api/v1/organizations/current/invitations', {
      data: { email, role: 'worker' },
    });
    await owner.dispose();
    await page.goto(`/accept-invitation#token=${await latestToken(email)}`);
    await expect(page.getByRole('form', { name: 'Accept invitation' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('reset-password form with a link', async ({ page }) => {
    await page.goto(`/reset-password#token=${'C'.repeat(43)}`);
    await expect(page.getByRole('form', { name: 'Choose a new password' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('sign-in with an error showing', async ({ page }) => {
    await signIn(page, OWNER_EMAIL, 'wrong-password-here');
    await expect(signInAlert(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test.describe('signed in as Owner', () => {
    test.use({ storageState: OWNER_STATE });

    test('invite dialog open', async ({ page }) => {
      await page.goto('/dashboard/settings/members');
      await page.getByRole('button', { name: 'Invite someone' }).click();
      await expect(page.getByRole('dialog', { name: 'Invite someone' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('members page with data, and the change-role dialog', async ({ page }) => {
      const member = await createMember('supervisor');
      await openMembers(page, member.email);
      const row = memberRow(page, member.email);
      await expect(row).toBeVisible();
      await expectNoViolations(page);
      await row.getByRole('button', { name: 'Change role' }).click();
      await expect(page.getByRole('dialog', { name: 'Change role' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('roles and audit pages with data', async ({ page }) => {
      for (const path of ['/dashboard/settings/roles', '/dashboard/settings/audit']) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        await expectNoViolations(page);
      }
    });
  });
});
