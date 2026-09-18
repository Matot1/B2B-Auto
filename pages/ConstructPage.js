const path = require('path');
const { expect } = require('@playwright/test');
const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { setAvailableDate, setDate, setDateDirect } = require('../object/zebraDatePicker.cjs');
const { notifyBron } = require('../notify.cjs');

async function closeDatePicker(page) {
  await page.keyboard.press('Escape');
  await page.locator('.Zebra_DatePicker.dp_visible').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

function isCircleIdle() {
  const el = document.querySelector('#samo-circle-preloader');
  if (!el) return true;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return true;
  const r = el.getBoundingClientRect();
  return r.width === 0 || r.height === 0;
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

async function reloadIfForbidden(page) {
  for (let i = 0; i < 3; i++) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (!/forbidden/i.test(text)) return;
    console.log('Страница Forbidden — обновляю');
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await waitLoadersIfAny(page);
  }
}

async function waitAfterAction(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

async function waitChosenHasOption(page, containerSelector, optionText, timeout = 30000) {
  await expect.poll(() => page.evaluate(({ sel, text }) => {
    const box = document.querySelector(sel);
    if (!box) return false;
    const trigger = box.querySelector('a.chosen-single');
    if (trigger && (trigger.innerText || '').includes(text)) return true;
    const select = box.previousElementSibling;
    if (select && select.tagName === 'SELECT') {
      return [...select.options].some((o) => (o.textContent || '').includes(text));
    }
    return [...box.querySelectorAll('li.active-result')].some((li) => (li.textContent || '').includes(text));
  }, { sel: containerSelector, text: optionText }), {
    timeout,
    message: `${containerSelector}: нет пункта «${optionText}»`,
  }).toBe(true);
}

async function selectChosen(page, containerSelector, optionText) {
  const container = page.locator(containerSelector);
  const trigger = container.locator('a.chosen-single').first();
  await trigger.waitFor({ state: 'visible', timeout: 30000 });
  await waitLoadersIfAny(page);
  const already = (await trigger.innerText()).replace(/\s+/g, ' ').trim();
  if (already.includes(optionText)) {
    return;
  }

  await waitChosenHasOption(page, containerSelector, optionText);
  await trigger.click();
  const search = container.locator('.chosen-search input');
  if (await search.count()) {
    const editable = await search.first().isEditable().catch(() => false);
    if (editable) {
      await search.first().fill(optionText);
    }
  }

  const option = container.locator('li.active-result').filter({ hasText: optionText }).first();
  await option.click();
  await page.keyboard.press('Escape');
  await waitLoadersIfAny(page);
  await expect(trigger).toContainText(optionText, { timeout: 15000 });
}

function addDays(dateStr, days) {
  const [day, month, year] = dateStr.split('.').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function isChosenEmpty(text) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  return !value || /^[-—–]+$/.test(value) || /^выберите/i.test(value);
}

async function getChosenDisplay(page, selector) {
  const trigger = page.locator(`${selector} a.chosen-single`).first();
  if (!(await trigger.count()) || !(await trigger.isVisible().catch(() => false))) {
    return '';
  }
  return (await trigger.innerText()).replace(/\s+/g, ' ').trim();
}

async function listChosenOptions(page, containerSelector) {
  const container = page.locator(containerSelector);
  const trigger = container.locator('a.chosen-single').first();
  await trigger.waitFor({ state: 'visible', timeout: 30000 });
  await page.keyboard.press('Escape');
  await waitAfterAction(page, 300);
  await trigger.click({ force: true });
  await waitAfterAction(page, 400);
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el && el.classList.contains('chosen-with-drop');
  }, containerSelector, { timeout: 10000 }).catch(() => {});
  const items = container.locator('li.active-result');
  const texts = [];
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    texts.push((await items.nth(i).innerText()).replace(/\s+/g, ' ').trim());
  }
  return { container, texts };
}

