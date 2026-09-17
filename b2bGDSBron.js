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

async function waitCircleAppear(page, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await page.evaluate(isCircleIdle))) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function afterStep(page, check) {
  await check();
  await waitLoadersIfAny(page);
}

async function pickCountry(page, container, optionText) {
  const trigger = container.locator('a.chosen-single').first();
  await trigger.click();
  const option = container.locator('li.active-result').filter({ hasText: optionText }).first();
  await option.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toContainText(optionText, { timeout: 15000 });

  if (await waitCircleAppear(page, 3000)) {
    await expect.poll(() => page.evaluate(isCircleIdle), {
      timeout: 30000,
      message: 'После страны загрузка не завершилась',
    }).toBe(true);
  }

  await expect(trigger).toContainText(optionText, { timeout: 5000 });
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

function nextDay(dateStr) {
  const [d, m, y] = dateStr.split('.').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

async function clickSearch(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('button.load.right');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function pickTour(page, container, tourName) {
  await container.scrollIntoViewIfNeeded();
  await container.locator('a.chosen-single').first().click();
  const tourSearch = container.locator('.chosen-search input');
  if (await tourSearch.count()) {
    await tourSearch.fill(tourName);
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

  await expect(container.locator('a.chosen-single').first()).toContainText(tourName, { timeout: 15000 });
  await waitLoadersIfAny(page);
  await expect(container.locator('a.chosen-single').first()).toContainText(tourName, { timeout: 5000 });
}

async function pickAdults(page, container, value) {
  await container.locator('a.chosen-single').first().click();
  await page.evaluate((want) => {
    const items = [...document.querySelectorAll('.ADULT_chosen .active-result')];
    const opt = items.find((el) => (el.textContent || '').trim() === want);
    if (!opt) {
      const available = items.map((el) => (el.textContent || '').trim()).join(' | ');
      throw new Error(`Опция "${want}" не найдена. Доступно: ${available || 'пусто'}`);
    }
    opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, value);
  const adultValue = await page.locator('select[name="ADULT"]').inputValue();
  if (adultValue !== value) {
    throw new Error(`После выбора взрослых ожидалось "${value}", получено "${adultValue}"`);
  }
  await waitLoadersIfAny(page);
}

async function adultsIsOne(page, container) {
  const selectVal = await page.locator('select[name="ADULT"]').inputValue().catch(() => '');
  const text = (await container.locator('a.chosen-single').first().innerText().catch(() => '')).trim();
  return selectVal === '1' && text === '1';
}

async function searchUntilResults(page, checkin, adultsFilter, onRetry) {
  let date = checkin;
  const maxTries = 7;
  const price = page.locator('#scrollto td.td_price span').first();

  for (let i = 0; i < maxTries; i++) {
    if (!(await adultsIsOne(page, adultsFilter))) {
      onRetry('взрослые сбросились на 2, снова 1');
      await pickAdults(page, adultsFilter, '1');
    }
    await clickSearch(page);
    await waitLoadersIfAny(page);
    const shown = await price.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (shown) return date;

    if (i === maxTries - 1) {
      throw new Error(`В #scrollto нет цен за ${maxTries} поисков`);
    }

    date = nextDay(date);
    onRetry(`нет цены в #scrollto, пробуем дату ${date}`);
    await setZebraDate(page, 'CHECKIN_BEG', date);
    await waitLoadersIfAny(page);
    const actualDate = await page.locator('input[name="CHECKIN_BEG"]').inputValue();
    if (actualDate) date = actualDate;
    console.log('Дата в поле после сдвига:', date);
  }

  return date;
}

async function ensureFiltersBeforeSearch(page, filters, onRetry) {
  let checkin = filters.checkin;
  let refills = 0;

  while (true) {
    await waitLoadersIfAny(page);

    const dateVal = await page.locator('input[name="CHECKIN_BEG"]').inputValue();
    let missing = null;
    if (!(await chosenHas(filters.city, 'Москва'))) missing = 'city';
    else if (!(await chosenHas(filters.country, 'Турция'))) missing = 'country';
    else if (!(await chosenHas(filters.freight, 'GDS'))) missing = 'freight';
    else if (!(await chosenHas(filters.tour, filters.tourName))) missing = 'tour';
    else if (dateVal !== checkin) missing = 'date';
    else if (!(await adultsIsOne(page, filters.adults))) missing = 'adults';

    if (!missing) {
      await assertChosenFilled(filters.city, 'Москва');
      await assertChosenFilled(filters.country, 'Турция');
      await assertChosenFilled(filters.freight, 'GDS');
      await assertChosenFilled(filters.tour, filters.tourName);
      await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(checkin);
      await expect(page.locator('select[name="ADULT"]')).toHaveValue('1');
      await expect(filters.adults.locator('a.chosen-single').first()).toHaveText('1');
      return checkin;
    }

    if (refills >= 3) {
      throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
    }
    refills += 1;

    if (missing === 'city') {
      onRetry('Выбор города Москва');
      await pickFilter(page, filters.city, 'Москва');
    } else if (missing === 'country') {
      onRetry('Выбор страны Турция');
      await pickCountry(page, filters.country, 'Турция');
    } else if (missing === 'freight') {
      onRetry('Выбор типа перевозки GDS');
      await pickFilter(page, filters.freight, 'GDS');
    } else if (missing === 'tour') {
      onRetry(`Выбор тура ${filters.tourName}`);
      await pickTour(page, filters.tour, filters.tourName);
    } else if (missing === 'adults') {
      onRetry('Выбор количества взрослых: 1');
      await pickAdults(page, filters.adults, '1');
    } else {
      onRetry('Установка даты вылета');
      checkin = await setAvailableDate(page, 'CHECKIN_BEG');
    }
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
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

  currentStep = 'Открытие search_tour';
  await page.goto('https://b2b.fstravel.com/search_tour', { waitUntil: 'load', timeout: 60000 });
  await afterStep(page, async () => {
    await expect(page.locator('a.login-action:has-text("Вход")')).toBeVisible({ timeout: 60000 });
  });

  currentStep = 'Авторизация на сайте';
  if (!process.env.LOGIN || !process.env.PASSWORD) {
    throw new Error('LOGIN или PASSWORD пустые. Запусти из GitLabTest или проверь .env рядом со скриптом.');
  }
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await page.locator('button:has-text("Войти")').click();
  await afterStep(page, async () => {
    await expect(page.getByLabel('Краткое имя')).toBeHidden({ timeout: 30000 });
    await expect(page.locator('.TOWNFROMINC_chosen')).toBeVisible();
  });

  currentStep = 'Выбор города Москва';
  const cityFilter = page.locator('.TOWNFROMINC_chosen');
  await pickFilter(page, cityFilter, 'Москва');
  await afterStep(page, async () => {
    await assertChosenFilled(cityFilter, 'Москва');
  });

  currentStep = 'Выбор страны Турция';
  const countryFilter = page.locator('.STATEINC_chosen');
  await pickCountry(page, countryFilter, 'Турция');
  await afterStep(page, async () => {
    await assertChosenFilled(countryFilter, 'Турция');
  });

  currentStep = 'Выбор типа перевозки GDS';
  const freightFilter = page.locator('.FREIGHTTYPE_chosen');
  await pickFilter(page, freightFilter, 'GDS');
  await afterStep(page, async () => {
    await assertChosenFilled(freightFilter, 'GDS');
  });

  currentStep = 'Выбор тура Turkey Antalya MOW GDS*';
  const tourName = 'Turkey Antalya MOW GDS*';
  const tourFilter = page.locator('.TOURINC_chosen');
  await pickTour(page, tourFilter, tourName);
  await afterStep(page, async () => {
    await assertChosenFilled(tourFilter, tourName);
  });

  currentStep = 'Прокрутка страницы';
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await afterStep(page, async () => {
    await expect(page.locator('.ADULT_chosen')).toBeVisible();
  });

  currentStep = 'Установка даты вылета';
  let selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG');
  console.log('Выбрана дата вылета:', selectedCheckin);
  await afterStep(page, async () => {
    await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(selectedCheckin);
  });

  currentStep = 'Выбор количества взрослых: 1';
  const adultsFilter = page.locator('.ADULT_chosen');
  await pickAdults(page, adultsFilter, '1');
  await afterStep(page, async () => {
    await expect(page.locator('select[name="ADULT"]')).toHaveValue('1');
    await expect(adultsFilter.locator('a.chosen-single').first()).toHaveText('1');
  });

  currentStep = 'Снятие чек-бокса группировать результаты';
  const groupCheckbox = page.locator('label:has-text("группировать результаты")').locator('input[type="checkbox"]');
  if (await groupCheckbox.isChecked()) {
    await groupCheckbox.uncheck();
  }
  await afterStep(page, async () => {
    await expect(groupCheckbox).not.toBeChecked();
  });

  currentStep = 'Активация чек-бокса Не отображать PROMO';
  const promoCheckbox = page.locator('label:has-text("Не отображать PROMO")').locator('input[type="checkbox"]');
  if (!(await promoCheckbox.isChecked())) {
    await promoCheckbox.check();
  }
  await afterStep(page, async () => {
    await expect(promoCheckbox).toBeChecked();
  });

  currentStep = 'Проверка всех фильтров перед поиском';
  selectedCheckin = await ensureFiltersBeforeSearch(page, {
    city: cityFilter,
    country: countryFilter,
    freight: freightFilter,
    tour: tourFilter,
    tourName,
    adults: adultsFilter,
    checkin: selectedCheckin,
  }, (name) => {
    currentStep = `Повтор: ${name}`;
    console.log(currentStep);
  });

  currentStep = 'Нажатие кнопки Поиск';
  selectedCheckin = await searchUntilResults(page, selectedCheckin, adultsFilter, (name) => {
    currentStep = `Повтор поиска: ${name}`;
    console.log(currentStep);
  });

  currentStep = 'Ожидание результатов поиска';
  const priceBtn = page.locator('#scrollto td.td_price span').first();
  await expect(priceBtn).toBeVisible({ timeout: 5000 });

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
  if (actualCheckin && actualCheckin !== selectedCheckin) {
    console.log(`Дата тура ${actualCheckin}, в фильтре было ${selectedCheckin} — не ошибка`);
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

  currentStep = 'Проверка заявки в ЛК';
  if (orderNumber === 'не найден') {
    throw new Error('Номер заявки не найден');
  }
  if (!claimUrl) {
    throw new Error('Нет ссылки «Посмотреть заявку»');
  }
  await targetPage.goto(claimUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await targetPage.waitForFunction(
    (num) => document.body.innerText.includes(num),
    orderNumber,
    { timeout: 30000 },
  );

  await notifyBron({ name: 'GDS', ok: true, orderNumber, claimUrl });

  await browser.close();
  } catch (err) {
    const pageUrl = typeof page !== 'undefined' ? await page.evaluate(() => location.href).catch(() => 'недоступен') : 'недоступен';
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'GDS', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
