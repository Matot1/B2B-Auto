const path = require('path');
const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
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

function isCircleIdle() {
  const el = document.querySelector('#samo-circle-preloader');
  if (!el) return true;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return true;
  const r = el.getBoundingClientRect();
  return r.width === 0 || r.height === 0;
}

function pageReadyState() {
  const el = document.querySelector('#samo-circle-preloader');
  let circleIdle = true;
  if (el) {
    const st = getComputedStyle(el);
    if (st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) !== 0) {
      const r = el.getBoundingClientRect();
      circleIdle = r.width === 0 || r.height === 0;
    }
  }
  return { circleIdle };
}

async function waitLoadersIfAny(page, timeout = 30000) {
  if (await page.evaluate(isCircleIdle)) return;
  await expect.poll(() => page.evaluate(isCircleIdle), {
    timeout,
    message: 'Загрузка не завершилась',
  }).toBe(true);
}

async function pickCountry(page, container, optionText) {
  const trigger = container.locator('a.chosen-single').first();
  const appeared = expect.poll(() => page.evaluate(isCircleIdle), {
    timeout: 30000,
    message: 'После страны кружок не появился',
  }).toBe(false);

  await trigger.click();
  const option = container.locator('li.active-result').filter({ hasText: optionText }).first();
  await option.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toContainText(optionText, { timeout: 15000 });

  await appeared;
  await expect.poll(() => page.evaluate(isCircleIdle), {
    timeout: 30000,
    message: 'После страны загрузка не завершилась',
  }).toBe(true);
  await expect(trigger).toContainText(optionText, { timeout: 5000 });
}

async function afterStep(page, check) {
  await check();
  await waitLoadersIfAny(page);
}

async function assertChosenFilled(container, text) {
  await expect(container.locator('a.chosen-single').first()).toContainText(text, {
    timeout: 5000,
    message: `Фильтр должен быть «${text}»`,
  });
}

async function chosenHas(container, text) {
  const actual = await container.locator('a.chosen-single').first().innerText().catch(() => '');
  return actual.includes(text);
}

async function ensureFiltersBeforeSearch(page, filters, onRetry) {
  let checkin = filters.checkin;
  let refills = 0;

  while (true) {
    await waitLoadersIfAny(page);

    const dateVal = await page.locator('input[name="CHECKIN_BEG"]').inputValue();
    let missing = null;
    if (!(await chosenHas(filters.country, 'Таиланд'))) missing = 'country';
    else if (!(await chosenHas(filters.productType, 'Статика'))) missing = 'product';
    else if (!(await chosenHas(filters.program, 'Стандарт'))) missing = 'program';
    else if (dateVal !== checkin) missing = 'date';
    else if (!(await chosenHas(filters.adults, '2'))) missing = 'adults';

    if (!missing) {
      await assertChosenFilled(filters.country, 'Таиланд');
      await assertChosenFilled(filters.productType, 'Статика');
      await assertChosenFilled(filters.program, 'Стандарт');
      await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(checkin);
      await assertChosenFilled(filters.adults, '2');
      return checkin;
    }

    if (refills >= 3) {
      throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
    }
    refills += 1;

    if (missing === 'country') {
      onRetry('Выбор страны Таиланд');
      await pickCountry(page, filters.country, 'Таиланд');
    } else if (missing === 'product') {
      onRetry('Выбор типа продукта Статика');
      await pickFilter(page, filters.productType, 'Статика');
    } else if (missing === 'program') {
      onRetry('Выбор программы Стандарт');
      await pickFilter(page, filters.program, 'Стандарт');
    } else if (missing === 'date') {
      onRetry('Установка даты заезда');
      checkin = await setAvailableDate(page, 'CHECKIN_BEG', '#ADC6F5');
    } else {
      onRetry('Выбор количества взрослых');
      await filters.adults.locator('.chosen-single').click();
      await filters.adults.locator('.active-result:has-text("2")').click();
    }
  }
}