async function pickPrevBackFreightDate(page) {
  const dateInput = page.locator('#edit_order > div > fieldset > table > tbody > tr:nth-child(7) > td:nth-child(2) > span input').first();
  await dateInput.waitFor({ state: 'attached', timeout: 30000 });
  const current = (await dateInput.inputValue()).trim();
  if (!current) {
    throw new Error('Дата вылета обратно пустая, нельзя сдвинуть');
  }
  const prev = addDays(current, -1);
  const name = await dateInput.getAttribute('name');
  if (name) {
    await setDate(page, name, prev);
  } else {
    await dateInput.fill(prev, { force: true });
  }
  await closeDatePicker(page);
  await waitAfterAction(page, 2500);
}

async function ensureBackFreightClass(page) {
  const selector = '#ORDER_BACK_FREIGHTINC_CLASS_chosen';
  await page.locator(selector).waitFor({ state: 'visible', timeout: 60000 });
  const classRe = /econom|эконом/i;
  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { container, texts } = await listChosenOptions(page, selector);
    const good = texts.find((t) => classRe.test(t));
    if (good) {
      const option = container.locator('li.active-result').filter({ hasText: good }).first();
      await option.waitFor({ state: 'visible', timeout: 30000 });
      await option.click({ force: true });
      await page.keyboard.press('Escape');
      await waitAfterAction(page, 400);
      return;
    }
    await page.keyboard.press('Escape');
    if (attempt === maxAttempts) {
      throw new Error(`Класс мест ECONOM нет для выбора за 7 дат. Доступно: ${texts.join(' | ') || 'пусто'}`);
    }
    await pickPrevBackFreightDate(page);
  }
}

async function pickFreightWithSeats(page, selector, label) {
  const hasSeatsRe = /есть\s+места/i;
  const { container, texts } = await listChosenOptions(page, selector);
  const good = texts.find((t) => hasSeatsRe.test(t));
  if (!good) {
    throw new Error(`${label}: нет строк с «есть места». Доступно: ${texts.join(' | ') || 'пусто'}`);
  }
  const option = container.locator('li.active-result').filter({ hasText: good }).first();
  await option.waitFor({ state: 'visible', timeout: 30000 });
  await option.click({ force: true });
  await page.keyboard.press('Escape');
  await waitAfterAction(page, 400);
}

async function ensureOutboundFreightFilters(page) {
  await page.locator('#ORDER_TOWNTO_chosen').waitFor({ state: 'visible', timeout: 60000 });
  await waitAfterAction(page, 1500);

  const townTo = await getChosenDisplay(page, '#ORDER_TOWNTO_chosen');
  const classInc = await getChosenDisplay(page, '#ORDER_CLASSINC_chosen');
  const placeInc = await getChosenDisplay(page, '#ORDER_FRPLACEINC_chosen');
  const freightInc = await getChosenDisplay(page, '#ORDER_FREIGHTINC_chosen');
  const hasSeatsRe = /есть\s+места/i;

  const allFilled = !isChosenEmpty(townTo)
    && !isChosenEmpty(classInc)
    && !isChosenEmpty(placeInc)
    && !isChosenEmpty(freightInc);

  if (allFilled) {
    return;
  }

  if (isChosenEmpty(townTo)) {
    await selectChosen(page, '#ORDER_TOWNTO_chosen', 'Хургада');
  }
  if (isChosenEmpty(classInc)) {
    await selectChosen(page, '#ORDER_CLASSINC_chosen', 'ECONOM');
  }
  if (isChosenEmpty(placeInc)) {
    await selectChosen(page, '#ORDER_FRPLACEINC_chosen', 'Стандартное');
  }
  if (isChosenEmpty(freightInc) || !hasSeatsRe.test(freightInc)) {
    await pickFreightWithSeats(page, '#ORDER_FREIGHTINC_chosen', 'Транспорт');
  }
}

