const { chromium } = require('playwright');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config();
const { setDate: setZebraDate, setAvailableDate } = require('./object/zebraDatePicker.cjs');
const { notifyBron } = require('./notify.cjs');

async function fillTourist(page, index) {
  const prefix = `#tourist${index}`;

  // Select gender - Жен.
  await page.locator(`${prefix} .chosen-single:has-text("----")`).click();
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
  const page = await context.newPage();
  let currentStep = '';

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
  await page.locator('.TOWNFROMINC_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.TOWNFROMINC_chosen .active-result:has-text("Москва")').click();
  await page.waitForTimeout(5000);

  // Select country "Турция"
  currentStep = 'Выбор страны Турция';
  await page.locator('.STATEINC_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.STATEINC_chosen .active-result:has-text("Турция")').click();
  await page.waitForTimeout(5000);

  // Select freight type "GDS"
  currentStep = 'Выбор типа перевозки GDS';
  await page.locator('.FREIGHTTYPE_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.FREIGHTTYPE_chosen .active-result:has-text("GDS")').click();
  await page.waitForTimeout(5000);

  // Select tour "Turkey Alanya MOW GDS (GZP)"
  currentStep = 'Выбор тура Turkey Alanya MOW GDS (GZP)';
  const tourName = 'Turkey Alanya MOW GDS (GZP)';
  await page.locator('.TOURINC_chosen .chosen-single').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('.TOURINC_chosen .chosen-single').click();
  await page.waitForTimeout(500);

  const tourSearch = page.locator('.TOURINC_chosen .chosen-search input');
  if (await tourSearch.count()) {
    await tourSearch.fill('Alanya MOW GDS');
    await page.waitForTimeout(800);
  }

  const selectedTour = await page.evaluate((name) => {
    const normalize = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const items = [...document.querySelectorAll('.TOURINC_chosen .active-result, .TOURINC_chosen .result-selected')];
    const exact = items.find((el) => normalize(el.textContent) === name);
    if (exact) {
      exact.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      exact.click();
      return normalize(exact.textContent);
    }
    return items.map((el) => normalize(el.textContent)).filter(Boolean);
  }, tourName);

  if (Array.isArray(selectedTour)) {
    throw new Error(`Тур "${tourName}" не найден. Доступно: ${selectedTour.join(' | ') || 'пусто'}`);
  }
  await page.waitForTimeout(1000);

  // Scroll to the bottom of the page
  currentStep = 'Прокрутка страницы';
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Select adults count "1" via Chosen (same pattern as city/country filters)
  currentStep = 'Выбор количества взрослых: 1';
  await page.locator('.ADULT_chosen .chosen-single').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.ADULT_chosen .active-result')];
    const opt = items.find((el) => (el.textContent || '').trim() === '1');
    if (!opt) {
      const available = items.map((el) => (el.textContent || '').trim()).join(' | ');
      throw new Error(`Опция "1" не найдена. Доступно: ${available || 'пусто'}`);
    }
    // Chosen обрабатывает mouseup на li.active-result
    opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  const adultValue = await page.locator('select[name="ADULT"]').inputValue();
  if (adultValue !== '1') {
    throw new Error(`После выбора взрослых ожидалось "1", получено "${adultValue}"`);
  }

  // Set "Вылет От" to the first calendar date marked as available (purple / .gds)
  currentStep = 'Установка даты вылета';
  const selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG');
  console.log('Выбрана дата вылета:', selectedCheckin);

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
  await page.waitForTimeout(2000);

  currentStep = 'Ожидание результатов поиска';
  const priceBtn = page.locator('#scrollto td.td_price span').first();
  await priceBtn.waitFor({ state: 'visible', timeout: 60000 });

  currentStep = 'Выбор тура по цене';
  await priceBtn.scrollIntoViewIfNeeded();
  const [bookingPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    priceBtn.click({ timeout: 10000 }),
  ]);

  const targetPage = bookingPage || page;
  await targetPage.waitForTimeout(5000);

  // Check that tour check-in date matches the requested departure date
  currentStep = 'Проверка даты тура';
  const actualCheckin = await targetPage.evaluate(() => {
    const table = document.querySelector('table.tour_info.res');
    return table ? table.getAttribute('data-checkin') : null;
  });
  if (actualCheckin !== selectedCheckin) {
    throw new Error(`выбрана неподходящая дата тура. Ожидалось: ${selectedCheckin}, получено: ${actualCheckin || 'не найдена'}`);
  }

  // Select first offered GDS flight
  currentStep = 'Выбор рейса';
  const flightRadio = targetPage.locator('#gdsGrid input[type="radio"][name="freight4table"]').first();
  await flightRadio.waitFor({ state: 'attached', timeout: 15000 });
  await flightRadio.scrollIntoViewIfNeeded();
  await flightRadio.check({ force: true });
  await targetPage.waitForTimeout(1000);

  // Fill tourist 1 data
  currentStep = 'Заполнение данных туриста 1';
  await fillTourist(targetPage, 1);

  // Check "является заказчиком тура" for tourist 1
  currentStep = 'Отметка заказчика тура для туриста 1';
  const customerCheckbox1 = targetPage.locator('#tourist1 label:has-text("является заказчиком тура")').locator('input[type="checkbox"]');
  if (!(await customerCheckbox1.isChecked())) {
    await customerCheckbox1.check();
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

  // Click "бронировать" button
  currentStep = 'Бронирование';
  await targetPage.locator('button:has-text("бронировать")').click();
  await targetPage.waitForTimeout(90000);

  // Check for order number on the page
  let orderNumber = 'не найден';
  let claimUrl = '';
  try {
    const pageText = await targetPage.evaluate(() => document.body.innerText);
    const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
    if (numMatch) orderNumber = numMatch[1];

    // Get the claim URL from the modal link
    claimUrl = await targetPage.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.includes('Посмотреть заявку')) return a.href;
      }
      return '';
    });
    console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);
  } catch (e) {
    console.log('Не удалось проверить результат, URL:', targetPage.url());
  }

  await notifyBron({ name: 'GDS', ok: orderNumber !== 'не найден', orderNumber, claimUrl });
  await browser.close();
  } catch (err) {
    const pageUrl = typeof page !== 'undefined' ? await page.evaluate(() => location.href).catch(() => 'недоступен') : 'недоступен';
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'GDS', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
