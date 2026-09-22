const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { notifyBron } = require('./notify.cjs');
const { SearchTourBronPage } = require('./pages/SearchTourBronPage.js');
const { BronCharterPage } = require('./pages/BronCharterPage.js');

const BASE = process.env.BASE_URL_BY || 'https://b2b.fstravel.by';

test.describe('CharterBY', () => {
  test('бронирование Египет чартер Минск', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);
    const search = new SearchTourBronPage(page);
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

      currentStep = 'Выбор города Минск';
      await search.selectCity('Минск');

      currentStep = 'Выбор страны Египет';
      await search.selectCountry('Египет');

      currentStep = 'Прокрутка страницы';
      await search.scrollToDate();

      currentStep = 'Установка даты вылета';
      let selectedCheckin = await search.setCheckin();
      console.log('Выбрана дата вылета:', selectedCheckin);

      currentStep = 'Выбор ночей от';
      await search.pickNightsFrom();

      currentStep = 'Снятие чек-бокса группировать результаты';
      await search.uncheckGroupResults();

      currentStep = 'Проверка всех фильтров перед поиском';
      selectedCheckin = await search.ensureByFilters(selectedCheckin, (name) => {
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
      await bron.fillTouristBy(1);
      currentStep = 'Заполнение данных туриста 2';
      await bron.fillTouristBy(2);

      currentStep = 'Заполнение данных покупателя';
      await bron.fillBuyerBy();

      currentStep = 'Пересчёт стоимости';
      await bron.clickAndWait(bron.calcButton, 'fstravel.by');

      currentStep = 'Бронирование';
      if (bron.page.isClosed()) {
        bron = await BronCharterPage.resolve(context, page);
      }
      const bookBtn = await bron.waitBookEnabled(4);
      await bron.clickAndWait(bookBtn, 'fstravel.by');

      currentStep = 'Подтверждение условий';
      await bron.confirmAgreementIfVisible('fstravel.by');

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaimFlexible();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      currentStep = 'Проверка заявки в ЛК';
      await bron.openClaim(orderNumber, claimUrl);
      await notifyBron({ name: 'CharterBY', ok: true, orderNumber, claimUrl });
    } catch (err) {
      let pageUrl = 'недоступен';
      try {
        const active = bron && bron.page && !bron.page.isClosed() ? bron.page : page;
        if (active && !active.isClosed()) pageUrl = active.url();
      } catch (_) {}
      console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
      await notifyBron({ name: 'CharterBY', ok: false, step: currentStep, error: err.message, url: pageUrl });
      throw err;
    }
  });
});
