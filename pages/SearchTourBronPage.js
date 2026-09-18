const { expect } = require('@playwright/test');
const { setDate: setZebraDate, setAvailableDate } = require('../object/zebraDatePicker.cjs');

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

function nextDay(dateStr) {
  const [d, m, y] = dateStr.split('.').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

class SearchTourBronPage {
  constructor(page) {
    this.page = page;
    this.loginButton = page.locator('a.login-action:has-text("Вход")');
    this.loginOrCountry = page.locator('a.login-action:has-text("Вход"), .STATEINC_chosen').first();
    this.username = page.getByLabel('Краткое имя');
    this.password = page.getByLabel('Пароль');
    this.submit = page.locator('button:has-text("Войти")');
    this.city = page.locator('.TOWNFROMINC_chosen');
    this.country = page.locator('.STATEINC_chosen');
    this.freight = page.locator('.FREIGHTTYPE_chosen');
    this.tour = page.locator('.TOURINC_chosen');
    this.adults = page.locator('.ADULT_chosen');
    this.checkin = page.locator('input[name="CHECKIN_BEG"]');
    this.groupCheckbox = page.locator('label:has-text("группировать результаты")').locator('input[type="checkbox"]');
    this.promoCheckbox = page.locator('label:has-text("Не отображать PROMO")').locator('input[type="checkbox"]');
    this.price = page.locator('#scrollto td.td_price span').first();
  }

  async goto() {
    await this.page.goto('/search_tour', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  }

  async gotoAt(base) {
    await this.page.goto(`${base.replace(/\/$/, '')}/search_tour`, {
      waitUntil: 'load',
      timeout: 60000,
    });
  }

  async waitLoginVisible() {
    await this.afterStep(async () => {
      await expect(this.loginButton).toBeVisible({ timeout: 60000 });
    });
  }

  async waitLoaders(timeout = 30000) {
    if (await this.page.evaluate(isCircleIdle)) return;
    await expect.poll(() => this.page.evaluate(isCircleIdle), {
      timeout,
      message: 'Загрузка не завершилась',
    }).toBe(true);
  }

  async afterStep(check) {
    await check();
    await this.waitLoaders();
  }

  async waitCircleAppear(timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!(await this.page.evaluate(isCircleIdle))) return true;
      await this.page.waitForTimeout(100);
    }
    return false;
  }

  chosenTrigger(container) {
    return container.locator('a.chosen-single').first();
  }

  async assertChosenFilled(container, text) {
    await expect(this.chosenTrigger(container)).toContainText(text, {
      timeout: 5000,
      message: `Фильтр должен быть «${text}»`,
    });
  }

  async chosenHas(container, text) {
    const actual = await this.chosenTrigger(container).innerText().catch(() => '');
    return actual.includes(text);
  }

  async pickFilter(container, optionText) {
    const trigger = this.chosenTrigger(container);
    await trigger.click();
    await container.locator('li.active-result').filter({ hasText: optionText }).first().click();
    await this.page.keyboard.press('Escape');
    await expect(trigger).toContainText(optionText, { timeout: 15000 });

    await expect.poll(async () => {
      const state = await this.page.evaluate(pageReadyState);
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

  async pickCountry(container, optionText) {
    const trigger = this.chosenTrigger(container);
    await trigger.click();
    await container.locator('li.active-result').filter({ hasText: optionText }).first().click();
    await this.page.keyboard.press('Escape');
    await expect(trigger).toContainText(optionText, { timeout: 15000 });

    if (await this.waitCircleAppear(3000)) {
      await expect.poll(() => this.page.evaluate(isCircleIdle), {
        timeout: 30000,
        message: 'После страны загрузка не завершилась',
      }).toBe(true);
    }

    await expect(trigger).toContainText(optionText, { timeout: 5000 });
  }

  async waitOpened() {
    await this.afterStep(async () => {
      await expect(this.loginOrCountry).toBeVisible({ timeout: 30000 });
    });
  }

  async login(login, password) {
    await this.loginButton.click();
    await this.username.fill(login);
    await this.password.fill(password);
    await this.submit.click();
    await this.afterStep(async () => {
      await expect(this.username).toBeHidden({ timeout: 30000 });
      await expect(this.city).toBeVisible();
    });
  }

  async selectCity(text) {
    await this.pickFilter(this.city, text);
    await this.afterStep(async () => {
      await this.assertChosenFilled(this.city, text);
    });
  }

  async selectCountry(text) {
    await this.pickCountry(this.country, text);
    await this.afterStep(async () => {
      await this.assertChosenFilled(this.country, text);
    });
  }

  async selectFreight(text) {
    await this.pickFilter(this.freight, text);
    await this.afterStep(async () => {
      await this.assertChosenFilled(this.freight, text);
    });
  }

  async selectTour(text) {
    await this.tour.scrollIntoViewIfNeeded();
    await this.pickFilter(this.tour, text);
    await this.afterStep(async () => {
      await this.assertChosenFilled(this.tour, text);
    });
  }

  async scrollToDate() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.afterStep(async () => {
      await expect(this.checkin).toBeVisible();
    });
  }

  async setCheckin() {
    const selected = await setAvailableDate(this.page, 'CHECKIN_BEG', 'yesplace');
    await this.afterStep(async () => {
      await expect(this.checkin).toHaveValue(selected);
    });
    return selected;
  }

  async uncheckGroupResults() {
    if (await this.groupCheckbox.isChecked()) {
      await this.groupCheckbox.uncheck();
    }
    await this.afterStep(async () => {
      await expect(this.groupCheckbox).not.toBeChecked();
    });
  }

  async checkHidePromo() {
    if (!(await this.promoCheckbox.isChecked())) {
      await this.promoCheckbox.check();
    }
    await this.afterStep(async () => {
      await expect(this.promoCheckbox).toBeChecked();
    });
  }

  async clickSearch() {
    await this.page.evaluate(() => {
      const btn = document.querySelector('button.load.right');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  async ensureEgyptFilters(checkin, onRetry) {
    let date = checkin;
    let refills = 0;

    while (true) {
      await this.waitLoaders();

      const dateVal = await this.checkin.inputValue();
      let missing = null;
      if (!(await this.chosenHas(this.city, 'Москва'))) missing = 'city';
      else if (!(await this.chosenHas(this.country, 'Египет'))) missing = 'country';
      else if (!(await this.chosenHas(this.freight, 'Чартер/блочная перевозка'))) missing = 'freight';
      else if (!(await this.chosenHas(this.tour, 'Sharm'))) missing = 'tour';
      else if (dateVal !== date) missing = 'date';

      if (!missing) {
        await this.assertChosenFilled(this.city, 'Москва');
        await this.assertChosenFilled(this.country, 'Египет');
        await this.assertChosenFilled(this.freight, 'Чартер/блочная перевозка');
        await this.assertChosenFilled(this.tour, 'Sharm');
        await expect(this.checkin).toHaveValue(date);
        return date;
      }

      if (refills >= 3) {
        throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
      }
      refills += 1;

      if (missing === 'city') {
        onRetry('Выбор города Москва');
        await this.pickFilter(this.city, 'Москва');
      } else if (missing === 'country') {
        onRetry('Выбор страны Египет');
        await this.pickCountry(this.country, 'Египет');
      } else if (missing === 'freight') {
        onRetry('Выбор типа перевозки');
        await this.pickFilter(this.freight, 'Чартер/блочная перевозка');
      } else if (missing === 'tour') {
        onRetry('Выбор тура Egypt Sharm-El-Sheikh MOW');
        await this.tour.scrollIntoViewIfNeeded();
        await this.pickFilter(this.tour, 'Sharm');
      } else {
        onRetry('Установка даты вылета');
        date = await setAvailableDate(this.page, 'CHECKIN_BEG', 'yesplace');
      }
    }
  }

  async searchUntilPrices(checkin, onRetry) {
    let date = checkin;
    const maxTries = 7;

    for (let i = 0; i < maxTries; i++) {
      await this.clickSearch();
      await this.waitLoaders();
      const shown = await this.price.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (shown) return date;

      if (i === maxTries - 1) {
        throw new Error(`В #scrollto нет цен за ${maxTries} поисков`);
      }

      date = nextDay(date);
      onRetry(`нет цены в #scrollto, дата ${date}`);
      await setZebraDate(this.page, 'CHECKIN_BEG', date);
      await this.afterStep(async () => {
        await expect(this.checkin).toHaveValue(date);
      });
    }

    return date;
  }

  async expectPriceVisible() {
    await expect(this.price).toBeVisible({ timeout: 5000 });
  }

  async openBron(context) {
    await this.price.scrollIntoViewIfNeeded();
    const [bookingPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      this.price.click({ timeout: 10000 }),
    ]);
    return bookingPage || this.page;
  }

  async pickCountryRetry(container, optionText, attempts = 3) {
    const trigger = this.chosenTrigger(container);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await trigger.click();
      await container.locator('li.active-result').filter({ hasText: optionText }).first().click();
      await this.page.keyboard.press('Escape');
      await expect(trigger).toContainText(optionText, { timeout: 15000 });
      if (await this.waitCircleAppear(3000)) {
        await expect.poll(() => this.page.evaluate(isCircleIdle), {
          timeout: 30000,
          message: 'После страны загрузка не завершилась',
        }).toBe(true);
      }
      await this.waitLoaders();
      const text = (await trigger.innerText()).trim();
      if (text.includes(optionText)) return;
      console.log(`Страна сбросилась в «${text}», повтор ${attempt}`);
    }
    await expect(trigger).toContainText(optionText, { timeout: 5000 });
  }

  async pickTourExact(tourName) {
    await this.tour.scrollIntoViewIfNeeded();
    await this.chosenTrigger(this.tour).click();
    const tourSearch = this.tour.locator('.chosen-search input');
    if (await tourSearch.count()) {
      await tourSearch.fill(tourName);
    }
    const selectedTour = await this.page.evaluate((name) => {
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
    await expect(this.chosenTrigger(this.tour)).toContainText(tourName, { timeout: 15000 });
    await this.waitLoaders();
    await expect(this.chosenTrigger(this.tour)).toContainText(tourName, { timeout: 5000 });
  }

  async pickAdults(value) {
    await this.chosenTrigger(this.adults).click();
    await this.page.evaluate((want) => {
      const items = [...document.querySelectorAll('.ADULT_chosen .active-result')];
      const opt = items.find((el) => (el.textContent || '').trim() === want);
      if (!opt) {
        const available = items.map((el) => (el.textContent || '').trim()).join(' | ');
        throw new Error(`Опция "${want}" не найдена. Доступно: ${available || 'пусто'}`);
      }
      opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, value);
    const adultValue = await this.page.locator('select[name="ADULT"]').inputValue();
    if (adultValue !== value) {
      throw new Error(`После выбора взрослых ожидалось "${value}", получено "${adultValue}"`);
    }
    await this.waitLoaders();
  }

  async adultsIsOne() {
    const selectVal = await this.page.locator('select[name="ADULT"]').inputValue().catch(() => '');
    const text = (await this.chosenTrigger(this.adults).innerText().catch(() => '')).trim();
    return selectVal === '1' && text === '1';
  }

  async ensureGdsFilters(checkin, tourName, onRetry) {
    let date = checkin;
    let refills = 0;
    while (true) {
      await this.waitLoaders();
      const dateVal = await this.checkin.inputValue();
      let missing = null;
      if (!(await this.chosenHas(this.city, 'Москва'))) missing = 'city';
      else if (!(await this.chosenHas(this.country, 'Турция'))) missing = 'country';
      else if (!(await this.chosenHas(this.freight, 'GDS'))) missing = 'freight';
      else if (!(await this.chosenHas(this.tour, tourName))) missing = 'tour';
      else if (dateVal !== date) missing = 'date';
      else if (!(await this.adultsIsOne())) missing = 'adults';
      if (!missing) {
        await this.assertChosenFilled(this.city, 'Москва');
        await this.assertChosenFilled(this.country, 'Турция');
        await this.assertChosenFilled(this.freight, 'GDS');
        await this.assertChosenFilled(this.tour, tourName);
        await expect(this.checkin).toHaveValue(date);
        await expect(this.page.locator('select[name="ADULT"]')).toHaveValue('1');
        await expect(this.chosenTrigger(this.adults)).toHaveText('1');
        return date;
      }
      if (refills >= 3) {
        throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
      }
      refills += 1;
      if (missing === 'city') {
        onRetry('Выбор города Москва');
        await this.pickFilter(this.city, 'Москва');
      } else if (missing === 'country') {
        onRetry('Выбор страны Турция');
        await this.pickCountry(this.country, 'Турция');
      } else if (missing === 'freight') {
        onRetry('Выбор типа перевозки GDS');
        await this.pickFilter(this.freight, 'GDS');
      } else if (missing === 'tour') {
        onRetry(`Выбор тура ${tourName}`);
        await this.pickTourExact(tourName);
      } else if (missing === 'adults') {
        onRetry('Выбор количества взрослых: 1');
        await this.pickAdults('1');
      } else {
        onRetry('Установка даты вылета');
        date = await setAvailableDate(this.page, 'CHECKIN_BEG');
      }
    }
  }

  async ensureAsiaFilters(checkin, group, onRetry) {
    let date = checkin;
    let refills = 0;
    while (true) {
      await this.waitLoaders();
      const dateVal = await this.checkin.inputValue();
      let missing = null;
      if (!(await this.chosenHas(this.city, 'Астана'))) missing = 'city';
      else if (!(await this.chosenHas(this.country, 'Египет'))) missing = 'country';
      else if (!(await this.chosenHas(group, 'Чартер/блочная перевозка'))) missing = 'group';
      else if (dateVal !== date) missing = 'date';
      if (!missing) {
        await this.assertChosenFilled(this.city, 'Астана');
        await this.assertChosenFilled(this.country, 'Египет');
        await this.assertChosenFilled(group, 'Чартер/блочная перевозка');
        await expect(this.checkin).toHaveValue(date);
        return date;
      }
      if (refills >= 3) {
        throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
      }
      refills += 1;
      if (missing === 'city') {
        onRetry('Выбор города Астана');
        await this.pickFilter(this.city, 'Астана');
      } else if (missing === 'country') {
        onRetry('Выбор страны Египет');
        await this.pickCountryRetry(this.country, 'Египет');
      } else if (missing === 'group') {
        onRetry('Выбор группы тура');
        await this.pickFilter(group, 'Чартер/блочная перевозка');
      } else {
        onRetry('Установка даты вылета');
        date = await setAvailableDate(this.page, 'CHECKIN_BEG', 'yesplace');
      }
    }
  }

  async ensureByFilters(checkin, onRetry) {
    let date = checkin;
    let refills = 0;
    while (true) {
      await this.waitLoaders();
      const dateVal = await this.checkin.inputValue();
      let missing = null;
      if (!(await this.chosenHas(this.city, 'Минск'))) missing = 'city';
      else if (!(await this.chosenHas(this.country, 'Египет'))) missing = 'country';
      else if (dateVal !== date) missing = 'date';
      if (!missing) {
        await this.assertChosenFilled(this.city, 'Минск');
        await this.assertChosenFilled(this.country, 'Египет');
        await expect(this.checkin).toHaveValue(date);
        return date;
      }
      if (refills >= 3) {
        throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
      }
      refills += 1;
      if (missing === 'city') {
        onRetry('Выбор города Минск');
        await this.pickFilter(this.city, 'Минск');
      } else if (missing === 'country') {
        onRetry('Выбор страны Египет');
        await this.pickCountry(this.country, 'Египет');
      } else {
        onRetry('Установка даты вылета');
        date = await setAvailableDate(this.page, 'CHECKIN_BEG', 'yesplace');
      }
    }
  }

  async openBronOrSameTab(context) {
    await this.price.scrollIntoViewIfNeeded();
    const newPagePromise = context.waitForEvent('page', { timeout: 30000 }).catch(() => null);
    const sameTabNavPromise = this.page.waitForURL(/\/bron/, { timeout: 60000 }).catch(() => null);
    await this.price.click({ timeout: 10000 });
    const newPage = await newPagePromise;
    if (newPage && !newPage.isClosed()) {
      await newPage.waitForURL(/\/bron/, { timeout: 60000 }).catch(() => {});
      return newPage;
    }
    await sameTabNavPromise;
    return this.page;
  }

  async searchUntilPricesGds(checkin, onRetry) {
    let date = checkin;
    const maxTries = 7;
    for (let i = 0; i < maxTries; i++) {
      if (!(await this.adultsIsOne())) {
        onRetry('взрослые сбросились на 2, снова 1');
        await this.pickAdults('1');
      }
      await this.clickSearch();
      await this.waitLoaders();
      const shown = await this.price.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (shown) return date;
      if (i === maxTries - 1) {
        throw new Error(`В #scrollto нет цен за ${maxTries} поисков`);
      }
      date = nextDay(date);
      onRetry(`нет цены в #scrollto, пробуем дату ${date}`);
      await setZebraDate(this.page, 'CHECKIN_BEG', date);
      await this.waitLoaders();
      const actualDate = await this.checkin.inputValue();
      if (actualDate) date = actualDate;
      console.log('Дата в поле после сдвига:', date);
    }
    return date;
  }
}

module.exports = { SearchTourBronPage };
