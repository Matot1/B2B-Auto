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

      currentStep = 'Закрыть вкладку pay_variant';
      await bron.closePayVariantTab();

      currentStep = 'Вставить номер заявки и нажать искать';
      await bron.searchClaim(orderNumber);

      currentStep = 'Перейти к окну с документами';
      await bron.openClaimDocuments(orderNumber);

      currentStep = 'Скачивание документов';
      await bron.downloadAllPrints();

      currentStep = 'Выбор всех файлов чек-боксами';
      await bron.selectAllDocuments();

      currentStep = 'скачивание одним файлом';
      await bron.downloadAllInOneFile();

      const priceNote = [
        bron.alfaPriceOk && bron.tbankPriceOk && bron.tbankCardPriceOk && bron.receiptPriceOk
          ? 'Цена заявки в способах оплаты совпадает'
          : '',
        'Все варианты оплаты доступны',
        `Все доступные документы загружены: ${bron.printDownloaded}/${bron.printClicked}`,
        bron.multiDownloadOk ? 'Мультизагрузка успешна' : '',
      ].filter(Boolean).join('\n');
      await notifyBron({ name: 'Tailand', ok: true, orderNumber, claimUrl, priceNote });
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
