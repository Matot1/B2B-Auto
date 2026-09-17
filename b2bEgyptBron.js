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

async function afterStep(page, check) {
  await check();
  await waitLoadersIfAny(page);
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

async function searchUntilResults(page, checkin, onRetry) {
  let date = checkin;
  const maxTries = 7;
  const price = page.locator('#scrollto td.td_price span').first();

  for (let i = 0; i < maxTries; i++) {
    await clickSearch(page);
    await waitLoadersIfAny(page);
    const shown = await price.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (shown) return date;

    if (i === maxTries - 1) {
      throw new Error(`В #scrollto нет цен за ${maxTries} поисков`);
    }

    date = nextDay(date);
    onRetry(`нет цены в #scrollto, дата ${date}`);
    await setZebraDate(page, 'CHECKIN_BEG', date);
    await afterStep(page, async () => {
      await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(date);
    });
  }

  return date;
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

async function ensureFiltersBeforeSearch(page, filters, onRetry) {
  let checkin = filters.checkin;
  let refills = 0;

  while (true) {
    await waitLoadersIfAny(page);

    const dateVal = await page.locator('input[name="CHECKIN_BEG"]').inputValue();
    let missing = null;
    if (!(await chosenHas(filters.city, 'Москва'))) missing = 'city';
    else if (!(await chosenHas(filters.country, 'Египет'))) missing = 'country';
    else if (!(await chosenHas(filters.freight, 'Чартер/блочная перевозка'))) missing = 'freight';
    else if (!(await chosenHas(filters.tour, 'Sharm'))) missing = 'tour';
    else if (dateVal !== checkin) missing = 'date';

    if (!missing) {
      await assertChosenFilled(filters.city, 'Москва');
      await assertChosenFilled(filters.country, 'Египет');
      await assertChosenFilled(filters.freight, 'Чартер/блочная перевозка');
      await assertChosenFilled(filters.tour, 'Sharm');
      await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(checkin);
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
      onRetry('Выбор страны Египет');
      await pickCountry(page, filters.country, 'Египет');
    } else if (missing === 'freight') {
      onRetry('Выбор типа перевозки');
      await pickFilter(page, filters.freight, 'Чартер/блочная перевозка');
    } else if (missing === 'tour') {
      onRetry('Выбор тура Egypt Sharm-El-Sheikh MOW');
      await filters.tour.scrollIntoViewIfNeeded();
      await pickFilter(page, filters.tour, 'Sharm');
    } else {
      onRetry('Установка даты вылета');
      checkin = await setAvailableDate(page, 'CHECKIN_BEG', 'yesplace');
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
  let targetPage = page;

  try {

  await page.goto('https://b2b.fstravel.com/search_tour', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await afterStep(page, async () => {
    await expect(page.locator('a.login-action:has-text("Вход"), .STATEINC_chosen').first()).toBeVisible({ timeout: 30000 });
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

  currentStep = 'Выбор страны Египет';
  const countryFilter = page.locator('.STATEINC_chosen');
  await pickCountry(page, countryFilter, 'Египет');
  await afterStep(page, async () => {
    await assertChosenFilled(countryFilter, 'Египет');
  });

  currentStep = 'Выбор типа перевозки';
  const freightFilter = page.locator('.FREIGHTTYPE_chosen');
  await pickFilter(page, freightFilter, 'Чартер/блочная перевозка');
  await afterStep(page, async () => {
    await assertChosenFilled(freightFilter, 'Чартер/блочная перевозка');
  });

  currentStep = 'Выбор тура Egypt Sharm-El-Sheikh MOW';
  const tourFilter = page.locator('.TOURINC_chosen');
  await tourFilter.scrollIntoViewIfNeeded();
  await pickFilter(page, tourFilter, 'Sharm');
  await afterStep(page, async () => {
    await assertChosenFilled(tourFilter, 'Sharm');
  });

  currentStep = 'Прокрутка страницы';
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await afterStep(page, async () => {
    await expect(page.locator('input[name="CHECKIN_BEG"]')).toBeVisible();
  });

  currentStep = 'Установка даты вылета';
  let selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG', 'yesplace');
  console.log('Выбрана дата вылета:', selectedCheckin);
  await afterStep(page, async () => {
    await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(selectedCheckin);
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
    checkin: selectedCheckin,
  }, (name) => {
    currentStep = `Повтор: ${name}`;
    console.log(currentStep);
  });

  currentStep = 'Нажатие кнопки Поиск';
  selectedCheckin = await searchUntilResults(page, selectedCheckin, (name) => {
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
  await notifyBron({ name: 'Egypt', ok: true, orderNumber, claimUrl });

  await browser.close();
  } catch (err) {
    let pageUrl = 'недоступен';
    try {
      const activePage = targetPage && !targetPage.isClosed() ? targetPage : page;
      if (activePage && !activePage.isClosed()) pageUrl = activePage.url();
    } catch (_) {}
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'Egypt', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
