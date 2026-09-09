const { chromium } = require('playwright');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config();
const { setDate: setZebraDate, setAvailableDate } = require('./object/zebraDatePicker.cjs');

async function fillTourist(page, index) {
  const prefix = `#tourist${index}`;

  await page.locator(prefix).waitFor({ state: 'attached', timeout: 60000 });
  await page.locator(prefix).scrollIntoViewIfNeeded();

  // Select gender - Жен. (точно 4 дефиса, не "------")
  await page.locator(`${prefix} .chosen-single`).filter({ hasText: /^----$/ }).click();
  await page.waitForTimeout(300);
  await page.locator(`${prefix} .active-result[data-option-array-index="1"]`).click();
  await page.waitForTimeout(300);

  // Generate random surname and fill
  await page.locator(`input[name="frm[People][${index}][LASTNAME_LNAME]"]`).fill(faker.person.lastName().toUpperCase());
  await page.waitForTimeout(200);

  // Generate random name and fill
  await page.locator(`input[name="frm[People][${index}][FIRSTNAME_LNAME]"]`).fill(faker.person.firstName().toUpperCase());
  await page.waitForTimeout(200);

  // Fill date of birth
  await setZebraDate(page, `frm[People][${index}][BORN]`, '01.01.2000');

  // Fill phone
  await page.locator(`input[name="frm[People][${index}][PHONE]"]`).fill('79881929122');
  await page.waitForTimeout(200);

  // Fill email
  await page.locator(`input[name="frm[People][${index}][EMAIL]"]`).fill('test33@mail.ru');
  await page.waitForTimeout(200);

  // Select document type - Заграничный паспорт
  await page.locator(`${prefix} a.chosen-single:has-text("Паспорт")`).click();
  await page.waitForTimeout(300);
  await page.locator(`${prefix} .chosen-results .active-result:has-text("Заграничный паспорт")`).click();
  await page.waitForTimeout(200);

  // Fill document series
  await page.locator(`input[name="frm[People][${index}][PSERIE]"]`).fill(faker.string.numeric(2));
  await page.waitForTimeout(200);

  // Fill document number
  await page.locator(`input[name="frm[People][${index}][PNUMBER]"]`).fill(faker.string.numeric(7));
  await page.waitForTimeout(200);

  // Fill passport valid until date
  await setZebraDate(page, `frm[People][${index}][PVALID]`, '01.01.2031');
}

