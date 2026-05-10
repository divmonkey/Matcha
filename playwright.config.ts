import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 1,
  reporter: [['list'], ['html']], // nice HTML report
  use: {
    baseURL: 'http://localhost:3000', // Next.js dev server
    trace: 'on-first-retry',          // record trace on failure
    video: 'retain-on-failure',       // keep video if test fails
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'WebKit', use: { ...devices['Desktop Safari'] } },
  ],
});
