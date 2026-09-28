const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { notifyBron } = require('./notify.cjs');
const { HotelSearchPage } = require('./pages/HotelSearchPage.js');
const { BronPage } = require('./pages/BronPage.js');

test.describe('Hotel', () => {
  test('бронирование отель Турция', async ({ page, context }) => {
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

      currentStep = 'Выбор страны Турция';
      await search.selectCountry('Турция');

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
      await search.expectPrice(selectedCheckin);

      currentStep = 'Выбор отеля по цене';
      const opened = await search.openBron(context, selectedCheckin);
      bron = new BronPage(opened);
      await search.core.afterStep(async () => {
        await bron.expectTourCheckin(selectedCheckin);
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

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      currentStep = 'Нажимать "Посмотреть заявку"';
      await bron.openClaimResults(context);

      currentStep = 'Нажимать кнопку "Стоимость и сроки оплаты"';
      await bron.openCostTerms(orderNumber);

      currentStep = 'Смотреть цену "К доплате"';
      await bron.readDuePrice();

      currentStep = 'Перейти к методам оплате';
      await bron.openPayMethods(context);

      currentStep = 'Проверка оплаты Альфой';
      await bron.openAlfaPay();

      currentStep = 'Проверять указанную цену с записанной в шаге "Смотреть цену "К доплате"" и нажимать "оплатить"';
      await bron.confirmAlfaPriceAndPay();

      currentStep = 'Нажать переход на оплату и вернутся назад';
      await bron.openSbpAndBack(context);

      currentStep = 'Переход к оплате спб';
      await bron.openSbpPay();

      currentStep = 'Проверять указанную цену с записанной в шаге "Смотреть цену "К доплате""';
      await bron.confirmTbankPriceAndPay(context);

      currentStep = 'Переход к оплате т-банк';
      await bron.openTbankCardAndCheck();

      currentStep = 'Переход к странице банка и возврат назад';
      await bron.openTbankBankAndBack(context);

      currentStep = 'Переход к оплате сертификатом';
      await bron.openCertificateAndClose();

      currentStep = 'Проверять загрузку счета';
      await bron.downloadInvoice();

      currentStep = 'Оплата по квитанции';
      await bron.openReceiptPay();

      currentStep = 'Проверить цену в поле "сумма для оплаты" и закрыть окно';
      await bron.confirmReceiptPriceAndClose();

      const priceNote = [
        bron.alfaPriceOk && bron.tbankPriceOk && bron.tbankCardPriceOk && bron.receiptPriceOk
          ? 'Цена заявки в способах оплаты совпадает'
          : '',
        'Все варианты оплаты доступны',
      ].filter(Boolean).join('\n');
      await notifyBron({ name: 'Hotel', ok: true, orderNumber, claimUrl, priceNote });
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
