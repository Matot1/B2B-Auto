const path = require('path');
const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { setAvailableDate, setDateDirect, setDate: setZebraDate } = require('./object/zebraDatePicker.cjs');
const { notifyBron } = require('./notify.cjs');

function chosenContainer(page, selectName) {
  return page.locator(`select[name="${selectName}"]`)
    .locator('xpath=following-sibling::div[contains(@class,"chosen-container")]')
    .first();
}

async function selectChosenByName(page, selectName, optionText) {
  const container = chosenContainer(page, selectName);
  const trigger = container.locator('a.chosen-single');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let option = container.locator('.chosen-results li.active-result')
    .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) });
  if (await option.count() === 0) {
    option = container.locator('.chosen-results li.active-result').filter({ hasText: optionText });
  }
  await option.first().click();

  const display = (await trigger.innerText()).trim();
  if (display !== optionText && !display.includes(optionText)) {
    throw new Error(`${selectName}: выбрано "${display}", ожидали "${optionText}"`);
  }
}

async function fillInputValue(locator, value) {
  const input = locator.first();
  const isReadonly = await input.getAttribute('readonly') !== null;
  const isDisabled = await input.isDisabled();
  if (isReadonly || isDisabled) {
    await input.evaluate((el, val) => {
      el.disabled = false;
      el.readOnly = false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  } else {
    await input.fill(value);
  }
}

async function fillTourist(page, index) {
  const prefix = `frm[People][${index}]`;
  await page.locator(`#tourist${index}`).scrollIntoViewIfNeeded();

  const lastNameRu = faker.person.lastName();
  const firstNameRu = faker.person.firstName();

  await selectChosenByName(page, `${prefix}[HUMAN]`, 'MRS');

  await fillInputValue(
    page.locator(`input[name="${prefix}[LASTNAME_LNAME]"]`),
    transliterate(lastNameRu).toUpperCase(),
  );

  await fillInputValue(
    page.locator(`input[name="${prefix}[FIRSTNAME_LNAME]"]`),
    transliterate(firstNameRu).toUpperCase(),
  );

  await fillInputValue(
    page.locator(`input[name="${prefix}[LASTNAME_NAME]"]`),
    lastNameRu,
  );

  await fillInputValue(
    page.locator(`input[name="${prefix}[FIRSTNAME_NAME]"]`),
    firstNameRu,
  );

  await fillInputValue(
    page.locator(`input[name="${prefix}[INN]"]`),
    '0700014746',
  );

  await setDateDirect(page, `${prefix}[BORN]`, '01.01.2000');

  await selectChosenByName(page, `${prefix}[NATIONALITY]`, 'Россия');

  await selectChosenByName(page, `${prefix}[IDENTITY_DOCUMENT]`, 'Заграничный паспорт');

  await fillInputValue(page.locator(`input[name="${prefix}[PSERIE]"]`), faker.string.numeric(2));

  await fillInputValue(page.locator(`input[name="${prefix}[PNUMBER]"]`), faker.string.numeric(7));

  await setDateDirect(page, `${prefix}[PVALID]`, '01.01.2031');

  await setDateDirect(page, `${prefix}[PGIVEN]`, '10.10.2024');
}

async function fillBuyer(page) {
  const lastNameRu = faker.person.lastName();
  const firstNameRu = faker.person.firstName();

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(1) > td:nth-child(2) > input'),
    transliterate(lastNameRu).toUpperCase(),
  );

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(2) > td:nth-child(2) > input'),
    transliterate(firstNameRu).toUpperCase(),
  );

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(6) > td:nth-child(2) > input'),
    faker.location.city(),
  );

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(7) > td:nth-child(2) > input'),
    faker.string.numeric(4),
  );

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(8) > td:nth-child(2) > input'),
    faker.string.numeric(6),
  );

  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(10) > td:nth-child(2) > input'),
    `${faker.string.alphanumeric({ length: 10, casing: 'lower' })}@mail.ru`,
  );

  await selectChosenOption(
    page,
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(11) > td:nth-child(2) > div > a'),
    'Беларусь',
  );

  await selectChosenOption(
    page,
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(12) > td:nth-child(2) > div > a'),
    'Заграничный паспорт',
  );
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

  for (let attempt = 1; attempt <= 3; attempt++) {
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
    await waitLoadersIfAny(page);

    const text = (await trigger.innerText()).trim();
    if (text.includes(optionText)) return;
    console.log(`Страна сбросилась в «${text}», повтор ${attempt}`);
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
    if (!(await chosenHas(filters.city, 'Минск'))) missing = 'city';
    else if (!(await chosenHas(filters.country, 'Египет'))) missing = 'country';
    else if (dateVal !== checkin) missing = 'date';

    if (!missing) {
      await assertChosenFilled(filters.city, 'Минск');
      await assertChosenFilled(filters.country, 'Египет');
      await expect(page.locator('input[name="CHECKIN_BEG"]')).toHaveValue(checkin);
      return checkin;
    }

    if (refills >= 3) {
      throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
    }
    refills += 1;

    if (missing === 'city') {
      onRetry('Выбор города Минск');
      await pickFilter(page, filters.city, 'Минск');
    } else if (missing === 'country') {
      onRetry('Выбор страны Египет');
      await pickCountry(page, filters.country, 'Египет');
    } else {
      onRetry('Установка даты вылета');
      checkin = await setAvailableDate(page, 'CHECKIN_BEG', 'yesplace');
    }
  }
}

