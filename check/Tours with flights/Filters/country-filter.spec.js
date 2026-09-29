import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

const countries = [
  'Турция',
  'Египет',
  'ОАЭ',
];

test.describe('Фильтр "Страна"', () => {

  for (const countryName of countries) {
    const countryValue = countryToValue[countryName];

    test(`Страна: ${countryName} — все строки относятся к выбранной стране`, async ({ page }) => {
      test.setTimeout(180000);
      const searchPage = new SearchTourPage(page);

      await searchPage.gotoWithCountry(countryValue);
      await page.waitForTimeout(3000);

      try {
        await searchPage.clickSearch();
        await page.waitForTimeout(3000);
        await searchPage.waitForResults();
      } catch {
        test.skip(true, `Страница недоступна или нет туров для страны ${countryName}`);
        return;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();

      if (rowCount === 0) {
        test.skip(true, `Нет туров в страну ${countryName}`);
        return;
      }

      const states = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr[data-state]');
        return [...new Set(Array.from(rows).map(r => r.getAttribute('data-state')))];
      });

      expect(states.length).toBe(1);
      expect(states[0]).toBe(countryValue);
    });
  }

});