async function resolveBronPage(context, page) {
  for (let i = 0; i < 60; i++) {
    for (const p of context.pages()) {
      if (!p.isClosed() && p.url().includes('/bron')) {
        await p.waitForLoadState('domcontentloaded').catch(() => {});
        return p;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!page.isClosed() && page.url().includes('/bron')) {
    return page;
  }

  throw new Error('Страница /bron не открылась после выбора цены');
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();
  let currentStep = '';
  let targetPage = page;

  try {

  await page.goto('https://b2b.fstravel.com/search_tour', { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for page to fully load
  await page.waitForTimeout(3000);

  // Click "Вход" and login
  currentStep = 'Авторизация на сайте';
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.waitForTimeout(3000);
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForTimeout(3000);

  // Select city "Москва"
  currentStep = 'Выбор города Москва';
  await page.locator('.TOWNFROMINC_chosen .chosen-single').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.TOWNFROMINC_chosen .active-result:has-text("Москва")').click({ force: true });
  await page.keyboard.press('Escape');
  await page.locator('.TOWNFROMINC_chosen').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  currentStep = 'Выбор страны Вьетнам';
  await page.locator('.STATEINC_chosen .chosen-single').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.STATEINC_chosen .active-result:has-text("Вьетнам")').click({ force: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  currentStep = 'Выбор типа продукта Статика';
  const productType = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr.producttype_filter > td.tour_right > div');
  await productType.waitFor({ state: 'visible', timeout: 30000 });
  await productType.locator('a.chosen-single').first().click({ force: true });
  await page.waitForTimeout(400);
  const staticOption = productType.locator('li.active-result').filter({ hasText: 'Статика' }).first();
  await staticOption.waitFor({ state: 'visible', timeout: 15000 });
  await staticOption.click({ force: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  currentStep = 'Выбор типа перевозки';
  await page.locator('.FREIGHTTYPE_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.FREIGHTTYPE_chosen .active-result:has-text("Чартер/блочная перевозка")').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  currentStep = 'Выбор тура Vietnam MOW-CXR AZUR new';
  await page.locator('.TOURINC_chosen .chosen-single').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('.TOURINC_chosen .chosen-single').click();
  await page.waitForTimeout(500);
  const tourSearch = page.locator('.TOURINC_chosen .chosen-search input');
  if (await tourSearch.count()) {
    const editable = await tourSearch.first().isEditable().catch(() => false);
    if (editable) {
      await tourSearch.first().fill('Vietnam MOW-CXR AZUR new');
      await page.waitForTimeout(400);
    }
  }
  const tourOption = page.locator('.TOURINC_chosen .active-result', { hasText: 'Vietnam MOW-CXR AZUR new' });
  await tourOption.first().waitFor({ state: 'visible', timeout: 15000 });
  await tourOption.first().click({ force: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Scroll to the bottom of the page
  currentStep = 'Прокрутка страницы';
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Set "Вылет От" to the first green calendar date with tours (yesplace), after 4 months
  currentStep = 'Установка даты вылета';
  const selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG', 'yesplace');
  console.log('Выбрана дата вылета:', selectedCheckin);

  currentStep = 'Выбор ночей от';
  const nightsFrom = page.locator('#search_tour > div.std.container > table.user_info > tbody > tr > td:nth-child(1) > table > tbody > tr.paramsFrom > td.nights > div');
  await nightsFrom.waitFor({ state: 'visible', timeout: 30000 });
  await nightsFrom.locator('a.chosen-single').first().click({ force: true });
  await page.waitForTimeout(400);
  const nightsItems = nightsFrom.locator('li.active-result');
  await nightsItems.first().waitFor({ state: 'visible', timeout: 15000 });
  const nightsCount = await nightsItems.count();
  const nightsOptions = [];
  for (let i = 0; i < nightsCount; i++) {
    const text = (await nightsItems.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    if (text && !/^[-—–]+$/.test(text)) {
      nightsOptions.push({ i, text });
    }
  }
  const nightsPick = nightsOptions[2] || nightsOptions[1] || nightsOptions[0];
  if (!nightsPick) {
    throw new Error('В списке «ночей от» нет доступных значений');
  }
  await nightsItems.nth(nightsPick.i).click({ force: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  console.log('Ночей от:', nightsPick.text);

  // Uncheck "группировать результаты" checkbox
  currentStep = 'Снятие чек-бокса группировать результаты';
  const groupCheckbox = page.locator('label:has-text("группировать результаты")').locator('input[type="checkbox"]');
  if (await groupCheckbox.isChecked()) {
    await groupCheckbox.uncheck();
  }
  await page.waitForTimeout(300);

  // Check "Не отображать PROMO" checkbox
  currentStep = 'Активация чек-бокса Не отображать PROMO';
  const promoCheckbox = page.locator('label:has-text("Не отображать PROMO")').locator('input[type="checkbox"]');
  if (!(await promoCheckbox.isChecked())) {
    await promoCheckbox.check();
  }
  await page.waitForTimeout(300);

  // Click "Поиск" button
  currentStep = 'Нажатие кнопки Поиск';
  await page.locator('button.load.right').click({ force: true }).catch(async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('button.load.right');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  currentStep = 'Ожидание результатов поиска';
  const priceBtn = page.locator('#scrollto td.td_price span').first();
  await priceBtn.waitFor({ state: 'visible', timeout: 60000 });

  currentStep = 'Выбор тура по цене';
  await priceBtn.scrollIntoViewIfNeeded();
  const [bookingPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    priceBtn.click({ timeout: 10000 }),
  ]);

  targetPage = bookingPage || page;
  targetPage = await resolveBronPage(context, targetPage);
  await targetPage.locator('#tourist1').waitFor({ state: 'attached', timeout: 60000 });

  // Check that tour check-in date matches the requested departure date
  currentStep = 'Проверка даты тура';
  const actualCheckin = await targetPage.evaluate(() => {
    const table = document.querySelector('table.tour_info.res');
    return table ? table.getAttribute('data-checkin') : null;
  });
  if (actualCheckin !== selectedCheckin) {
    throw new Error(`выбрана неподходящая дата тура. Ожидалось: ${selectedCheckin}, получено: ${actualCheckin || 'не найдена'}`);
  }

  // Open DevTools and switch to Network tab
  await targetPage.keyboard.press('F12');
  await targetPage.waitForTimeout(1000);

  // Fill tourist 1 data
  currentStep = 'Заполнение данных туриста 1';
  await fillTourist(targetPage, 1);

  // Fill tourist 2 data
  currentStep = 'Заполнение данных туриста 2';
  await fillTourist(targetPage, 2);

  // Check "является заказчиком тура" for tourist 2
  currentStep = 'Отметка заказчика тура для туриста 2';
  const customerCheckbox2 = targetPage.locator('#tourist2 label:has-text("является заказчиком тура")').locator('input[type="checkbox"]');
  if (!(await customerCheckbox2.isChecked())) {
    await customerCheckbox2.check();
  }
  await targetPage.waitForTimeout(200);

  // Fill buyer's first name
  currentStep = 'Заполнение имени покупателя';
  await targetPage.locator('input[name="frm[phys_byer][-1][FIRSTNAME_NAME]"]').fill(transliterate(faker.person.firstName()).toUpperCase());
  await targetPage.waitForTimeout(200);

  // Fill buyer's last name
  currentStep = 'Заполнение фамилии покупателя';
  await targetPage.locator('input[name="frm[phys_byer][-1][LASTNAME_NAME]"]').fill(transliterate(faker.person.lastName()).toUpperCase());
  await targetPage.waitForTimeout(200);

  // Fill buyer's address with random Russian city
  currentStep = 'Заполнение адреса покупателя';
  const russianCity = faker.location.city();
  await targetPage.locator('input[name="frm[phys_byer][-1][ADDRESS]"]').fill(russianCity);
  await targetPage.waitForTimeout(200);

  // Click "Пересчитать" button
  currentStep = 'Пересчёт стоимости';
  await targetPage.locator('button.calc:has-text("Пересчитать")').click();
  await targetPage.waitForTimeout(7000);

  currentStep = 'Бронирование';
  await targetPage.locator('button:has-text("бронировать")').click();

  currentStep = 'Ожидание номера заявки';
  await targetPage.waitForFunction(
    () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText),
    { timeout: 90000 },
  );

  let orderNumber = 'не найден';
  let claimUrl = '';
  const pageText = await targetPage.evaluate(() => document.body.innerText);
  const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
  if (numMatch) orderNumber = numMatch[1];

  claimUrl = await targetPage.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.textContent.includes('Посмотреть заявку')) return a.href;
    }
    return '';
  });
  console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);

  await browser.close();
  } catch (err) {
    let pageUrl = 'недоступен';
    try {
      const activePage = targetPage && !targetPage.isClosed() ? targetPage : page;
      if (activePage && !activePage.isClosed()) pageUrl = activePage.url();
    } catch (_) {}
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    try {
      const activePage = targetPage && !targetPage.isClosed() ? targetPage : page;
      if (activePage && !activePage.isClosed()) await activePage.waitForTimeout(300000);
    } catch (_) {}
  }
})();
