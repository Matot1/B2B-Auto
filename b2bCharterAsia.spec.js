const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { notifyBron } = require('./notify.cjs');
const { SearchTourBronPage } = require('./pages/SearchTourBronPage.js');
const { BronCharterPage } = require('./pages/BronCharterPage.js');

const BASE = process.env.BASE_URL_ASIA || 'https://b2b.fstravel.asia';

test.describe('CharterAsia', () => {
  test('бронирование Египет чартер Астана', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);
    const search = new SearchTourBronPage(page);
    search.tourGroup = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(1) > td.tour_right');
    let currentStep = '';
    let bron = null;

    try {
      currentStep = 'Открытие search_tour';
      await search.gotoAt(BASE);
      await search.waitLoginVisible();

      currentStep = 'Авторизация на сайте';
      if (!process.env.LOGIN || !process.env.PASSWORD) {
        throw new Error('LOGIN или PASSWORD пустые. Проверь .env рядом со скриптом.');
      }
      await search.login(process.env.LOGIN, process.env.PASSWORD);

      currentStep = 'Выбор города Астана';
      await search.selectCity('Астана');

      currentStep = 'Выбор страны Египет';
      await search.pickCountryRetry(search.country, 'Египет');
      await search.afterStep(async () => {
        await search.assertChosenFilled(search.country, 'Египет');
      });

      currentStep = 'Выбор группы тура';
      await search.pickFilter(search.tourGroup, 'Чартер/блочная перевозка');
      await search.afterStep(async () => {
        await search.assertChosenFilled(search.tourGroup, 'Чартер/блочная перевозка');
      });

      currentStep = 'Прокрутка страницы';
      await search.scrollToDate();

      currentStep = 'Установка даты вылета';
      let selectedCheckin = await search.setCheckin();
      console.log('Выбрана дата вылета:', selectedCheckin);

      currentStep = 'Снятие чек-бокса группировать результаты';
      await search.uncheckGroupResults();

      currentStep = 'Проверка всех фильтров перед поиском';
      selectedCheckin = await search.ensureAsiaFilters(selectedCheckin, search.tourGroup, (name) => {
        currentStep = `Повтор: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Нажатие кнопки Искать';
      selectedCheckin = await search.searchUntilPrices(selectedCheckin, (name) => {
        currentStep = `Повтор поиска: ${name}`;
        console.log(currentStep);
      });
      await expect(search.price).toBeVisible({ timeout: 5000 });

      currentStep = 'Выбор тура по цене';
      const opened = await search.openBronOrSameTab(context);
      bron = await BronCharterPage.resolve(context, opened);
      await bron.waitTourists();

      currentStep = 'Проверка даты тура';
      await bron.assertCheckin(selectedCheckin);

      currentStep = 'Заполнение данных туриста 1';
      await bron.fillTouristAsia(1);
      currentStep = 'Заполнение данных туриста 2';
      await bron.fillTouristAsia(2);

      currentStep = 'Пересчёт стоимости';
      const bookBtn = bron.page.locator('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(6) > td > button.bron');
      await bron.clickAndWait(bron.page.locator('button.calc:has-text("Пересчитать")'), 'fstravel.asia');

      currentStep = 'Бронирование';
      await bookBtn.waitFor({ state: 'visible', timeout: 60000 });
      await bron.page.waitForFunction(() => {
        const btn = document.querySelector('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(6) > td > button.bron');
        return btn && !btn.disabled;
      }, { timeout: 60000 });
      await bron.clickAndWait(bookBtn, 'fstravel.asia');

      currentStep = 'Подтверждение условий';
      await bron.confirmAgreement('fstravel.asia');

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      currentStep = 'Проверка заявки в ЛК';
      await bron.openClaim(orderNumber, claimUrl);
      await notifyBron({ name: 'CharterAsia', ok: true, orderNumber, claimUrl });
    } catch (err) {
      let pageUrl = 'недоступен';
      try {
        const active = bron && bron.page && !bron.page.isClosed() ? bron.page : page;
        if (active && !active.isClosed()) pageUrl = active.url();
      } catch (_) {}
      console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
      await notifyBron({ name: 'CharterAsia', ok: false, step: currentStep, error: err.message, url: pageUrl });
      throw err;
    }
  });
});
