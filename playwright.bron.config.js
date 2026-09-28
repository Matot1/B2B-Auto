import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: '.',
  testMatch: 'b2b*.spec.js',
  timeout: 15 * 60 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'https://b2b.fstravel.com',
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    screenshot: 'only-on-failure',
    headless: process.env.HEADED !== '1',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
