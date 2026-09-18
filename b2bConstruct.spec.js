const path = require('path');
const { test } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { runConstruct } = require('./pages/ConstructPage.js');

test.describe('Construct', () => {
  test('конструктор Египет гостиница и транспорт', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);
    if (!process.env.LOGIN || !process.env.PASSWORD) {
      throw new Error('LOGIN или PASSWORD пустые. Проверь .env рядом со скриптом.');
    }
    await runConstruct(page);
  });
});
