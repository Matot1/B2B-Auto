const path = require('path');
const { chromium } = require('playwright');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { setDate: setZebraDate, setAvailableDate } = require('./object/zebraDatePicker.cjs');
const { notifyBron } = require('./notify.cjs');

async function fillTourist(page, index) {
  const prefix = `#tourist${index}`;

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

  await page.goto('https://b2b.fstravel.com/search_hotel', { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for page to fully load
  await page.waitForTimeout(3000);

  // Click "Вход" and login
  currentStep = 'Авторизация на сайте';
  if (!process.env.LOGIN || !process.env.PASSWORD) {
    throw new Error('LOGIN или PASSWORD пустые. Запусти из b2bAuto или проверь .env рядом со скриптом.');
  }
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.waitForTimeout(3000);
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForTimeout(3000);

  // Select country "Кипр"
  currentStep = 'Выбор страны Кипр';
  await page.locator('.STATEINC_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.STATEINC_chosen .active-result:has-text("Кипр")').click();
  await page.waitForTimeout(3000);

  // Select product type "Статика"
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

  // Select tour "Cyprus (hotel only)"
  currentStep = 'Выбор тура Cyprus (hotel only)';
  const tourName = 'Cyprus (hotel only)';
  const tourFilter = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr.tour_filter > td.tour_right > div');
  await tourFilter.waitFor({ state: 'visible', timeout: 30000 });
  await tourFilter.locator('a.chosen-single').first().scrollIntoViewIfNeeded();
  await tourFilter.locator('a.chosen-single').first().click({ force: true });
  await page.waitForTimeout(800);
  const tourSearch = tourFilter.locator('.chosen-search input');
  if (await tourSearch.count()) {
    const editable = await tourSearch.first().isEditable().catch(() => false);
    if (editable) {
      await tourSearch.first().fill(tourName);
      await page.waitForTimeout(800);
    }
  }

  const selectedTour = await page.evaluate((name) => {
    const normalize = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const root = document.querySelector('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr.tour_filter > td.tour_right > div')
      || document.querySelector('.TOURINC_chosen');
    const items = root
      ? [...root.querySelectorAll('li.active-result, li.result-selected')]
      : [];
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Set "Заезд от" to the first blue calendar date (#ADC6F5), after 4 months
  currentStep = 'Установка даты заезда';
  const selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG', '#ADC6F5');
  console.log('Выбрана дата заезда:', selectedCheckin);

  // Select adults - 2
  currentStep = 'Выбор количества взрослых';
  await page.locator('.ADULT_chosen .chosen-single').click();
  await page.waitForTimeout(300);
  await page.locator('.ADULT_chosen .active-result:has-text("2")').click();
  await page.waitForTimeout(500);

  // Uncheck "группировать результаты" checkbox
  currentStep = 'Снятие чек-бокса группировать результаты';
  const groupCheckbox = page.locator('label.hotelgroup:has-text("группировать результаты") input[name="PARTITION_PRICE"]');
  if (await groupCheckbox.isChecked()) {
    await groupCheckbox.uncheck();
  }
  await page.waitForTimeout(300);

  // Click "Поиск" button
  currentStep = 'Нажатие кнопки Поиск';
  await page.evaluate(() => {
    const btn = document.querySelector('button.load.right');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  // Wait for search results to load
  await page.waitForTimeout(7000);

  // Click any price button and wait for new booking page
  currentStep = 'Выбор отеля по цене';
  const priceBtn = page.locator('span.price.bron.price_button').first();
  await priceBtn.waitFor({ state: 'visible', timeout: 60000 });
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

  currentStep = 'Изменение страховок';
  await targetPage.locator('button.additional_insures:has-text("Изменить страховки")').click();
  const insuresModal = targetPage.locator('#additional_insures');
  await insuresModal.waitFor({ state: 'visible', timeout: 15000 });
  const medicalInsure = insuresModal.locator('input.maininsure[data-insure_type_name="Медицинская"]');
  await medicalInsure.first().waitFor({ state: 'visible', timeout: 15000 });
  if (!(await medicalInsure.first().isChecked())) {
    await medicalInsure.first().check();
  }
  await targetPage.waitForTimeout(300);
  currentStep = 'Сохранение страховок';
  await targetPage.locator('#ADD_ADDITIONAL_INSURES:has-text("Сохранить")').click();
  await targetPage.waitForTimeout(1000);

  // Click "Пересчитать" button
  currentStep = 'Пересчёт стоимости';
  await targetPage.locator('button.calc:has-text("Пересчитать")').click();
  await targetPage.waitForTimeout(7000);

  currentStep = 'Бронирование';
  await targetPage.locator('button:has-text("бронировать")').click();

  currentStep = 'Ожидание блока с информацией о бронировании';
  await targetPage.waitForFunction(
    () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText),
    { timeout: 90000 },
  );

  const pageText = await targetPage.evaluate(() => document.body.innerText);
  const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
  const orderNumber = numMatch ? numMatch[1] : 'не найден';
  const claimUrl = await targetPage.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.textContent.includes('Посмотреть заявку')) return a.href;
    }
    return '';
  });
  console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);
  await notifyBron({ name: 'Hotel', ok: true, orderNumber, claimUrl });

  await browser.close();
  } catch (err) {
    const pageUrl = typeof page !== 'undefined' ? await page.evaluate(() => location.href).catch(() => 'недоступен') : 'недоступен';
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'Hotel', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