async function ensureBackFreightWithSeats(page) {
  const backCb = page.locator('#ORDER_BACK_FREIGHT_ENABLE');
  if (await backCb.count() && !(await backCb.isChecked())) {
    await backCb.check({ force: true });
    await waitAfterAction(page, 1000);
  }

  const selector = '#ORDER_BACK_FREIGHTINC_chosen';
  await page.locator(selector).waitFor({ state: 'visible', timeout: 60000 });

  const hasSeatsRe = /есть\s+места/i;
  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { container, texts } = await listChosenOptions(page, selector);
    const good = texts.find((t) => hasSeatsRe.test(t));
    if (good) {
      const option = container.locator('li.active-result').filter({ hasText: good }).first();
      await option.waitFor({ state: 'visible', timeout: 30000 });
      await option.click({ force: true });
      await page.keyboard.press('Escape');
      await waitAfterAction(page, 400);
      return;
    }
    await page.keyboard.press('Escape');
    if (attempt === maxAttempts) {
      throw new Error('Транспорт обратно: нет строк с «есть места» на 7 датах назад');
    }
    await pickPrevBackFreightDate(page);
  }
}

async function waitSaveOrderReady(page, timeout = 5000) {
  return page.waitForFunction(() => {
    const btn = document.querySelector('#edit_order > button');
    return Boolean(btn && !btn.disabled);
  }, { timeout }).then(() => true).catch(() => false);
}

async function saveFreightAndVerifyRows(page, saveOrderBtn) {
  const freightTableSel = '#cl_wizard > div:nth-child(5)';
  const freightTable = page.locator(freightTableSel);
  const freightDataRows = freightTable.locator('tr').filter({ has: page.locator('td') });
  const freightRowsBefore = await freightDataRows.count();
  await saveOrderBtn.click();

  await freightTable.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(({ selector, min }) => {
    const root = document.querySelector(selector);
    if (!root) return false;
    const rows = [...root.querySelectorAll('tr')].filter((tr) => tr.querySelector('td'));
    return rows.length >= min;
  }, { selector: freightTableSel, min: freightRowsBefore + 2 }, { timeout: 60000 });

  const freightRowsAfter = await freightDataRows.count();
  if (freightRowsAfter < freightRowsBefore + 2) {
    throw new Error(`Ожидалось +2 строки транспорта, было ${freightRowsBefore}, стало ${freightRowsAfter}`);
  }
}

async function checkFreightOrderFields(page) {
  const empty = [];
  const hasSeatsRe = /есть\s+места/i;
  const chosenFields = [
    { name: 'Город прилета', selector: '#ORDER_TOWNTO_chosen' },
    { name: 'Класс мест', selector: '#ORDER_CLASSINC_chosen' },
    { name: 'Размещение', selector: '#ORDER_FRPLACEINC_chosen' },
    { name: 'Транспорт', selector: '#ORDER_FREIGHTINC_chosen' },
  ];

  for (const field of chosenFields) {
    const value = await getChosenDisplay(page, field.selector);
    const filled = !isChosenEmpty(value);
    if (!filled) empty.push(field.name);
  }

  const backChecked = await page.locator('#ORDER_BACK_FREIGHT_ENABLE').isChecked().catch(() => false);
  if (!backChecked) empty.push('Чек-бокс "обратно"');

  const dateInput = page.locator('#edit_order > div > fieldset > table > tbody > tr:nth-child(7) > td:nth-child(2) > span input').first();
  const dateValue = (await dateInput.inputValue().catch(() => '')).trim();
  if (!dateValue) empty.push('Календарь даты вылета обратно');

  const classBack = await getChosenDisplay(page, '#ORDER_BACK_FREIGHTINC_CLASS_chosen');
  if (isChosenEmpty(classBack)) empty.push('Класс мест обратно');

  const freightBack = await getChosenDisplay(page, '#ORDER_BACK_FREIGHTINC_chosen');
  const freightBackNoSeats = !isChosenEmpty(freightBack) && !hasSeatsRe.test(freightBack);
  if (isChosenEmpty(freightBack)) empty.push('Транспорт обратно');
  if (freightBackNoSeats) empty.push('Транспорт обратно: нет «есть места»');

  const seatsCount = await getChosenDisplay(page, '#ORDER_COUNT_chosen');
  if (isChosenEmpty(seatsCount)) empty.push('Кол-во мест');

  return { empty, freightBackNoSeats };
}