async function pickFilter(page, container, optionText) {
  const trigger = container.locator('a.chosen-single').first();
  await trigger.click();
  const option = container.locator('li.active-result').filter({ hasText: optionText }).first();
  await option.click();
  await page.keyboard.press('Escape');

  await expect(trigger).toContainText(optionText, { timeout: 15000 });

  await expect.poll(async () => {
    const state = await page.evaluate(pageReadyState);
    const filterOk = await trigger.evaluate((el, text) => el.innerText.includes(text), optionText);
    if (!filterOk) return 'фильтр сбросился';
    if (!state.circleIdle) return 'кружок ещё крутится';
    return 'ok';
  }, {
    timeout: 30000,
    message: `Фильтр «${optionText}»: страница ещё не готова`,
  }).toBe('ok');

  await expect(trigger).toContainText(optionText, { timeout: 5000 });
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

  await page.goto('https://b2b.fstravel.com/search_hotel', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await afterStep(page, async () => {
    await expect(page.locator('a.login-action:has-text("Вход"), .STATEINC_chosen').first()).toBeVisible({ timeout: 30000 });
  });

  currentStep = 'Авторизация на сайте';
  if (!process.env.LOGIN || !process.env.PASSWORD) {
    throw new Error('LOGIN или PASSWORD пустые. Запусти из b2bAuto или проверь .env рядом со скриптом.');
  }
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await page.locator('button:has-text("Войти")').click();
  await afterStep(page, async () => {
    await expect(page.getByLabel('Краткое имя')).toBeHidden({ timeout: 30000 });
    await expect(page.locator('.STATEINC_chosen')).toBeVisible();
  });

  currentStep = 'Выбор страны Таиланд';
  const countryFilter = page.locator('.STATEINC_chosen');
  await pickCountry(page, countryFilter, 'Таиланд');
  await afterStep(page, async () => {
    await assertChosenFilled(countryFilter, 'Таиланд');
  });

  currentStep = 'Выбор типа продукта Статика';
  const productTypeSelector = '#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr.producttype_filter > td.tour_right > div';
  const productType = page.locator(productTypeSelector);
  await pickFilter(page, productType, 'Статика');
  await afterStep(page, async () => {
    await assertChosenFilled(productType, 'Статика');
  });

  currentStep = 'Выбор программы Стандарт';
  const programSelector = '#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr.ptype_filter > td.tour_right > div';
  const programFilter = page.locator(programSelector);
  await pickFilter(page, programFilter, 'Стандарт');
  await afterStep(page, async () => {
    await assertChosenFilled(programFilter, 'Стандарт');
  });

  // Тур и тип тура не трогаем

  currentStep = 'Установка даты заезда';
  let selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG', '#ADC6F5');
  console.log('Выбрана дата заезда:', selectedCheckin);
  await afterStep(page, async () => {
    await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(selectedCheckin);
  });

  currentStep = 'Выбор количества взрослых';
  const adultsFilter = page.locator('.ADULT_chosen');
  await adultsFilter.locator('.chosen-single').click();
  await adultsFilter.locator('.active-result:has-text("2")').click();
  await afterStep(page, async () => {
    await assertChosenFilled(adultsFilter, '2');
  });

  currentStep = 'Снятие чек-бокса группировать результаты';
  const groupCheckbox = page.locator('label.hotelgroup:has-text("группировать результаты") input[name="PARTITION_PRICE"]');
  if (await groupCheckbox.isChecked()) {
    await groupCheckbox.uncheck();
  }
  await afterStep(page, async () => {
    await expect(groupCheckbox).not.toBeChecked();
  });

  currentStep = 'Проверка всех фильтров перед поиском';
  selectedCheckin = await ensureFiltersBeforeSearch(page, {
    country: countryFilter,
    productType,
    program: programFilter,
    adults: adultsFilter,
    checkin: selectedCheckin,
  }, (name) => {
    currentStep = `Повтор: ${name}`;
    console.log(currentStep);
  });

  currentStep = 'Нажатие кнопки Поиск';
  await page.evaluate(() => {
    const btn = document.querySelector('button.load.right');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await afterStep(page, async () => {
    await expect(page.locator('span.price.bron.price_button').first()).toBeVisible({ timeout: 60000 });
  });

  currentStep = 'Выбор отеля по цене';
  const priceBtn = page.locator('span.price.bron.price_button').first();
  await priceBtn.scrollIntoViewIfNeeded();
  const [bookingPage] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    priceBtn.click({ timeout: 10000 }),
  ]);

  const targetPage = bookingPage || page;
  await afterStep(targetPage, async () => {
    await expect(targetPage.locator('table.tour_info.res')).toBeVisible({ timeout: 30000 });
    await expect(targetPage.locator('table.tour_info.res')).toHaveAttribute('data-checkin', selectedCheckin);
  });

  currentStep = 'Заполнение данных туриста 1';
  await fillTourist(targetPage, 1);
  await afterStep(targetPage, async () => {
    await expect(targetPage.locator('input[name="frm[People][1][LASTNAME_LNAME]"]')).not.toBeEmpty();
  });

  currentStep = 'Заполнение данных туриста 2';
  await fillTourist(targetPage, 2);
  await afterStep(targetPage, async () => {
    await expect(targetPage.locator('input[name="frm[People][2][LASTNAME_LNAME]"]')).not.toBeEmpty();
  });

  currentStep = 'Отметка заказчика тура для туриста 2';
  const customerCheckbox2 = targetPage.locator('#tourist2 label:has-text("является заказчиком тура")').locator('input[type="checkbox"]');
  if (!(await customerCheckbox2.isChecked())) {
    await customerCheckbox2.check();
  }
  await afterStep(targetPage, async () => {
    await expect(customerCheckbox2).toBeChecked();
  });

  currentStep = 'Заполнение имени покупателя';
  const buyerFirst = transliterate(faker.person.firstName()).toUpperCase();
  const buyerFirstInput = targetPage.locator('input[name="frm[phys_byer][-1][FIRSTNAME_NAME]"]');
  await buyerFirstInput.fill(buyerFirst);
  await afterStep(targetPage, async () => {
    await expect(buyerFirstInput).toHaveValue(buyerFirst);
  });

  currentStep = 'Заполнение фамилии покупателя';
  const buyerLast = transliterate(faker.person.lastName()).toUpperCase();
  const buyerLastInput = targetPage.locator('input[name="frm[phys_byer][-1][LASTNAME_NAME]"]');
  await buyerLastInput.fill(buyerLast);
  await afterStep(targetPage, async () => {
    await expect(buyerLastInput).toHaveValue(buyerLast);
  });

  currentStep = 'Заполнение адреса покупателя';
  const russianCity = faker.location.city();
  const buyerAddr = targetPage.locator('input[name="frm[phys_byer][-1][ADDRESS]"]');
  await buyerAddr.fill(russianCity);
  await afterStep(targetPage, async () => {
    await expect(buyerAddr).toHaveValue(russianCity);
  });

  currentStep = 'Пересчёт стоимости';
  await targetPage.locator('button.calc:has-text("Пересчитать")').click();
  await afterStep(targetPage, async () => {
    await expect(targetPage.locator('button.calc:has-text("Пересчитать")')).toBeEnabled({ timeout: 30000 });
  });

  currentStep = 'Бронирование';
  await targetPage.locator('button:has-text("бронировать")').click();
  await afterStep(targetPage, async () => {
    await expect(targetPage.locator('body')).toContainText(/Номер вашей заявки:\s*\d+/, { timeout: 90000 });
  });

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
