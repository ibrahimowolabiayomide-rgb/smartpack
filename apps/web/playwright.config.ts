import { defineConfig, devices } from '@playwright/test';

// Load the API's local test settings (TEST_DATABASE_URL) so `pnpm test:e2e` works without exporting
// anything by hand. Variables already set in the environment (for example in CI) take precedence.
try {
  process.loadEnvFile(new URL('../api/.env.test.local', import.meta.url));
} catch {
  // No local file: rely on the environment.
}

const PORT = 3100;
const API_PORT = 4100;
const baseURL = `http://127.0.0.1:${PORT}`;

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

/**
 * End-to-end smoke tests run against the PRODUCTION build (`next start`), pointed at a real API
 * process and a real PostgreSQL database. Ports differ from the development defaults so a
 * running dev server is never reused by accident.
 *
 * Required: TEST_DATABASE_URL (a dedicated database; see docs/DEVELOPMENT_SETUP.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    {
      name: 'mobile',
      // Pixel 7 is a Chromium device, so one browser install covers both projects.
      use: { ...devices['Pixel 7'], launchOptions },
    },
  ],
  webServer: [
    {
      command: 'node --env-file-if-exists=.env.test.local dist/main.js',
      cwd: '../api',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        LOG_LEVEL: 'silent',
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        DATABASE_SSL: 'disable',
        CORS_ALLOWED_ORIGINS: baseURL,
      },
    },
    {
      command: `pnpm exec next start --port ${PORT} --hostname 127.0.0.1`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        API_URL: `http://127.0.0.1:${API_PORT}/api/v1`,
      },
    },
  ],
});
