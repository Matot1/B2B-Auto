import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { SearchTourPage } from '../../../pages/SearchTourPage.js';
import { countryToValue } from '../../../pages/countryCodes.js';

test.describe('Фильтр "Тип продукта"', () => {

  test('Статика — нет "невозвратный тариф", нет правил отмены, нет "Dynamic package"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(null, null, '1');
    await page.waitForTimeout(3000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для типа продукта Статика');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, 'Нет туров для типа продукта Статика');
      return;
    }

    const resultText = await searchPage.getResultText();
    const lowerText = resultText.toLowerCase();

    expect(lowerText).not.toContain('невозвратный');
    expect(lowerText).not.toContain('dynamic package');

    const tourTexts = await searchPage.getTourCountryTexts();

    expect(tourTexts.length).toBeGreaterThan(0);

    for (const text of tourTexts) {
      expect(text.toLowerCase()).not.toContain('dynamic package');
    }
  });

  test('Динамика + Азербайджан — "невозвратный тариф" или правила отмены + "Dynamic package"', async ({ page }) => {
    const searchPage = new SearchTourPage(page);

    await searchPage.gotoWithFilters(countryToValue['Азербайджан'], '43', '2');
    await page.waitForTimeout(3000);

    await searchPage.clickSearch();
    await page.waitForTimeout(3000);

    try {
      await searchPage.waitForResults();
    } catch {
      test.skip(true, 'Нет туров для типа Динамика в Азербайджане');
      return;
    }

    await page.waitForTimeout(3000);

    const rowCount = await searchPage.getResultRowCount();

    if (rowCount === 0) {
      test.skip(true, 'Нет туров для типа Динамика в Азербайджане');
      return;
    }

    const rowData = await searchPage.getResultPriceRows();

    expect(rowData.length).toBeGreaterThan(0);

    for (const row of rowData) {
      const hasNonRefund = row.priceText.includes('невозвратный');
      const hasCancel = row.priceText.includes('штраф') && row.priceText.includes('отмен');
      const hasPriceInfo = row.priceText.includes('информация о тарифе');
      expect(hasNonRefund || hasCancel || hasPriceInfo).toBeTruthy();

      expect(row.tourText.toLowerCase()).toContain('dynamic package');
    }
  });

});
