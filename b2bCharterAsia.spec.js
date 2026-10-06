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
      await bron.clickAndWait(bron.calcButton, 'fstravel.asia');

      currentStep = 'Бронирование';
      const bookBtn = await bron.waitBookEnabled(6);
      await bron.clickAndWait(bookBtn, 'fstravel.asia');

      currentStep = 'Подтверждение условий';
      await bron.confirmAgreement('fstravel.asia');

      currentStep = 'Ожидание номера заявки';
      const { orderNumber, claimUrl } = await bron.waitClaim();
      console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

      currentStep = 'Проверка заявки в ЛК';
      await bron.openClaim(orderNumber, claimUrl);

      currentStep = 'Нажимать кнопку "Стоимость и сроки оплаты"';
      await bron.openCostTerms(orderNumber);

      currentStep = 'Перейти к методам оплате';
      await bron.openPayMethods(context);

      currentStep = 'Проверять загрузку счета';
      await bron.downloadInvoice();

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
        `Все доступные документы загружены: ${bron.printDownloaded}/${bron.printClicked}`,
        bron.multiDownloadOk ? 'Мультизагрузка успешна' : '',
      ].filter(Boolean).join('\n');
      await notifyBron({ name: 'CharterAsia', ok: true, orderNumber, claimUrl, priceNote });
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
