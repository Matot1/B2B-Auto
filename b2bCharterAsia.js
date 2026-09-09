const { chromium } = require('playwright');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config();
const { setAvailableDate, setDateDirect } = require('./object/zebraDatePicker.cjs');
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

  console.log(`Турист ${index}: MR/MRS/CHD/INF`);
  await selectChosenByName(page, `${prefix}[HUMAN]`, 'MRS');

  console.log(`Турист ${index}: фамилия`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[LASTNAME_LNAME]"]`),
    transliterate(faker.person.lastName()).toUpperCase(),
  );

  console.log(`Турист ${index}: имя`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[FIRSTNAME_LNAME]"]`),
    transliterate(faker.person.firstName()).toUpperCase(),
  );

  console.log(`Турист ${index}: дата рождения`);
  await setDateDirect(page, `${prefix}[BORN]`, '01.01.2000');

  console.log(`Турист ${index}: гражданство`);
  await selectChosenByName(page, `${prefix}[NATIONALITY]`, 'Россия');

  console.log(`Турист ${index}: тип документа`);
  await selectChosenByName(page, `${prefix}[IDENTITY_DOCUMENT]`, 'Заграничный паспорт');

  console.log(`Турист ${index}: серия документа`);
  await fillInputValue(page.locator(`input[name="${prefix}[PSERIE]"]`), faker.string.numeric(2));

  console.log(`Турист ${index}: номер документа`);
  await fillInputValue(page.locator(`input[name="${prefix}[PNUMBER]"]`), faker.string.numeric(7));

  console.log(`Турист ${index}: срок действия`);
  await setDateDirect(page, `${prefix}[PVALID]`, '01.01.2031');

  console.log(`Турист ${index}: документ выдан`);
  await setDateDirect(page, `${prefix}[PGIVEN]`, '10.10.2024');

  console.log(`Турист ${index}: кем выдан`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[PGIVENORG]"]`),
    faker.string.alphanumeric({ length: 8, casing: 'upper' }),
  );

  console.log(`Турист ${index}: виза`);
  await selectChosenByName(page, `VISA[${index}]`, 'Своя виза');
}

async function waitForLoad(page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

async function waitForFiltersSettle(page, ms = 4000) {
  await waitForLoad(page, 60000);
  await page.waitForTimeout(ms);
}

async function getChosenText(page, containerSelector) {
  const trigger = page.locator(`${containerSelector} a.chosen-single`).first();
  if (!(await trigger.count())) return '';
  return (await trigger.innerText()).replace(/\s+/g, ' ').trim();
}

async function clickAndWait(page, locator, options = {}) {
  const { timeout = 60000, clickOptions = {} } = options;
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('fstravel.asia') && response.status() < 400,
    { timeout },
  ).catch(() => null);

  await locator.click(clickOptions);
  await responsePromise;
  await waitForLoad(page, timeout);
}

async function clickSearchAndWaitForResults(page, options = {}) {
  const { resultTimeout = 60000, maxAttempts = 2 } = options;
  const searchBtn = page.locator('button.load.right:has-text("Искать")');
  const resultsBlock = page.locator('#scrollto');
  const priceBtn = page.locator('#scrollto td.td_price span').first();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      console.log('Ожидание результатов поиска...');
    } else {
      console.log('Результаты не найдены — повторное нажатие «Искать»');
    }

    const searchResponse = page.waitForResponse(
      (response) => response.url().includes('fstravel.asia') && response.status() < 400,
      { timeout: resultTimeout },
    ).catch(() => null);

    await searchBtn.click({ force: true });
    await searchResponse;
    await waitForLoad(page, resultTimeout);

    try {
      await resultsBlock.waitFor({ state: 'visible', timeout: resultTimeout });
      await priceBtn.waitFor({ state: 'visible', timeout: resultTimeout });
      return priceBtn;
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw new Error('Таблица результатов с кнопками цен не появилась после повторного поиска');
      }
    }
  }
}

async function selectChosenOption(page, openLocator, optionText, options = {}) {
  const { timeout = 30000, settleMs = 4000 } = options;
  await openLocator.scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await openLocator.click({ force: true });
  const option = page.locator('.chosen-container-active .active-result').filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout });
  await option.click({ force: true });
  await waitForFiltersSettle(page, settleMs);
}

