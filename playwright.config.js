import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  timeout: 240000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'https://b2b.fstravel.com',
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