async function runConstruct(page) {
  let currentStep = '';

  try {
  currentStep = 'Переход на сайт';
  await page.goto('/search_tour', { waitUntil: 'load', timeout: 60000 });
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
  });
  await reloadIfForbidden(page);

  currentStep = 'Переход на конструктор заявки';
  await page.goto('/cl_wizard?', { waitUntil: 'load', timeout: 60000 });
  await reloadIfForbidden(page);
  await afterStep(page, async () => {
    await expect(page.locator('#cl_wizard')).toBeVisible({ timeout: 30000 });
  });

  currentStep = 'Выбор города отправления Москва';
  const cityTrigger = page.locator('#cl_wizard > table.std.container.who_where > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td:nth-child(2) > div > a');
  await cityTrigger.waitFor({ state: 'visible', timeout: 30000 });
  await cityTrigger.click({ force: true });
  const cityOption = page.locator('.chosen-container-active .active-result').filter({ hasText: 'Москва' }).first();
  await cityOption.waitFor({ state: 'visible', timeout: 10000 });
  await cityOption.click({ force: true });
  await page.keyboard.press('Escape');
  await waitAfterAction(page, 2000);
  await page.locator('#STATE_chosen').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#STATE_chosen a.chosen-single').waitFor({ state: 'visible', timeout: 30000 });

  currentStep = 'Выбор страны пребывания Египет';
  const countryResponse = page.waitForResponse(
    (response) => response.url().includes('fstravel.com') && response.status() < 400,
    { timeout: 30000 },
  ).catch(() => null);
  await selectChosen(page, '#STATE_chosen', 'Египет');
  await countryResponse;
  if (await waitCircleAppear(page, 3000)) {
    await waitLoadersIfAny(page);
  }
  await afterStep(page, async () => {
    await expect(page.locator('#STATE_chosen a.chosen-single')).toContainText('Египет');
  });
  await page.waitForFunction(() => {
    const select = document.querySelector('select[name="TOURINC"]');
    return select && select.options && select.options.length > 1;
  }, { timeout: 30000 });

  currentStep = 'Выбор тура SL TOUR Hurghada MOW';
  await waitAfterAction(page, 1500);
  await selectChosen(page, '#TOURINC_chosen', 'SL TOUR Hurghada MOW');
  await waitAfterAction(page, 2000);

  currentStep = 'Выбор начала тура';
  await page.locator('#DATE_BEG').waitFor({ state: 'attached', timeout: 30000 });
  await page.locator('#DATE_BEG').scrollIntoViewIfNeeded();
  const selectedCheckin = await setAvailableDate(page, 'DATE_BEG', ['departure', 'dp_highlight']);
  console.log('Выбрана дата начала тура:', selectedCheckin);

  currentStep = 'Выбор окончания тура';
  const selectedCheckout = addDays(selectedCheckin, 7);
  await page.locator('#DATE_END').waitFor({ state: 'attached', timeout: 30000 });
  await setDate(page, 'DATE_END', selectedCheckout);
  console.log('Выбрана дата окончания тура:', selectedCheckout);

  currentStep = 'Удаление второго туриста';
  const removeSecondTourist = page.locator('#ALL_TOURIST > tr.odd > td:nth-child(6) > i');
  await removeSecondTourist.waitFor({ state: 'visible', timeout: 30000 });
  page.once('dialog', (dialog) => dialog.accept());
  await removeSecondTourist.click({ force: true });

  currentStep = 'Редактирование данных туриста';
  const editTourist = page.locator('#ALL_TOURIST > tr').first().locator('td:nth-child(5) > span');
  await editTourist.waitFor({ state: 'visible', timeout: 30000 });
  await editTourist.scrollIntoViewIfNeeded();
  await editTourist.click({ force: true });

  currentStep = 'Заполнение фамилии по-латински';
  const lastNameLatin = transliterate(faker.person.lastName()).toUpperCase();
  const lastNameInput = page.locator('#edit_tourist_form > fieldset:nth-child(1) > table > tbody > tr:nth-child(2) > td:nth-child(2) > input');
  await lastNameInput.waitFor({ state: 'visible', timeout: 30000 });
  await lastNameInput.click();
  await lastNameInput.clear();
  await lastNameInput.fill(lastNameLatin);

  currentStep = 'Заполнение имени по-латински';
  const firstNameLatin = transliterate(faker.person.firstName()).toUpperCase();
  const firstNameInput = page.locator('#edit_tourist_form > fieldset:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(2) > input');
  await firstNameInput.waitFor({ state: 'visible', timeout: 30000 });
  await firstNameInput.click();
  await firstNameInput.clear();
  await firstNameInput.fill(firstNameLatin);

  currentStep = 'Заполнение даты рождения';
  const bornWrap = page.locator('#edit_tourist_form > fieldset:nth-child(1) > table > tbody > tr:nth-child(4) > td:nth-child(2) > span');
  await bornWrap.waitFor({ state: 'visible', timeout: 30000 });
  const bornInput = bornWrap.locator('input').first();
  const bornName = await bornInput.getAttribute('name');
  if (bornName) {
    await setDateDirect(page, bornName, '01.01.2000');
  } else {
    await bornInput.fill('01.01.2000', { force: true });
  }
  await closeDatePicker(page);

  currentStep = 'Заполнение телефона';
  const phone = `7${faker.string.numeric(10)}`;
  const phoneInput = page.locator('#edit_tourist_form > fieldset:nth-child(1) > table > tbody > tr:nth-child(5) > td:nth-child(2) > input');
  await phoneInput.waitFor({ state: 'visible', timeout: 30000 });
  await phoneInput.click({ force: true });
  await phoneInput.clear();
  await phoneInput.fill(phone);

  currentStep = 'Заполнение e-mail';
  const email = `${faker.string.alphanumeric({ length: 10, casing: 'lower' })}@mail.ru`;
  const emailInput = page.locator('#edit_tourist_form > fieldset:nth-child(1) > table > tbody > tr:nth-child(6) > td:nth-child(2) > input');
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.click();
  await emailInput.clear();
  await emailInput.fill(email);

  currentStep = 'Выбор гражданства Россия';
  const nationalityTrigger = page.locator('#edit_tourist_form > fieldset:nth-child(2) > table > tbody > tr:nth-child(1) > td:nth-child(2) > div > a');
  await nationalityTrigger.waitFor({ state: 'visible', timeout: 30000 });
  await nationalityTrigger.click({ force: true });
  const nationalityOption = page.locator('.chosen-container-active .active-result').filter({ hasText: 'Россия' }).first();
  await nationalityOption.waitFor({ state: 'visible', timeout: 10000 });
  await nationalityOption.click({ force: true });
  await page.keyboard.press('Escape');

  currentStep = 'Выбор типа документа';
  const documentTrigger = page.locator('#edit_tourist_form > fieldset:nth-child(2) > table > tbody > tr:nth-child(2) > td:nth-child(2) > div > a');
  await documentTrigger.waitFor({ state: 'visible', timeout: 30000 });
  await documentTrigger.click({ force: true });
  const documentOption = page.locator('.chosen-container-active .active-result').filter({ hasText: 'Заграничный паспорт' }).first();
  await documentOption.waitFor({ state: 'visible', timeout: 10000 });
  await documentOption.click({ force: true });
  await page.keyboard.press('Escape');

  currentStep = 'Заполнение серии документа';
  const docSerieInput = page.locator('#edit_tourist_form > fieldset:nth-child(2) > table > tbody > tr:nth-child(3) > td:nth-child(2) > input');
  await docSerieInput.waitFor({ state: 'visible', timeout: 30000 });
  await docSerieInput.click();
  await docSerieInput.clear();
  await docSerieInput.fill(faker.string.numeric(2));

  currentStep = 'Заполнение номера документа';
  const docNumberInput = page.locator('#edit_tourist_form > fieldset:nth-child(2) > table > tbody > tr:nth-child(4) > td:nth-child(2) > input');
  await docNumberInput.waitFor({ state: 'visible', timeout: 30000 });
  await docNumberInput.click();
  await docNumberInput.clear();
  await docNumberInput.fill(faker.string.numeric(7));

  currentStep = 'Заполнение срока действия документа';
  const validInput = page.locator('#edit_tourist_form > fieldset:nth-child(2) > table > tbody > tr:nth-child(5) > td:nth-child(2) > span > input');
  await validInput.waitFor({ state: 'visible', timeout: 30000 });
  const validName = await validInput.getAttribute('name');
  if (validName) {
    await setDateDirect(page, validName, '01.01.2032');
  } else {
    await validInput.fill('01.01.2032', { force: true });
  }
  await closeDatePicker(page);

  currentStep = 'Сохранение данных туриста';
  const saveTouristBtn = page.locator('#edit_tourist > button');
  await saveTouristBtn.waitFor({ state: 'visible', timeout: 30000 });
  await saveTouristBtn.click();

  currentStep = 'Нажатие кнопки Вперед';
  const nextBtn = page.locator('#NEXT');
  await nextBtn.waitFor({ state: 'visible', timeout: 30000 });
  await nextBtn.click();

  currentStep = 'Проверка перехода на шаг 2';
  await page.waitForURL(/samo_action=STEP2load/, { timeout: 60000 });
  const step2Url = page.url();
  if (!step2Url.includes('samo_action=STEP2load')) {
    throw new Error(`Не перешли на шаг 2. URL: ${step2Url}`);
  }

  currentStep = 'Нажатие кнопки Заказ гостиницы';
  const hotelOrderBtn = page.locator('#ORDER_BTN_HOTEL');
  await hotelOrderBtn.waitFor({ state: 'visible', timeout: 30000 });
  await hotelOrderBtn.click();

  currentStep = 'Ожидание окна гостиниц';
  const searchHotelsBtn = page.locator('#searchHotelsRooms');
  await searchHotelsBtn.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('#searchHotelsRooms');
    if (!btn) return false;
    const style = window.getComputedStyle(btn);
    return !btn.disabled
      && style.display !== 'none'
      && style.visibility !== 'hidden';
  }, { timeout: 60000 });

  currentStep = 'Нажатие кнопки Искать в окне гостиниц';
  await searchHotelsBtn.click();

  currentStep = 'Ожидание списка гостиниц';
  const hotelsList = page.locator('#roomsHotelsListBlock');
  await hotelsList.waitFor({ state: 'visible', timeout: 60000 });
  const firstHotel = page.locator('#roomsHotelsList .hotelGDS').first();
  await firstHotel.waitFor({ state: 'visible', timeout: 60000 });

  currentStep = 'Открытие вариантов комнат';
  await firstHotel.scrollIntoViewIfNeeded();
  await firstHotel.click({ force: true });

  currentStep = 'Выбор варианта комнаты';
  const firstRoomOption = page.locator('[id^="roomsHotelGDS"] > label > div').first();
  await firstRoomOption.waitFor({ state: 'visible', timeout: 60000 });
  await firstRoomOption.click({ force: true });
  const roomSelected = await page.evaluate(() => {
    const option = document.querySelector('[id^="roomsHotelGDS"] > label > div');
    const radio = option && option.closest('label') && option.closest('label').querySelector('input[type="radio"]');
    if (!radio) return false;
    radio.checked = true;
    radio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    radio.dispatchEvent(new Event('input', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) {
      window.jQuery(radio).prop('checked', true).trigger('click').trigger('change');
    }
    return radio.checked;
  });
  if (!roomSelected) {
    throw new Error('Радиокнопка комнаты не выбрана');
  }

  currentStep = 'Сохранение гостиницы';
  const addHotelBtn = page.locator('#addHotel');
  await addHotelBtn.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('#addHotel');
    return Boolean(btn && !btn.disabled);
  }, { timeout: 30000 });
  await addHotelBtn.click();

  currentStep = 'Проверка гостиницы в таблице Заказы';
  const hotelOrderRow = page.locator('#ALL_ORDER tr[data-order-type="HGDS"]');
  await hotelOrderRow.first().waitFor({ state: 'visible', timeout: 60000 });

  currentStep = 'Нажатие кнопки Заказ транспорта';
  const freightOrderBtn = page.locator('#ORDER_BTN_FREIGHT');
  await freightOrderBtn.waitFor({ state: 'visible', timeout: 30000 });
  await freightOrderBtn.click();
  await page.locator('#edit_order').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('#ORDER_TOWNFROM_chosen').waitFor({ state: 'visible', timeout: 60000 });
  if (await waitCircleAppear(page, 3000)) {
    await waitLoadersIfAny(page);
  }
  await waitLoadersIfAny(page);
  await waitChosenHasOption(page, '#ORDER_TOWNFROM_chosen', 'Москва', 30000);

  currentStep = 'Выбор города вылета Москва';
  await selectChosen(page, '#ORDER_TOWNFROM_chosen', 'Москва');
  await afterStep(page, async () => {
    await expect(page.locator('#ORDER_TOWNFROM_chosen a.chosen-single')).toContainText('Москва');
  });

  currentStep = 'Проверка фильтров транспорта туда';
  await ensureOutboundFreightFilters(page);

  currentStep = 'Выбор класса мест ECONOM';
  const backFreightCb = page.locator('#ORDER_BACK_FREIGHT_ENABLE');
  if (await backFreightCb.count() && !(await backFreightCb.isChecked())) {
    await backFreightCb.check({ force: true });
    await waitAfterAction(page, 800);
  }
  await page.locator('#ORDER_BACK_FREIGHTINC_CLASS_chosen').waitFor({ state: 'visible', timeout: 60000 });
  await waitAfterAction(page, 1000);
  await ensureBackFreightClass(page);

  currentStep = 'Проверка транспорта обратно';
  await waitAfterAction(page, 1000);
  await ensureBackFreightWithSeats(page);

  currentStep = 'Проверка кнопки Сохранить';
  const saveOrderBtn = page.locator('#edit_order > button');
  await saveOrderBtn.waitFor({ state: 'visible', timeout: 10000 });
  let saveOrderReady = await waitSaveOrderReady(page, 5000);

  if (!saveOrderReady) {
    currentStep = 'Проверка полей заказа транспорта';
    const { empty, freightBackNoSeats } = await checkFreightOrderFields(page);
    if (freightBackNoSeats || empty.includes('Транспорт обратно')) {
      currentStep = 'Проверка транспорта обратно';
      await ensureBackFreightWithSeats(page);
    }
    saveOrderReady = await waitSaveOrderReady(page, 5000);
  }

  if (saveOrderReady) {
    currentStep = 'Сохранение заказа транспорта';
    await saveFreightAndVerifyRows(page, saveOrderBtn);
  } else {
    throw new Error('Кнопка Сохранить недоступна после проверки полей заказа транспорта');
  }

  currentStep = 'Нажатие кнопки Вперед';
  const nextAfterFreightBtn = page.locator('#NEXT');
  await nextAfterFreightBtn.waitFor({ state: 'visible', timeout: 30000 });
  await nextAfterFreightBtn.click();

  currentStep = 'Выбор туриста из заявки';
  const touristFromClaim = page.locator('#cl_wizard > table > tbody > tr:nth-child(2) > td > div.CLAIMINFO.WITHBUYER > div:nth-child(1) > fieldset > div > fieldset > table > tbody > tr:nth-child(2) > td:nth-child(2) > div');
  await touristFromClaim.waitFor({ state: 'visible', timeout: 60000 });
  const touristFromClaimTrigger = touristFromClaim.locator('a.chosen-single').first();
  await touristFromClaimTrigger.waitFor({ state: 'visible', timeout: 30000 });
  await touristFromClaimTrigger.click({ force: true });
  await waitAfterAction(page, 500);
  const touristFromClaimOption = touristFromClaim.locator('li.active-result')
    .filter({ hasText: lastNameLatin })
    .first();
  if (await touristFromClaimOption.count()) {
    await touristFromClaimOption.waitFor({ state: 'visible', timeout: 30000 });
    await touristFromClaimOption.click({ force: true });
  } else {
    const firstTouristOption = page.locator('.chosen-container-active li.active-result').filter({
      hasNotText: /^[-—–]+$/,
    }).first();
    await firstTouristOption.waitFor({ state: 'visible', timeout: 30000 });
    await firstTouristOption.click({ force: true });
  }
  await page.keyboard.press('Escape');

  currentStep = 'Заполнение имени как в документе';
  const buyerFirstNameInput = page.locator('#cl_wizard > table > tbody > tr:nth-child(2) > td > div.CLAIMINFO.WITHBUYER > div:nth-child(1) > fieldset > div > fieldset > table > tbody > tr:nth-child(3) > td:nth-child(2) > input');
  await buyerFirstNameInput.waitFor({ state: 'visible', timeout: 30000 });
  await buyerFirstNameInput.click();
  await buyerFirstNameInput.clear();
  await buyerFirstNameInput.fill(firstNameLatin);

  currentStep = 'Заполнение фамилии как в документе';
  const buyerLastNameInput = page.locator('#cl_wizard > table > tbody > tr:nth-child(2) > td > div.CLAIMINFO.WITHBUYER > div:nth-child(1) > fieldset > div > fieldset > table > tbody > tr:nth-child(4) > td:nth-child(2) > input');
  await buyerLastNameInput.waitFor({ state: 'visible', timeout: 30000 });
  await buyerLastNameInput.click();
  await buyerLastNameInput.clear();
  await buyerLastNameInput.fill(lastNameLatin);

  currentStep = 'Заполнение адреса покупателя';
  const buyerCity = faker.location.city();
  const buyerAddressInput = page.locator('#cl_wizard > table > tbody > tr:nth-child(2) > td > div.CLAIMINFO.WITHBUYER > div:nth-child(1) > fieldset > div > fieldset > table > tbody > tr:nth-child(7) > td:nth-child(2) > input');
  await buyerAddressInput.waitFor({ state: 'visible', timeout: 30000 });
  await buyerAddressInput.click();
  await buyerAddressInput.clear();
  await buyerAddressInput.fill(buyerCity);

  currentStep = 'Нажатие кнопки Вперед';
  const nextAfterBuyerBtn = page.locator('#NEXT');
  await nextAfterBuyerBtn.waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(() => {
    const btn = document.querySelector('#NEXT');
    if (!btn) throw new Error('#NEXT не найден');
    btn.click();
  });

  currentStep = 'Проверка бронирования заявки';
  await page.waitForFunction(
    () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText),
    { timeout: 90000 },
  );
  const pageText = await page.evaluate(() => document.body.innerText);
  const orderMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
  const orderNumber = orderMatch ? orderMatch[1] : 'не найден';
  const claimUrl = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.textContent.includes('Посмотреть заявку')) return a.href;
    }
    return '';
  });
  if (orderNumber === 'не найден') {
    throw new Error('Заявка не забронирована: номер не найден');
  }
  console.log('Номер заявки:', orderNumber, 'Ссылка:', claimUrl);
  await notifyBron({ name: 'Construct', ok: true, orderNumber, claimUrl });
  } catch (err) {
    let pageUrl = 'недоступен';
    try {
      if (page && !page.isClosed()) pageUrl = page.url();
    } catch (_) {}
    console.error(`❌ Ошибка на шаге "${currentStep}": ${err.message}\nURL: ${pageUrl}`);
    await notifyBron({ name: 'Construct', ok: false, step: currentStep, error: err.message, url: pageUrl });
    throw err;
  }
}

module.exports = { runConstruct };
