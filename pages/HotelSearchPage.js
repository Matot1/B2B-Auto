const { expect } = require('@playwright/test');
const { setAvailableDate, setDateDirect } = require('../object/zebraDatePicker.cjs');
const { SearchTourBronPage } = require('./SearchTourBronPage.js');

function addDays(dateStr, days) {
  const [d, m, y] = dateStr.split('.').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

class HotelSearchPage {
  constructor(page) {
    this.page = page;
    this.core = new SearchTourBronPage(page);
    this.country = page.locator('.STATEINC_chosen');
    this.productType = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(1) > table > tbody > tr.producttype_filter > td.tour_right > div');
    this.program = page.locator('#search_tour > div.std.container > table.direction.panel > tbody > tr:nth-child(1) > td:nth-child(2) > table > tbody > tr.ptype_filter > td.tour_right > div');
    this.adults = page.locator('.ADULT_chosen');
    this.checkin = page.locator('input[name="CHECKIN_BEG"]');
    this.groupCheckbox = page.locator('label.hotelgroup:has-text("группировать результаты") input[name="PARTITION_PRICE"]');
    this.table = page.locator('#scrollto');
    this.price = page.locator('span.price.bron.price_button').first();
    this.searchBtn = page.locator('button.load:has-text("Искать")').first();
  }

  async goto() {
    await this.page.goto('/search_hotel', { waitUntil: 'load', timeout: 60000 });
  }

  async waitOpened() {
    await this.core.afterStep(async () => {
      await expect(this.core.loginButton).toBeVisible({ timeout: 60000 });
    });
  }

  async login(login, password) {
    await this.core.loginButton.click();
    await this.core.username.fill(login);
    await this.core.password.fill(password);
    await this.core.submit.click();
    await this.core.afterStep(async () => {
      await expect(this.core.username).toBeHidden({ timeout: 30000 });
      await expect(this.country).toBeVisible();
    });
  }

  async selectCountry(text) {
    await this.core.pickCountry(this.country, text);
    await this.core.afterStep(async () => {
      await this.core.assertChosenFilled(this.country, text);
    });
  }

  async selectProduct(text) {
    await this.core.pickFilter(this.productType, text);
    await this.core.afterStep(async () => {
      await this.core.assertChosenFilled(this.productType, text);
    });
  }

  async selectProgram(text) {
    await this.core.pickFilter(this.program, text);
    await this.core.afterStep(async () => {
      await this.core.assertChosenFilled(this.program, text);
    });
  }

  async hotelNights() {
    const raw = await this.page.locator('input[name="NIGHTS_FROM"], select[name="NIGHTS_FROM"]').first().inputValue().catch(() => '');
    const nights = parseInt(raw, 10);
    return nights > 0 ? nights : 7;
  }

  async applyHotelDate(date) {
    await this.core.closeCalendar();
    const endDate = addDays(date, await this.hotelNights());
    await setDateDirect(this.page, 'CHECKIN_BEG', date);
    if (await this.page.locator('input[name="CHECKIN_END"]').count()) {
      await setDateDirect(this.page, 'CHECKIN_END', endDate);
    }
    await this.core.waitAfterFilterAjax(3000, 15000);
    if ((await this.checkin.inputValue()) !== date) {
      await setDateDirect(this.page, 'CHECKIN_BEG', date);
      if (await this.page.locator('input[name="CHECKIN_END"]').count()) {
        await setDateDirect(this.page, 'CHECKIN_END', endDate);
      }
    }
    await expect(this.checkin).toHaveValue(date);
    return date;
  }

  async setCheckin() {
    let lastErr;
    for (let i = 1; i <= 5; i++) {
      try {
        const selected = await setAvailableDate(this.page, 'CHECKIN_BEG', '#ADC6F5');
        await this.applyHotelDate(selected);
        await this.logHotelFilters(`после даты, попытка ${i}`);
        return selected;
      } catch (err) {
        lastErr = err;
        console.log(`Дата заезда попытка ${i}/5: ${err.message}`);
        await this.core.closeCalendar();
      }
    }
    throw lastErr || new Error('Дата заезда не установилась за 5 попыток');
  }

  async logHotelFilters(where) {
    const country = await this.core.chosenText(this.country);
    const product = await this.core.chosenText(this.productType);
    const program = await this.core.chosenText(this.program);
    const adults = await this.core.chosenText(this.adults);
    const date = await this.checkin.inputValue().catch(() => '');
    console.log(`[отель ${where}] страна="${country}" продукт="${product}" программа="${program}" взрослые="${adults}" дата="${date}"`);
  }

  async selectAdults2() {
    await this.core.closeCalendar();
    if (await this.core.chosenHas(this.adults, '2')) {
      await this.logHotelFilters('взрослые уже 2');
      return;
    }
    await this.adults.locator('a.chosen-single').first().click({ timeout: 10000 });
    await this.adults.locator('.active-result:has-text("2")').first().click({ timeout: 10000 });
    await this.core.assertChosenFilled(this.adults, '2');
    await this.core.waitAfterFilterAjax();
    await this.logHotelFilters('после взрослых');
  }

  async uncheckGroupResults() {
    await this.core.closeCalendar();
    if (await this.groupCheckbox.isChecked()) {
      await this.groupCheckbox.uncheck();
    }
    await expect(this.groupCheckbox).not.toBeChecked();
    await this.core.waitAfterFilterAjax();
    await this.logHotelFilters('после группировки');
  }

  async ensureHotelFilters(checkin, onRetry) {
    let date = checkin;
    let refills = 0;
    while (true) {
      await this.core.waitLoaders();
      const dateVal = await this.checkin.inputValue();
      let missing = null;
      if (!(await this.core.chosenHas(this.country, 'Таиланд'))) missing = 'country';
      else if (!(await this.core.chosenHas(this.productType, 'Статика'))) missing = 'product';
      else if (!(await this.core.chosenHas(this.program, 'Стандарт'))) missing = 'program';
      else if (dateVal !== date) missing = 'date';
      else if (!(await this.core.chosenHas(this.adults, '2'))) missing = 'adults';
      await this.logHotelFilters(missing ? `перед поиском, пусто ${missing}` : 'перед поиском, все ок');
      if (!missing) {
        await this.core.assertChosenFilled(this.country, 'Таиланд');
        await this.core.assertChosenFilled(this.productType, 'Статика');
        await this.core.assertChosenFilled(this.program, 'Стандарт');
        await expect(this.checkin).toHaveValue(date);
        await this.core.assertChosenFilled(this.adults, '2');
        return date;
      }
      if (refills >= 3) {
        throw new Error(`Фильтр «${missing}» пустой после 3 повторов. Поиск не нажимаю.`);
      }
      refills += 1;
      if (missing === 'country') {
        onRetry('Выбор страны Таиланд');
        await this.core.pickCountry(this.country, 'Таиланд');
      } else if (missing === 'product') {
        onRetry('Выбор типа продукта Статика');
        await this.core.pickFilter(this.productType, 'Статика');
      } else if (missing === 'program') {
        onRetry('Выбор программы Стандарт');
        await this.core.pickFilter(this.program, 'Стандарт');
      } else if (missing === 'date') {
        onRetry('Установка даты заезда');
        await this.applyHotelDate(date);
      } else {
        onRetry('Выбор количества взрослых');
        await this.adults.locator('.chosen-single').click();
        await this.adults.locator('.active-result:has-text("2")').click();
      }
    }
  }

  async clickSearchAndWait() {
    await this.core.closeCalendar();
    await expect(this.searchBtn).toBeVisible({ timeout: 15000 });
    const prices = this.page.waitForResponse((res) => {
      const url = res.url();
      const body = res.request().postData() || '';
      const combined = `${url} ${body}`;
      return /samo_action=/i.test(combined) && (/PRICES/i.test(combined) || /search_hotel/.test(url));
    }, { timeout: 90000 });
    console.log('Жму Искать');
    await this.searchBtn.click();
    const res = await prices.catch(() => null);
    if (!res && !(await this.core.waitCircleAppear(5000))) {
      throw new Error('После «Искать» нет ответа search_hotel и кружок не появился');
    }
    await this.core.waitLoaders(90000);
  }

  async searchUntilTable(checkin, onRetry) {
    let date = checkin;
    const maxTries = 7;
    for (let i = 0; i < maxTries; i++) {
      await this.clickSearchAndWait();
      const shown = await this.table.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (shown) return date;
      if (i === maxTries - 1) {
        throw new Error(`Таблица #scrollto не появилась за ${maxTries} поисков`);
      }
      const [d, m, y] = date.split('.').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      date = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
      onRetry(`нет #scrollto, дата ${date}`);
      await this.applyHotelDate(date);
      await this.core.afterStep(async () => {
        await expect(this.checkin).toHaveValue(date);
      });
    }
    return date;
  }

  async expectPrice() {
    await this.core.afterStep(async () => {
      await expect(this.table).toBeVisible();
      await expect(this.price).toBeVisible({ timeout: 60000 });
    });
  }

  async openBron(context) {
    await this.price.scrollIntoViewIfNeeded();
    const [bookingPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      this.price.click({ timeout: 10000 }),
    ]);
    return bookingPage || this.page;
  }
}

module.exports = { HotelSearchPage };
