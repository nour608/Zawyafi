import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 3001 --hostname 127.0.0.1',
    port: 3001,
    reuseExistingServer: true,
  },
})
