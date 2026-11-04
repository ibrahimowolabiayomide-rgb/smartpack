import { defineConfig, devices } from '@playwright/test';
import { ORG_NAME, OWNER_EMAIL, PASSWORD } from './e2e/accounts';
import { PORTS, baseUrlFor } from './e2e/ports';

// Load the API's local test settings (TEST_DATABASE_URL) so `pnpm test:e2e` works without exporting
// anything by hand. Variables already set in the environment (for example in CI) take precedence.
try {
  process.loadEnvFile(new URL('../api/.env.test.local', import.meta.url));
} catch {
  // No local file: rely on the environment.
}

const WEB_PORT = PORTS.web;
const API_PORT = PORTS.api;
const API_DB_DOWN_PORT = PORTS.apiDbDown;
const CLOSED_PORT = PORTS.closed;

const baseURL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * Optional override for machines where Playwright cannot download its own browser (for example a
 * network that blocks the download host). Normal setups leave it unset and use the browser that
 * `pnpm exec playwright install chromium` provides.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const launchOptions = {
  executablePath,
  // Needed only for the sandbox-less container case that uses the override above.
  args: executablePath ? ['--no-sandbox'] : [],
};

const phone = devices['Pixel 7'];

/**
 * End-to-end tests run against the PRODUCTION build (`next start`), pointed at real API processes
 * and a real PostgreSQL database. Ports differ from the development defaults so a running dev
 * server is never reused by accident.
 *
 * Required: TEST_DATABASE_URL (a dedicated database; see docs/DEVELOPMENT_SETUP.md).
 *
 * Five viewport projects are defined. `pnpm test:e2e` runs the quick set (desktop-1440 and
 * mobile-390: one wide layout with the sidebar, one narrow layout with the drawer);
 * `pnpm test:e2e:full` runs all five. All are Chromium: they test responsive layout, not other
 * browser engines or physical devices.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Generous time budgets. The suite runs real journeys (sign-in, invitations, password changes)
  // against production builds, and a slow or busy machine can take two to three times longer than
  // the machine it was written on; with the defaults (30 s a test, 5 s an assertion) the longest
  // journey and the first sign-ins timed out on such a machine although nothing was wrong. These
  // limits only decide how long to wait: every assertion is unchanged.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Locally: one dot per test and a full report only for failures. Use `--reporter=list` to see every test.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['dot']],
  use: { baseURL, trace: 'retain-on-failure', launchOptions },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'laptop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions },
    },
    {
      name: 'tablet-768',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        launchOptions,
      },
    },
    {
      name: 'mobile-390',
      use: { ...phone, viewport: { width: 390, height: 844 }, launchOptions },
    },
    {
      name: 'mobile-360',
      use: { ...phone, viewport: { width: 360, height: 740 }, launchOptions },
    },
  ],
  webServer: [
    {
      // The real API on a database rebuilt from nothing (see e2e/serve-api.mjs), with the first
      // company and Owner created by the real bootstrap command. Mail goes to the in-memory
      // development mailbox, which is how the invitation and reset links are read.
      command: 'node --env-file-if-exists=.env.test.local ../web/e2e/serve-api.mjs',
      cwd: '../api',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        LOG_LEVEL: 'silent',
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        CORS_ALLOWED_ORIGINS: `${baseURL},${baseUrlFor(PORTS.webBranded)}`,
        WEB_APP_URL: baseURL,
        EMAIL_PROVIDER: 'dev-capture',
        // Rate limits are verified by the API integration tests; every browser test here shares
        // one client address, so leaving them on would make unrelated tests fail.
        RATE_LIMIT_DISABLED: 'true',
        E2E_ORG_NAME: ORG_NAME,
        E2E_OWNER_EMAIL: OWNER_EMAIL,
        E2E_OWNER_PASSWORD: PASSWORD,
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 3000 },
    },
    {
      // A real API whose database is unreachable: it must answer 503 with a report.
      command: 'node dist/main.js',
      cwd: '../api',
      // Playwright's URL probe treats 503 as "not ready", so wait for the port instead.
      port: API_DB_DOWN_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_DB_DOWN_PORT),
        LOG_LEVEL: 'silent',
        DATABASE_URL: `postgresql://nobody:nothing@127.0.0.1:${CLOSED_PORT}/none`,
        DATABASE_SSL: 'disable',
        DATABASE_CONNECTION_TIMEOUT_MS: '1000',
      },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 2000 },
    },
    web(PORTS.web, { API_URL: `http://127.0.0.1:${API_PORT}/api/v1` }),
    web(PORTS.webApiDown, { API_URL: `http://127.0.0.1:${CLOSED_PORT}/api/v1` }),
    web(PORTS.webUnconfigured, { API_URL: '' }),
    web(PORTS.webDbDown, { API_URL: `http://127.0.0.1:${API_DB_DOWN_PORT}/api/v1` }),
    web(PORTS.webBranded, {
      API_URL: `http://127.0.0.1:${API_PORT}/api/v1`,
      BRAND_COMPANY_NAME: 'Example Manufacturing Ltd',
      BRAND_LOGO_URL: '/icons/icon-192.png',
      BRAND_ACCENT_COLOR: '#1d4f91',
    }),
    // Every value is invalid (an over-long name, a non-https logo, an accent that fails contrast),
    // so Settings must name each variable in a warning and fall back to the defaults.
    web(PORTS.webBrandInvalid, {
      API_URL: `http://127.0.0.1:${API_PORT}/api/v1`,
      BRAND_COMPANY_NAME: 'N'.repeat(120),
      BRAND_LOGO_URL: 'http://insecure.example/logo.png',
      BRAND_ACCENT_COLOR: '#f2e600',
    }),
  ],
});

function web(port: number, env: Record<string, string>) {
  return {
    command: `pnpm exec next start --port ${port} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...env },
  };
}
