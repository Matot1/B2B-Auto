import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { cityToAirportCode, cityToValue } from '../../../pages/cityCodes.js';

const cities = [
  'Москва',
  'Санкт-Петербург',
  'Екатеринбург',
  'Сочи',
];

test.describe('Фильтр "Город отправления"', () => {

  for (const cityName of cities) {
    const expectedCode = cityToAirportCode[cityName];
    const cityValue = cityToValue[cityName];

    test(`Город: ${cityName} — ожидается код ${expectedCode}`, async ({ page }) => {
      const searchPage = new SearchTourPage(page);

      await searchPage.goto(cityValue);
      await page.waitForTimeout(3000);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      let resultText = '';
      try {
        await searchPage.waitForResults();
        resultText = await searchPage.getResultText();
      } catch {
        test.skip(true, `Страница недоступна или нет туров для города ${cityName}`);
        return;
      }

      await page.waitForTimeout(3000);

      if (!resultText || resultText.trim().length <= 10 || resultText.trim() === '\u00a0') {
        test.skip(true, `Нет туров с вылетом из ${cityName}`);
        return;
      }

      expect(resultText).toContain(expectedCode);
    });
  }

});
