const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
const { setDate: setZebraDate } = require('../object/zebraDatePicker.cjs');

class BronPage {
  constructor(page) {
    this.page = page;
    this.tourist1 = page.locator('#tourist1');
    this.buyerFirstName = page.locator('input[name="frm[phys_byer][-1][FIRSTNAME_NAME]"]');
    this.buyerLastName = page.locator('input[name="frm[phys_byer][-1][LASTNAME_NAME]"]');
    this.buyerAddress = page.locator('input[name="frm[phys_byer][-1][ADDRESS]"]');
    this.calcButton = page.locator('button.calc:has-text("Пересчитать")');
    this.bookButton = page.locator('button:has-text("бронировать")');
  }

  static async resolve(context, page) {
    for (let i = 0; i < 60; i++) {
      for (const p of context.pages()) {
        if (!p.isClosed() && p.url().includes('/bron')) {
          await p.waitForLoadState('domcontentloaded').catch(() => {});
          return new BronPage(p);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!page.isClosed() && page.url().includes('/bron')) {
      return new BronPage(page);
    }

    throw new Error('Страница /bron не открылась после выбора цены');
  }

  touristBlock(index) {
    return this.page.locator(`#tourist${index}`);
  }

  touristField(index, field) {
    return this.page.locator(`input[name="frm[People][${index}][${field}]"]`);
  }

  async waitTourists() {
    await this.tourist1.waitFor({ state: 'attached', timeout: 60000 });
  }

  async getCheckin() {
    return this.page.evaluate(() => {
      const table = document.querySelector('table.tour_info.res');
      return table ? table.getAttribute('data-checkin') : null;
    });
  }

  async assertCheckin(expected) {
    const actual = await this.getCheckin();
    if (actual !== expected) {
      console.log(`Дата на брони другая: искали ${expected}, в туре ${actual || 'не найдена'}`);
    }
    return actual;
  }

  async fillTourist(index) {
    const block = this.touristBlock(index);
    await block.waitFor({ state: 'attached', timeout: 60000 });
    await block.scrollIntoViewIfNeeded();

    await block.locator('.chosen-single').filter({ hasText: /^----$/ }).click();
    await this.page.waitForTimeout(300);
    await block.locator('.active-result[data-option-array-index="1"]').click();
    await this.page.waitForTimeout(300);

    await this.touristField(index, 'LASTNAME_LNAME').fill(faker.person.lastName().toUpperCase());
    await this.page.waitForTimeout(200);
    await this.touristField(index, 'FIRSTNAME_LNAME').fill(faker.person.firstName().toUpperCase());
    await this.page.waitForTimeout(200);
    await setZebraDate(this.page, `frm[People][${index}][BORN]`, '01.01.2000');
    await this.touristField(index, 'PHONE').fill('79881929122');
    await this.page.waitForTimeout(200);
    await this.touristField(index, 'EMAIL').fill('test33@mail.ru');
    await this.page.waitForTimeout(200);

    await block.locator('a.chosen-single:has-text("Паспорт")').click();
    await this.page.waitForTimeout(300);
    await block.locator('.chosen-results .active-result:has-text("Заграничный паспорт")').click();
    await this.page.waitForTimeout(200);

    await this.touristField(index, 'PSERIE').fill(faker.string.numeric(2));
    await this.page.waitForTimeout(200);
    await this.touristField(index, 'PNUMBER').fill(faker.string.numeric(7));
    await this.page.waitForTimeout(200);
    await setZebraDate(this.page, `frm[People][${index}][PVALID]`, '01.01.2031');
  }

  async markCustomer(index) {
    const checkbox = this.touristBlock(index)
      .locator('label:has-text("является заказчиком тура")')
      .locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
    await this.page.waitForTimeout(200);
  }

  async fillBuyer() {
    await this.buyerFirstName.fill(transliterate(faker.person.firstName()).toUpperCase());
    await this.page.waitForTimeout(200);
    await this.buyerLastName.fill(transliterate(faker.person.lastName()).toUpperCase());
    await this.page.waitForTimeout(200);
    await this.buyerAddress.fill(faker.location.city());
    await this.page.waitForTimeout(200);
  }

  async recalc() {
    await this.calcButton.click();
    await this.page.waitForTimeout(7000);
  }

  async book() {
    await this.bookButton.click();
  }

  async selectFlight() {
    const flightRadio = this.page.locator('#gdsGrid input[type="radio"][name="freight4table"]').first();
    await flightRadio.waitFor({ state: 'attached', timeout: 15000 });
    await flightRadio.scrollIntoViewIfNeeded();
    await flightRadio.check({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async openClaim(orderNumber, claimUrl) {
    if (orderNumber === 'не найден') {
      throw new Error('Номер заявки не найден');
    }
    if (!claimUrl) {
      throw new Error('Нет ссылки «Посмотреть заявку»');
    }
    await this.page.goto(claimUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForFunction(
      (num) => document.body.innerText.includes(num),
      orderNumber,
      { timeout: 30000 },
    );
  }

  async waitClaim() {
    await this.page.waitForFunction(
      () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText),
      { timeout: 90000 },
    );

    let orderNumber = 'не найден';
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
    if (numMatch) orderNumber = numMatch[1];

    const claimUrl = await this.page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.includes('Посмотреть заявку')) return a.href;
      }
      return '';
    });

    return { orderNumber, claimUrl };
  }
}

module.exports = { BronPage };
