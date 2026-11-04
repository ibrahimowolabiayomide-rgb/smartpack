import { fileURLToPath } from 'node:url';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { PORTS, baseUrlFor } from './ports';

/** The company and Owner created by the real bootstrap command before the tests run. */
export const ORG_NAME = 'E2E Company';
export const OWNER_EMAIL = 'owner@e2e.example';
/** Not a secret: it protects a throwaway database that is rebuilt on every run. */
export const PASSWORD = 'Sturdy-Lantern-Harbor-42';

export const OWNER_STATE = fileURLToPath(new URL('./.auth/owner.json', import.meta.url));
export const SIGNED_OUT = { cookies: [], origins: [] };

/**
 * A browser that has a session cookie the API has never issued. Used where the point is how the
 * web application behaves when the API cannot answer the question "who is this?": it must say the
 * service is unavailable rather than treating the person as signed out or showing private pages.
 */
export const UNVERIFIED_SESSION = {
  cookies: [
    {
      name: 'sp_session',
      // Well-formed (43 URL-safe characters) so the API really has to look it up.
      value: 'x'.repeat(43),
      domain: '127.0.0.1',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ],
  origins: [],
};

export const WEB = baseUrlFor(PORTS.web);
export const API = `${baseUrlFor(PORTS.api)}/api/v1`;

let counter = 0;
export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(counter += 1)}@e2e.example`;

/** An API client signed in as the Owner (through the web gateway, exactly like the browser). */
export async function ownerApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: WEB,
    storageState: OWNER_STATE,
    extraHTTPHeaders: { origin: WEB },
  });
}

/** The newest one-time token emailed to `to`, read from the development mailbox. */
export async function latestToken(to: string): Promise<string> {
  const mailbox = await playwrightRequest.newContext();
  try {
    const response = await mailbox.get(`${API}/dev/mailbox`);
    const body = (await response.json()) as {
      data: { messages: Array<{ to: string; text: string }> };
    };
    const message = body.data.messages.find((m) => m.to.toLowerCase() === to.toLowerCase());
    const token = message?.text.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];
    if (!token) throw new Error(`No emailed token for ${to}`);
    return token;
  } finally {
    await mailbox.dispose();
  }
}

/** Invites someone as `role` and accepts the invitation; returns their credentials. */
export async function createMember(role: string, firstName = 'Tunde') {
  const owner = await ownerApi();
  try {
    const email = uniqueEmail(role);
    const invite = await owner.post('/api/v1/organizations/current/invitations', {
      data: { email, role },
    });
    if (!invite.ok()) throw new Error(`invite failed: ${invite.status()} ${await invite.text()}`);
    const token = await latestToken(email);
    const accept = await owner.post('/api/v1/invitations/accept', {
      data: { token, accountExists: false, firstName, lastName: 'Bello', password: PASSWORD },
    });
    if (!accept.ok()) throw new Error(`accept failed: ${accept.status()} ${await accept.text()}`);
    return { email, password: PASSWORD, name: `${firstName} Bello` };
  } finally {
    await owner.dispose();
  }
}
