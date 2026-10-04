import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A gate that needs retries to pass is a broken gate: fix the test, don't hide the flakiness.
  retries: 0,
  // The checks wait on the network, not the CPU, so more workers than cores is fine.
  workers: 4,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    // The site under test: a Netlify Deploy Preview in CI, production on the nightly run, or local dev.
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
