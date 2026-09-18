const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { setAvailableDate } = require('./object/zebraDatePicker.cjs');
const { notifyBron } = require('./notify.cjs');
const { SearchTourBronPage } = require('./pages/SearchTourBronPage.js');
const { BronPage } = require('./pages/BronPage.js');

const TOUR = 'Turkey Antalya MOW GDS*';

test.describe('GDS', () => {
  test('бронирование Турция GDS', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);
    const search = new SearchTourBronPage(page);
    let currentStep = '';
    let bron = null;

    try {
      currentStep = 'Открытие search_tour';
      await search.goto();
      await search.waitLoginVisible();

      currentStep = 'Авторизация на сайте';
      if (!process.env.LOGIN || !process.env.PASSWORD) {
        throw new Error('LOGIN или PASSWORD пустые. Проверь .env рядом со скриптом.');
      }
      await search.login(process.env.LOGIN, process.env.PASSWORD);

      currentStep = 'Выбор города Москва';
      await search.selectCity('Москва');

      currentStep = 'Выбор страны Турция';
      await search.selectCountry('Турция');

      currentStep = 'Выбор типа перевозки GDS';
      await search.selectFreight('GDS');

      currentStep = 'Выбор тура Turkey Antalya MOW GDS*';
      await search.pickTourExact(TOUR);
      await search.afterStep(async () => {
        await search.assertChosenFilled(search.tour, TOUR);
      });

      currentStep = 'Прокрутка страницы';
      await search.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await search.afterStep(async () => {
        await expect(search.adults).toBeVisible();
      });

      currentStep = 'Установка даты вылета';
      let selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG');
      console.log('Выбрана дата вылета:', selectedCheckin);
      await search.afterStep(async () => {
        await expect(search.checkin).toHaveValue(selectedCheckin);
      });

      currentStep = 'Выбор количества взрослых: 1';
      await search.pickAdults('1');
      await search.afterStep(async () => {
        await expect(page.locator('select[name="ADULT"]')).toHaveValue('1');
        await expect(search.chosenTrigger(search.adults)).toHaveText('1');
      });

      currentStep = 'Снятие чек-бокса группировать результаты';
      await search.uncheckGroupResults();

      currentStep = 'Активация чек-бокса Не отображать PROMO';
      await search.checkHidePromo();

      currentStep = 'Проверка всех фильтров перед поиском';
      selectedCheckin = await search.ensureGdsFilters(selectedCheckin, TOUR, (name) => {
        currentStep = `Повтор: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Нажатие кнопки Поиск';
      selectedCheckin = await search.searchUntilPricesGds(selectedCheckin, (name) => {
        currentStep = `Повтор поиска: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Ожидание результатов поиска';
      await search.expectPriceVisible();

      currentStep = 'Выбор тура по цене';
      const opened = await search.openBron(context);
      bron = new BronPage(opened);
      await bron.page.waitForTimeout(5000);

      currentStep = 'Проверка даты тура';
      await bron.assertCheckin(selectedCheckin);

      currentStep = 'Выбор рейса';
      await bron.selectFlight();

      currentStep = 'Заполнение данных туриста 1';
      await bron.fillTourist(1);

      currentStep = 'Отметка заказчика тура для туриста 1';
      await bron.markCustomer(1);

      currentStep = 'Заполнение данных покупателя';
      await bron.fillBuyer();

      currentStep = 'Пересчёт стоимости';
      await bron.recalc();

      currentStep = 'Бронирование';
      await bron.book();

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      currentStep = 'Проверка заявки в ЛК';
      await bron.openClaim(orderNumber, claimUrl);
      await notifyBron({ name: 'GDS', ok: true, orderNumber, claimUrl });
    } catch (err) {
      let pageUrl = 'недоступен';
      try {
        const active = bron && bron.page && !bron.page.isClosed() ? bron.page : page;
        if (active && !active.isClosed()) pageUrl = active.url();
      } catch (_) {}
      console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
      await notifyBron({ name: 'GDS', ok: false, step: currentStep, error: err.message, url: pageUrl });
      throw err;
    }
  });
});
