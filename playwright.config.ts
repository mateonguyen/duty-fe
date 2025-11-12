import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'dotnet run --project ../Backend/Backend.csproj',
      url: 'http://localhost:5073',
      timeout: 120_000,
      reuseExistingServer: true,
      env: {
        ASPNETCORE_URLS: 'http://localhost:5073',
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
