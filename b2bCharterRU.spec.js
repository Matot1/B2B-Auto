const path = require('path');
const { test } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { notifyBron } = require('./notify.cjs');
const { SearchTourBronPage } = require('./pages/SearchTourBronPage.js');
const { BronPage } = require('./pages/BronPage.js');

const TOUR = 'Thailand Phuket MOW AZUR';

test.describe('Charter', () => {
  test('бронирование Таиланд чартер', async ({ page, context }) => {
    test.setTimeout(15 * 60 * 1000);

    const search = new SearchTourBronPage(page);
    let currentStep = '';
    let bron = null;

    try {
      await search.goto();
      await search.waitOpened();

      currentStep = 'Авторизация на сайте';
      if (!process.env.LOGIN || !process.env.PASSWORD) {
        throw new Error('LOGIN или PASSWORD пустые. Запусти из GitLabTest или проверь .env рядом со скриптом.');
      }
      await search.login(process.env.LOGIN, process.env.PASSWORD);

      currentStep = 'Выбор города Москва';
      await search.selectCity('Москва');

      currentStep = 'Выбор страны Таиланд';
      await search.selectCountry('Таиланд');

      currentStep = 'Выбор типа перевозки';
      await search.selectFreight('Чартер/блочная перевозка');

      currentStep = 'Выбор тура Thailand Phuket MOW AZUR';
      await search.pickTourExact(TOUR);

      currentStep = 'Прокрутка страницы';
      await search.scrollToDate();

      currentStep = 'Установка даты вылета';
      let selectedCheckin = await search.setCheckin();
      console.log('Выбрана дата вылета:', selectedCheckin);

      currentStep = 'Снятие чек-бокса группировать результаты';
      await search.uncheckGroupResults();

      currentStep = 'Активация чек-бокса Не отображать PROMO';
      await search.checkHidePromo();

      currentStep = 'Активация чек-бокса мгновенное подтверждение';
      await search.checkInstantConfirm();

      currentStep = 'Проверка всех фильтров перед поиском';
      selectedCheckin = await search.ensureCharterFilters(selectedCheckin, TOUR, (name) => {
        currentStep = `Повтор: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Нажатие кнопки Поиск';
      selectedCheckin = await search.searchUntilPrices(selectedCheckin, (name) => {
        currentStep = `Повтор поиска: ${name}`;
        console.log(currentStep);
      });

      currentStep = 'Ожидание результатов поиска';
      await search.expectPriceVisible();

      currentStep = 'Выбор тура по цене';
      const opened = await search.openBron(context);
      bron = await BronPage.resolve(context, opened);
      await bron.waitTourists();

      currentStep = 'Проверка даты тура';
      await bron.assertCheckin(selectedCheckin);

      currentStep = 'Заполнение данных туриста 1';
      await bron.fillTourist(1);

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

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      await notifyBron({ name: 'Tailand', ok: true, orderNumber, claimUrl });
    } catch (err) {
      let pageUrl = 'недоступен';
      try {
        const activePage = bron && bron.page && !bron.page.isClosed() ? bron.page : page;
        if (activePage && !activePage.isClosed()) pageUrl = activePage.url();
      } catch (_) {}
      console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
      await notifyBron({ name: 'Tailand', ok: false, step: currentStep, error: err.message, url: pageUrl });
      throw err;
    }
  });
});