async function resolveBronPage(context, page) {
  for (let i = 0; i < 60; i++) {
    for (const p of context.pages()) {
      if (!p.isClosed() && p.url().includes('/bron')) {
        await p.waitForLoadState('domcontentloaded').catch(() => {});
        await waitForLoad(p);
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
  let targetPage = page;

  try {
  await page.goto('https://b2b.fstravel.asia/search_tour', { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('.TOWNFROMINC_chosen').waitFor({ state: 'visible', timeout: 30000 });

  currentStep = 'Авторизация на сайте';
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.getByLabel('Краткое имя').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await clickAndWait(page, page.locator('button:has-text("Войти")'));

  currentStep = 'Выбор города Астана';
  await selectChosenOption(
    page,
    page.locator('.TOWNFROMINC_chosen .chosen-single'),
    'Астана',
  );

  currentStep = 'Выбор страны Египет';
  for (let attempt = 1; attempt <= 3; attempt++) {
    await selectChosenOption(
      page,
      page.locator('.STATEINC_chosen .chosen-single'),
      'Египет',
      { settleMs: 5000 },
    );
    const country = await getChosenText(page, '.STATEINC_chosen');
    console.log(`Страна после выбора (попытка ${attempt}):`, country);
    if (country.includes('Египет')) break;
    if (attempt === 3) {
      throw new Error(`Страна сбросилась. Сейчас: "${country}"`);
    }
    console.log('Страна сбросилась — выбираю Египет снова');
  }

  currentStep = 'Выбор группы тура';
  const tourGroupFilter = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr:nth-child(1) > td.tour_right');
  await tourGroupFilter.locator('.chosen-single').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await selectChosenOption(
    page,
    tourGroupFilter.locator('.chosen-single'),
    'Чартер/блочная перевозка',
    { settleMs: 4000 },
  );
  const countryAfterGroup = await getChosenText(page, '.STATEINC_chosen');
  if (!countryAfterGroup.includes('Египет')) {
    throw new Error(`После группы тура страна снова "${countryAfterGroup}"`);
  }

  currentStep = 'Прокрутка страницы';
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator('input[name="CHECKIN_BEG"]').waitFor({ state: 'visible', timeout: 10000 });

  currentStep = 'Установка даты вылета';
  const selectedCheckin = await setAvailableDate(page, 'CHECKIN_BEG', 'yesplace');
  console.log('Выбрана дата вылета:', selectedCheckin);

  currentStep = 'Снятие чек-бокса группировать результаты';
  const groupCheckbox = page.locator('label:has-text("группировать результаты")').locator('input[type="checkbox"]');
  if (await groupCheckbox.isChecked()) {
    await groupCheckbox.uncheck();
  }

  currentStep = 'Нажатие кнопки Искать';
  const priceBtn = await clickSearchAndWaitForResults(page);

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

  targetPage = await resolveBronPage(context, targetPage);
  await targetPage.locator('#tourist1').waitFor({ state: 'attached', timeout: 60000 });

  currentStep = 'Проверка даты тура';
  const actualCheckin = await targetPage.evaluate(() => {
    const table = document.querySelector('table.tour_info.res');
    return table ? table.getAttribute('data-checkin') : null;
  });
  if (actualCheckin !== selectedCheckin) {
    throw new Error(`выбрана неподходящая дата тура. Ожидалось: ${selectedCheckin}, получено: ${actualCheckin || 'не найдена'}`);
  }

  currentStep = 'Заполнение данных туриста 1';
  await fillTourist(targetPage, 1);

  currentStep = 'Заполнение данных туриста 2';
  await fillTourist(targetPage, 2);

  currentStep = 'Пересчёт стоимости';
  const bookBtn = targetPage.locator('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(6) > td > button.bron');
  await clickAndWait(targetPage, targetPage.locator('button.calc:has-text("Пересчитать")'));

  currentStep = 'Бронирование';
  await bookBtn.waitFor({ state: 'visible', timeout: 60000 });
  await targetPage.waitForFunction(() => {
    const btn = document.querySelector('#bron_info > div.top_container > div.PRICEINFO > fieldset > table:nth-child(4) > tbody > tr:nth-child(6) > td > button.bron');
    return btn && !btn.disabled;
  }, { timeout: 60000 });
  await clickAndWait(targetPage, bookBtn);

  currentStep = 'Подтверждение условий';
  const agreementBtn = targetPage.locator('#agreement');
  await agreementBtn.waitFor({ state: 'visible', timeout: 30000 });
  await clickAndWait(targetPage, agreementBtn);

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
  await notifyBron({ name: 'CharterAsia', ok: true, orderNumber, claimUrl });

  await browser.close();
  } catch (err) {
    let pageUrl = 'недоступен';
    try {
      const activePage = targetPage && !targetPage.isClosed() ? targetPage : page;
      if (activePage && !activePage.isClosed()) pageUrl = activePage.url();
    } catch (_) {}
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'CharterAsia', ok: false, step: currentStep, error: err.message, url: pageUrl });
  }
})();