async function waitForLoad(page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

async function clickAndWait(page, locator, options = {}) {
  const { timeout = 60000, clickOptions = {} } = options;
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('fstravel.by') && response.status() < 400,
    { timeout },
  ).catch(() => null);

  await locator.click(clickOptions);
  await responsePromise;
  await waitForLoad(page, timeout);
}

async function selectChosenOption(page, openLocator, optionText, options = {}) {
  const { timeout = 30000 } = options;
  await openLocator.click();
  const option = page.locator('.chosen-container-active .active-result').filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout });

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('fstravel.by') && response.status() < 400,
    { timeout },
  ).catch(() => null);

  await option.click();
  await responsePromise;
  await waitForLoad(page, timeout);
}

async function resolveBronPage(context, page) {
  for (let i = 0; i < 60; i++) {
    for (const p of context.pages()) {
      if (p.isClosed() || !p.url().includes('/bron')) continue;
      await p.waitForLoadState('domcontentloaded').catch(() => {});
      await waitForLoad(p);
      const touristReady = await p.locator('#tourist1').count();
      const lastNameVisible = await p.locator('input[name="frm[People][1][LASTNAME_LNAME]"]').isVisible().catch(() => false);
      if (touristReady && lastNameVisible) return p;
      if (touristReady) {
        await p.locator('#tourist1').scrollIntoViewIfNeeded().catch(() => {});
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  let hint = '';
  try {
    const active = context.pages().find((p) => !p.isClosed() && p.url().includes('/bron')) || page;
    hint = (await active.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim().slice(0, 240);
  } catch (_) {}
  throw new Error(`Страница /bron без формы туриста. ${hint || 'Текст страницы пуст'}`);
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
  currentStep = 'Открытие search_tour';
  await page.goto('https://b2b.fstravel.by/search_tour', { waitUntil: 'load', timeout: 60000 });
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

  currentStep = 'Выбор города Минск';
  const cityFilter = page.locator('.TOWNFROMINC_chosen');
  await pickFilter(page, cityFilter, 'Минск');
  await afterStep(page, async () => {
    await assertChosenFilled(cityFilter, 'Минск');
  });

  currentStep = 'Выбор страны Египет';
  const countryFilter = page.locator('.STATEINC_chosen');
  await pickCountry(page, countryFilter, 'Египет');
  await afterStep(page, async () => {
    await assertChosenFilled(countryFilter, 'Египет');
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

  currentStep = 'Проверка всех фильтров перед поиском';
  selectedCheckin = await ensureFiltersBeforeSearch(page, {
    city: cityFilter,
    country: countryFilter,
    checkin: selectedCheckin,
  }, (name) => {
    currentStep = `Повтор: ${name}`;
    console.log(currentStep);
  });

  currentStep = 'Нажатие кнопки Искать';
  selectedCheckin = await searchUntilResults(page, selectedCheckin, (name) => {
    currentStep = `Повтор поиска: ${name}`;
    console.log(currentStep);
  });
  const priceBtn = page.locator('#scrollto td.td_price span').first();
  await expect(priceBtn).toBeVisible({ timeout: 5000 });

  currentStep = 'Выбор тура по цене';
  await priceBtn.scrollIntoViewIfNeeded();

  const newPagePromise = context.waitForEvent('page', { timeout: 30000 }).catch(() => null);
  const sameTabNavPromise = page.waitForURL(/\/bron/, { timeout: 60000 }).catch(() => null);
  await priceBtn.click({ timeout: 10000 });

  const newPage = await newPagePromise;
  if (newPage && !newPage.isClosed()) {
    targetPage = newPage;
    await targetPage.waitForURL(/\/bron/, { timeout: 60000 }).catch(() => {});
  } else {
    await sameTabNavPromise;
    targetPage = page;
  }

  currentStep = 'Ожидание формы туриста';
  targetPage = await resolveBronPage(context, targetPage);
  await targetPage.locator('#tourist1').waitFor({ state: 'attached', timeout: 60000 });
  await targetPage.locator('#tourist1').scrollIntoViewIfNeeded();

  currentStep = 'Проверка даты тура';
  const actualCheckin = await targetPage.evaluate(() => {
    const table = document.querySelector('table.tour_info.res');
    return table ? table.getAttribute('data-checkin') : null;
  });
  if (actualCheckin && actualCheckin !== selectedCheckin) {
    console.log(`Дата тура ${actualCheckin}, в фильтре было ${selectedCheckin} — не ошибка`);
  }

  currentStep = 'Заполнение данных туриста 1';
  await fillTourist(targetPage, 1);

  currentStep = 'Заполнение данных туриста 2';
  await fillTourist(targetPage, 2);

  currentStep = 'Заполнение данных покупателя';
  await fillBuyer(targetPage);

  currentStep = 'Пересчёт стоимости';
  const bookBtn = targetPage.locator('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(4) > td > button.bron');
  await clickAndWait(targetPage, targetPage.locator('button.calc:has-text("Пересчитать")'));

  currentStep = 'Бронирование';
  if (targetPage.isClosed()) {
    targetPage = await resolveBronPage(context, page);
  }
  await bookBtn.waitFor({ state: 'visible', timeout: 60000 });
  await targetPage.waitForFunction(() => {
    const btn = document.querySelector('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(4) > td > button.bron');
    return btn && !btn.disabled;
  }, null, { timeout: 60000 });
  await clickAndWait(targetPage, bookBtn);

  currentStep = 'Подтверждение условий';
  const agreementBtn = targetPage.locator('#agreement');
  await Promise.race([
    agreementBtn.waitFor({ state: 'visible', timeout: 20000 }),
    targetPage.waitForFunction(
      () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText) || /CLAIM=\d+/i.test(location.href),
      null,
      { timeout: 20000 },
    ),
  ]).catch(() => {});
  if (await agreementBtn.isVisible().catch(() => false)) {
    await clickAndWait(targetPage, agreementBtn);
  }

  currentStep = 'Ожидание номера заявки';
  await targetPage.waitForFunction(
    () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText) || /CLAIM=\d+/i.test(location.href),
    null,
    { timeout: 90000 },
  );

  let orderNumber = 'не найден';
  let claimUrl = '';
  const pageText = await targetPage.evaluate(() => document.body.innerText);
  const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
  if (numMatch) orderNumber = numMatch[1];
  if (orderNumber === 'не найден') {
    const urlMatch = targetPage.url().match(/CLAIM=(\d+)/i);
    if (urlMatch) orderNumber = urlMatch[1];
  }

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

  await notifyBron({ name: 'CharterBY', ok: true, orderNumber, claimUrl });

  await browser.close();
  } catch (err) {
    let pageUrl = 'недоступен';
    try {
      const activePage = targetPage && !targetPage.isClosed() ? targetPage : page;
      if (activePage && !activePage.isClosed()) pageUrl = activePage.url();
    } catch (_) {}
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'CharterBY', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
