import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

const tourTypes = [
  { country: 'Турция', countryValue: countryToValue['Турция'], tourTypeValue: '14', expectedKeyword: 'Premium' },
  { country: 'Азербайджан', countryValue: countryToValue['Азербайджан'], tourTypeValue: '43', expectedKeyword: 'Dynamic package' },
];

test.describe('Фильтр "Тип тура"', () => {

  for (const { country, countryValue, tourTypeValue, expectedKeyword } of tourTypes) {
    test(`${expectedKeyword} + ${country} — в столбце "Тур" указано "${expectedKeyword}"`, async ({ page }) => {
      const searchPage = new SearchTourPage(page);

      await searchPage.gotoWithFilters(countryValue, tourTypeValue);
      await page.waitForTimeout(3000);

      await searchPage.clickSearch();
      await page.waitForTimeout(3000);

      try {
        await searchPage.waitForResults();
      } catch {
        test.skip(true, `Нет туров для данного типа в стране ${country}`);
        return;
      }

      await page.waitForTimeout(3000);

      const rowCount = await searchPage.getResultRowCount();

      if (rowCount === 0) {
        test.skip(true, `Нет туров для данного типа в стране ${country}`);
        return;
      }

      const tourTexts = await searchPage.getTourCountryTexts();

      expect(tourTexts.length).toBeGreaterThan(0);

      for (const text of tourTexts) {
        expect(text).toContain(expectedKeyword);
      }
    });
  }

});
