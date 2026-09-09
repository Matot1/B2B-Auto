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

  const lastNameRu = faker.person.lastName();
  const firstNameRu = faker.person.firstName();

  console.log(`Турист ${index}: MR/MRS/CHD/INF`);
  await selectChosenByName(page, `${prefix}[HUMAN]`, 'MRS');

  console.log(`Турист ${index}: фамилия`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[LASTNAME_LNAME]"]`),
    transliterate(lastNameRu).toUpperCase(),
  );

  console.log(`Турист ${index}: имя`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[FIRSTNAME_LNAME]"]`),
    transliterate(firstNameRu).toUpperCase(),
  );

  console.log(`Турист ${index}: фамилия (как в документе)`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[LASTNAME_NAME]"]`),
    lastNameRu,
  );

  console.log(`Турист ${index}: имя по-русски`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[FIRSTNAME_NAME]"]`),
    firstNameRu,
  );

  console.log(`Турист ${index}: ИНН`);
  await fillInputValue(
    page.locator(`input[name="${prefix}[INN]"]`),
    '0700014746',
  );

  console.log(`Турист ${index}: дата рождения`);
  await setDateDirect(page, `${prefix}[BORN]`, '01.01.2000');

  console.log(`Турист ${index}: гражданство`);
  await selectChosenByName(page, `${prefix}[NATIONALITY]`, 'Беларусь');

  console.log(`Турист ${index}: тип документа`);
  await selectChosenByName(page, `${prefix}[IDENTITY_DOCUMENT]`, 'Заграничный паспорт');

  console.log(`Турист ${index}: серия документа`);
  await fillInputValue(page.locator(`input[name="${prefix}[PSERIE]"]`), faker.string.alpha({ length: 2, casing: 'upper' }));

  console.log(`Турист ${index}: номер документа`);
  await fillInputValue(page.locator(`input[name="${prefix}[PNUMBER]"]`), faker.string.numeric(7));

  console.log(`Турист ${index}: срок действия`);
  await setDateDirect(page, `${prefix}[PVALID]`, '01.01.2031');

  console.log(`Турист ${index}: документ выдан`);
  await setDateDirect(page, `${prefix}[PGIVEN]`, '10.10.2024');
}

async function fillBuyer(page) {
  const lastNameRu = faker.person.lastName();
  const firstNameRu = faker.person.firstName();

  console.log('Покупатель: фамилия (как в документе)');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(1) > td:nth-child(2) > input'),
    transliterate(lastNameRu).toUpperCase(),
  );

  console.log('Покупатель: имя (как в документе)');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(2) > td:nth-child(2) > input'),
    transliterate(firstNameRu).toUpperCase(),
  );

  console.log('Покупатель: адрес');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(6) > td:nth-child(2) > input'),
    faker.location.city(),
  );

  console.log('Покупатель: серия паспорта');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(7) > td:nth-child(2) > input'),
    faker.string.numeric(4),
  );

  console.log('Покупатель: номер паспорта');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(8) > td:nth-child(2) > input'),
    faker.string.numeric(6),
  );

  console.log('Покупатель: e-mail');
  await fillInputValue(
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(10) > td:nth-child(2) > input'),
    `${faker.string.alphanumeric({ length: 10, casing: 'lower' })}@mail.ru`,
  );

  console.log('Покупатель: гражданство');
  await selectChosenOption(
    page,
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(11) > td:nth-child(2) > div > a'),
    'Беларусь',
  );

  console.log('Покупатель: тип документа');
  await selectChosenOption(
    page,
    page.locator('#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody > tr:nth-child(12) > td:nth-child(2) > div > a'),
    'Заграничный паспорт',
  );
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
      (response) => response.url().includes('fstravel.by') && response.status() < 400,
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
  await page.goto('https://b2b.fstravel.by/search_tour', { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('.TOWNFROMINC_chosen').waitFor({ state: 'visible', timeout: 30000 });

  currentStep = 'Авторизация на сайте';
  await page.locator('a.login-action:has-text("Вход")').click();
  await page.getByLabel('Краткое имя').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByLabel('Краткое имя').fill(process.env.LOGIN);
  await page.getByLabel('Пароль').fill(process.env.PASSWORD);
  await clickAndWait(page, page.locator('button:has-text("Войти")'));

  currentStep = 'Выбор города Минск';
  await selectChosenOption(
    page,
    page.locator('.TOWNFROMINC_chosen .chosen-single'),
    'Минск',
  );

  currentStep = 'Выбор страны Египет';
  await selectChosenOption(
    page,
    page.locator('.STATEINC_chosen .chosen-single'),
    'Египет',
  );

  currentStep = 'Прокрутка страницы';
  if (page.isClosed()) {
    throw new Error('Страница закрыта после выбора страны. Не закрывай окно браузера во время прогона.');
  }
  const checkinInput = page.locator('input[name="CHECKIN_BEG"]');
  await checkinInput.waitFor({ state: 'attached', timeout: 30000 });
  await checkinInput.scrollIntoViewIfNeeded();
  await checkinInput.waitFor({ state: 'visible', timeout: 10000 });

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
  }, { timeout: 60000 });
  await bookBtn.click();

  currentStep = 'Подтверждение условий';
  const agreementBtn = targetPage.locator('#agreement');
  const agreementVisible = await agreementBtn.isVisible().catch(() => false);
  if (agreementVisible) {
    await agreementBtn.click();
  } else {
    console.log('Кнопка #agreement нет — жду номер заявки');
  }

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
