const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { notifyBron } = require('./notify.cjs');
const { HotelSearchPage } = require('./pages/HotelSearchPage.js');
const { BronPage } = require('./pages/BronPage.js');

test.describe('Hotel', () => {
  test('бронирование отель Таиланд', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);
    const search = new HotelSearchPage(page);
    let currentStep = '';
    let bron = null;

    try {
      currentStep = 'Открытие search_hotel';
      await search.goto();
      await search.waitOpened();

      currentStep = 'Авторизация на сайте';
      if (!process.env.LOGIN || !process.env.PASSWORD) {
        throw new Error('LOGIN или PASSWORD пустые. Проверь .env рядом со скриптом.');
      }
      await search.login(process.env.LOGIN, process.env.PASSWORD);

      currentStep = 'Выбор страны Таиланд';
      await search.selectCountry('Таиланд');

      currentStep = 'Выбор типа продукта Статика';
      await search.selectProduct('Статика');

      currentStep = 'Выбор программы Стандарт';
      await search.selectProgram('Стандарт');

      currentStep = 'Установка даты заезда';
      let selectedCheckin = await search.setCheckin();
      console.log('Выбрана дата заезда:', selectedCheckin);

      currentStep = 'Выбор количества взрослых';
      await search.selectAdults2();

      currentStep = 'Снятие чек-бокса группировать результаты';
      await search.uncheckGroupResults();

      currentStep = 'Проверка всех фильтров перед поиском';
      selectedCheckin = await search.ensureHotelFilters(selectedCheckin, (name) => {
        currentStep = `Повтор: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Нажатие кнопки Поиск';
      selectedCheckin = await search.searchUntilTable(selectedCheckin, (name) => {
        currentStep = `Повтор поиска: ${name}`;
        console.log(currentStep);
      });
      await search.expectPrice();

      currentStep = 'Выбор отеля по цене';
      const opened = await search.openBron(context);
      bron = new BronPage(opened);
      await search.core.afterStep(async () => {
        await expect(bron.page.locator('table.tour_info.res')).toBeVisible({ timeout: 30000 });
        await expect(bron.page.locator('table.tour_info.res')).toHaveAttribute('data-checkin', selectedCheckin);
      });

      currentStep = 'Заполнение данных туриста 1';
      await bron.fillTourist(1);
      await search.core.afterStep(async () => {
        await expect(bron.touristField(1, 'LASTNAME_LNAME')).not.toBeEmpty();
      });

      currentStep = 'Заполнение данных туриста 2';
      await bron.fillTourist(2);

      currentStep = 'Отметка заказчика тура для туриста 2';
      await bron.markCustomer(2);

      currentStep = 'Заполнение данных покупателя';
      await bron.fillBuyer();

      currentStep = 'Пересчёт стоимости';
      await bron.recalc();

      currentStep = 'Бронирование';
      await bron.book();
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);
      await notifyBron({ name: 'Hotel', ok: true, orderNumber, claimUrl });
    } catch (err) {
      let pageUrl = 'недоступен';
      try {
        const active = bron && bron.page && !bron.page.isClosed() ? bron.page : page;
        if (active && !active.isClosed()) pageUrl = active.url();
      } catch (_) {}
      console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
      await notifyBron({ name: 'Hotel', ok: false, step: currentStep, error: err.message, url: pageUrl });
      throw err;
    }
  });
});
