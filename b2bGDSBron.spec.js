const path = require('path');
const { test, expect } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '.env') });
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
      let selectedCheckin = await search.setCheckinGds();
      console.log('Выбрана дата вылета:', selectedCheckin);

      currentStep = 'Выбор количества взрослых: 1';
      await search.pickAdults('1');
      await search.afterStep(async () => {
        await expect(search.adultSelect).toHaveValue('1');
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

      currentStep = 'Нажимать "Посмотреть заявку"';
      await bron.openClaimResults(context);

      currentStep = 'Ждать 1 минуту и обновить заявку';
      await bron.waitMinuteAndReloadClaim();

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
      await notifyBron({ name: 'GDS', ok: true, orderNumber, claimUrl, priceNote });
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
