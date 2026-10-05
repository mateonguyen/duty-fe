import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: ['dashboard-proposal.spec.ts', 'home-dashboard.spec.ts'], timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4219', channel: process.env['PLAYWRIGHT_CHANNEL'], viewport: { width: 1440, height: 1100 } },
  webServer: { command: 'node tests/serve-built-app.cjs', url: 'http://127.0.0.1:4219', reuseExistingServer: true },
});
