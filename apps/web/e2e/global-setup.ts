import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { OWNER_EMAIL, OWNER_STATE, PASSWORD, WEB } from './accounts';

/**
 * Signs the Owner in once, through the web gateway, and saves the session cookie for the tests that
 * need a signed-in browser. Tests that end sessions (sign-out, password change, suspension) never
 * use this shared session; they sign in on their own.
 */
export default async function globalSetup() {
  mkdirSync(dirname(OWNER_STATE), { recursive: true });
  const context = await request.newContext({ baseURL: WEB });
  const response = await context.post('/api/v1/auth/login', {
    data: { email: OWNER_EMAIL, password: PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(`E2E owner sign-in failed: ${response.status()} ${await response.text()}`);
  }
  await context.storageState({ path: OWNER_STATE });
  await context.dispose();
}
