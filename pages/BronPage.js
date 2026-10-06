const { expect } = require('@playwright/test');
const fs = require('fs');
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
    this.tourInfo = page.locator('table.tour_info.res');
    this.claimViewLink = page.locator('#basicModalContent > div > a:nth-child(3)');
    this.claimResultSet = page.locator('#cl_refer > div.resultset');
    this.payModal = page.locator('#modalContainer');
    this.duePriceCell = page.locator('#basicModalContent > table:nth-child(3) > tbody > tr:nth-child(4) > td.cl-cost.pay-currency.RUB');
    this.duePrice = '';
    this.payButton = page.locator('#basicModalContent > button');
    this.payVariant = page.locator('#pay_variant');
    this.alfaPayLink = page.locator('#pay_variant > div.panel.pay_variant.alfabank_container > table > tbody > tr > td.variant-container > span.link.v_alfabank');
    this.pvAmount = page.locator('#pv_amount');
    this.alfaSubmit = page.locator('#acquiring_alfabank_container > fieldset > form > table > tbody > tr:nth-child(4) > td > button.acquiring_submit.alfabank');
    this.sbpLink = page.locator('#sbp_container > div > a');
    this.sbpPayLink = page.locator('#pay_variant > div:nth-child(5) > table > tbody > tr > td.variant-container > span.link.v_tbank');
    this.tbankSubmit = page.locator('#acquiring_tbank_container > fieldset > form > table > tbody > tr:nth-child(6) > td > button.acquiring_submit.tbank');
    this.tbankCardLink = page.locator('#pay_variant > div:nth-child(6) > table > tbody > tr > td.variant-container > span.link.v_tbank');
    this.tbankCardSubmit = page.locator('#acquiring_tbank_container > fieldset > form > table > tbody > tr:nth-child(5) > td > button.acquiring_submit.tbank');
    this.alfaAmount = '';
    this.alfaPriceOk = false;
    this.printClicked = 0;
    this.printDownloaded = 0;
    this.multiDownloadOk = false;
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

  async expectTourCheckin(date) {
    await expect(this.tourInfo).toBeVisible({ timeout: 30000 });
    await expect(this.tourInfo).toHaveAttribute('data-checkin', date);
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

  async openClaimResults(context) {
    await expect(this.claimViewLink).toBeVisible({ timeout: 30000 });
    const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await this.claimViewLink.click();
    const popup = await popupPromise;
    if (popup && !popup.isClosed()) {
      this.page = popup;
      this.claimResultSet = popup.locator('#cl_refer > div.resultset');
    }
    await this.page.waitForLoadState('load', { timeout: 60000 });
    await expect(this.claimResultSet).toBeVisible({ timeout: 60000 });
  }

  async waitMinuteAndReloadClaim() {
    console.log('Жду 1 минуту перед обновлением заявки');
    await this.page.waitForTimeout(60000);
    await this.page.reload({ waitUntil: 'load', timeout: 60000 });
    this.claimResultSet = this.page.locator('#cl_refer > div.resultset');
    await expect(this.claimResultSet).toBeVisible({ timeout: 60000 });
    console.log('Заявка обновлена');
  }

  async openCostTerms(orderNumber) {
    const button = this.page.locator(`#cost_${orderNumber}`);
    await expect(button).toBeVisible({ timeout: 30000 });
    await button.click();
    await this.page.waitForLoadState('load', { timeout: 60000 });
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
  }

  async readDuePrice() {
    this.duePriceCell = this.page.locator('#basicModalContent > table:nth-child(3) > tbody > tr:nth-child(4) > td.cl-cost.pay-currency.RUB');
    await expect(this.duePriceCell).toBeVisible({ timeout: 30000 });
    this.duePrice = (await this.duePriceCell.innerText()).trim();
    if (!this.duePrice) {
      throw new Error('Цена «К доплате» пустая');
    }
    console.log('К доплате:', this.duePrice);
    return this.duePrice;
  }

  async openPayMethods(context) {
    this.payButton = this.page.locator('#basicModalContent > button');
    await expect(this.payButton).toBeVisible({ timeout: 30000 });
    const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await this.payButton.click();
    const popup = await popupPromise;
    if (popup && !popup.isClosed()) {
      this.page = popup;
    }
    await this.page.waitForLoadState('load', { timeout: 60000 });
    this.payVariant = this.page.locator('#pay_variant');
    await expect(this.payVariant).toBeVisible({ timeout: 60000 });
  }

  async openAlfaPay() {
    this.alfaPayLink = this.page.locator('#pay_variant > div.panel.pay_variant.alfabank_container > table > tbody > tr > td.variant-container > span.link.v_alfabank');
    await expect(this.alfaPayLink).toBeVisible({ timeout: 30000 });
    await this.alfaPayLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
  }

  pricesMatch(left, right) {
    const digits = (value) => String(value || '').replace(/\s/g, '');
    return digits(left) !== '' && digits(left) === digits(right);
  }

  moneyNumber(value) {
    const cleaned = String(value || '').replace(/\s/g, '').replace(',', '.');
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  withSbpFee(dueText) {
    const due = this.moneyNumber(dueText);
    const rawFee = Math.round(due * 0.007 * 100) / 100;
    const fee = Math.min(rawFee, 1500);
    const total = Math.round((due + fee) * 100) / 100;
    return { due, fee, total, capped: rawFee > 1500 };
  }

  roundKopecks(value) {
    return Math.round(value * 100 + 1e-8) / 100;
  }

  withTbankFee(dueText) {
    const due = this.moneyNumber(dueText);
    const total = this.roundKopecks(due / 0.99);
    const fee = this.roundKopecks(total - due);
    return { due, fee, total };
  }

  async confirmAlfaPriceAndPay() {
    this.pvAmount = this.page.locator('#pv_amount');
    await expect(this.pvAmount).toBeVisible({ timeout: 30000 });
    const tag = await this.pvAmount.evaluate((el) => el.tagName);
    this.alfaAmount = (tag === 'INPUT' || tag === 'TEXTAREA'
      ? await this.pvAmount.inputValue()
      : await this.pvAmount.innerText()).trim();
    if (!this.alfaAmount) {
      throw new Error('Цена в #pv_amount пустая');
    }
    if (this.pricesMatch(this.alfaAmount, this.duePrice)) {
      this.alfaPriceOk = true;
      console.log('Цена оплаты совпала:', this.alfaAmount, 'и', this.duePrice);
      this.alfaSubmit = this.page.locator('#acquiring_alfabank_container > fieldset > form > table > tbody > tr:nth-child(4) > td > button.acquiring_submit.alfabank');
      await expect(this.alfaSubmit).toBeVisible({ timeout: 30000 });
      await this.alfaSubmit.click();
      return;
    }
    this.alfaPriceOk = false;
    console.log(`Цена оплаты «${this.alfaAmount}» не равна «К доплате» «${this.duePrice}». Кнопку «Оплатить» не жму.`);
  }

  async openSbpAndBack(context) {
    this.sbpLink = this.page.locator('#sbp_container > div > a');
    await expect(this.sbpLink).toBeVisible({ timeout: 30000 });
    const popupPromise = context.waitForEvent('page', { timeout: 60000 }).catch(() => null);
    const sameTabPromise = this.page.waitForURL(/https:\/\/b2b\.cbrpay\.ru\//, { timeout: 60000 }).catch(() => null);
    await this.sbpLink.click();
    const popup = await Promise.race([
      popupPromise.then((page) => page || null),
      sameTabPromise.then(() => null),
    ]);
    const target = popup && !popup.isClosed() ? popup : this.page;
    if (!/https:\/\/b2b\.cbrpay\.ru\//.test(target.url())) {
      await target.waitForURL(/https:\/\/b2b\.cbrpay\.ru\//, { timeout: 60000 });
    }
    console.log('Открыта оплата:', target.url());
    if (popup && !popup.isClosed()) {
      await popup.close();
    } else {
      await this.page.goBack({ waitUntil: 'load', timeout: 60000 });
    }
    this.payVariant = this.page.locator('#pay_variant');
    await expect(this.payVariant).toBeVisible({ timeout: 60000 });
  }

  async openSbpPay() {
    this.sbpPayLink = this.page.locator('#pay_variant > div:nth-child(5) > table > tbody > tr > td.variant-container > span.link.v_tbank');
    await expect(this.sbpPayLink).toBeVisible({ timeout: 30000 });
    await this.sbpPayLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
  }

  async confirmTbankPriceAndPay(context) {
    this.pvAmount = this.page.locator('#pv_amount');
    await expect(this.pvAmount).toBeVisible({ timeout: 30000 });
    const tag = await this.pvAmount.evaluate((el) => el.tagName);
    this.tbankAmount = (tag === 'INPUT' || tag === 'TEXTAREA'
      ? await this.pvAmount.inputValue()
      : await this.pvAmount.innerText()).trim();
    if (!this.tbankAmount) {
      throw new Error('Цена в #pv_amount пустая');
    }
    const { due, fee, total, capped } = this.withSbpFee(this.duePrice);
    const shown = this.moneyNumber(this.tbankAmount);
    const same = Math.abs(shown - total) < 0.011 || shown === Math.round(total);
    const feeText = capped ? `0,7% ограничено 1500` : `0,7% ${fee}`;
    if (!same) {
      this.tbankPriceOk = false;
      console.log(`Цена СБП «${this.tbankAmount}» не равна «К доплате» ${due} + ${feeText} = ${total}. Кнопку «Оплатить» не жму.`);
      return;
    }
    this.tbankPriceOk = true;
    console.log(`Цена СБП совпала: ${this.tbankAmount}. К доплате ${due} + ${feeText} = ${total}`);
    this.tbankSubmit = this.page.locator('#acquiring_tbank_container > fieldset > form > table > tbody > tr:nth-child(6) > td > button.acquiring_submit.tbank');
    await expect(this.tbankSubmit).toBeVisible({ timeout: 30000 });
    const popupPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
    const leftPay = this.page.waitForURL((url) => !String(url).includes('pay_variant'), { timeout: 15000 }).catch(() => null);
    await this.tbankSubmit.click({ timeout: 15000 });
    const popup = await Promise.race([
      popupPromise,
      leftPay.then(() => null),
    ]);
    const target = popup && !popup.isClosed() ? popup : this.page;
    await target.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
    console.log('Открыта оплата СБП:', target.url());
    await target.goBack({ waitUntil: 'load', timeout: 60000 });
    if (popup && !popup.isClosed()) await popup.close().catch(() => {});
    this.payVariant = this.page.locator('#pay_variant');
    await expect(this.payVariant).toBeVisible({ timeout: 30000 });
  }

  async openTbankCardAndCheck() {
    this.tbankCardLink = this.page.locator('#pay_variant > div:nth-child(6) > table > tbody > tr > td.variant-container > span.link.v_tbank');
    await expect(this.tbankCardLink).toBeVisible({ timeout: 30000 });
    await this.tbankCardLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });

    this.pvAmount = this.page.locator('#pv_amount');
    await expect(this.pvAmount).toBeVisible({ timeout: 30000 });
    const tag = await this.pvAmount.evaluate((el) => el.tagName);
    this.tbankCardAmount = (tag === 'INPUT' || tag === 'TEXTAREA'
      ? await this.pvAmount.inputValue()
      : await this.pvAmount.innerText()).trim();
    if (!this.tbankCardAmount) {
      throw new Error('Цена в #pv_amount пустая');
    }
    const { due, fee, total } = this.withTbankFee(this.duePrice);
    const shown = this.roundKopecks(this.moneyNumber(this.tbankCardAmount));
    const same = shown === total || shown === Math.round(total);
    if (same) {
      this.tbankCardPriceOk = true;
      console.log(`Цена Т-Банк совпала: ${this.tbankCardAmount}. К доплате ${due} / 0,99 = ${total}, комиссия ${fee}`);
      return;
    }
    this.tbankCardPriceOk = false;
    console.log(`Цена Т-Банк «${this.tbankCardAmount}» не равна «К доплате» ${due} / 0,99 = ${total}.`);
  }

  async openTbankBankAndBack(context) {
    this.tbankCardSubmit = this.page.locator('#acquiring_tbank_container > fieldset > form > table > tbody > tr:nth-child(5) > td > button.acquiring_submit.tbank');
    await expect(this.tbankCardSubmit).toBeVisible({ timeout: 30000 });
    const popupPromise = context.waitForEvent('page', { timeout: 60000 }).catch(() => null);
    const sameTabPromise = this.page.waitForURL(/https:\/\/pay\.tbank-online\.com\//, { timeout: 60000 }).catch(() => null);
    await this.tbankCardSubmit.click();
    const popup = await Promise.race([
      popupPromise.then((opened) => opened || null),
      sameTabPromise.then(() => null),
    ]);
    const target = popup && !popup.isClosed() ? popup : this.page;
    if (!/https:\/\/pay\.tbank-online\.com\//.test(target.url())) {
      await target.waitForURL(/https:\/\/pay\.tbank-online\.com\//, { timeout: 60000 });
    }
    await target.waitForLoadState('load', { timeout: 60000 });
    console.log('Открыта оплата Т-Банк:', target.url());
    await target.goBack({ waitUntil: 'load', timeout: 60000 });
    if (popup && !popup.isClosed()) await popup.close().catch(() => {});
    this.payVariant = this.page.locator('#pay_variant');
    await expect(this.payVariant).toBeVisible({ timeout: 60000 });
  }

  async openCertificateAndClose() {
    this.certificateLink = this.page.locator('#pay_variant > div.panel.pay_variant.pay_certificate_container > table > tbody > tr > td.variant-container > span.link.v_pay_certificate');
    await expect(this.certificateLink).toBeVisible({ timeout: 30000 });
    await this.certificateLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
    this.modalClose = this.page.locator('#modalContainer > div.modalTitle > a');
    await expect(this.modalClose).toBeVisible({ timeout: 30000 });
    await this.modalClose.click();
    await expect(this.payModal).toBeHidden({ timeout: 30000 });
  }

  async downloadInvoice() {
    this.invoiceLink = this.page.locator('#pay_variant > div.panel.pay_variant.invoice_container > table > tbody > tr > td.variant-container > span.link.v_invoice');
    await expect(this.invoiceLink).toBeVisible({ timeout: 30000 });
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 60000 }),
      this.invoiceLink.click(),
    ]);
    const filename = download.suggestedFilename();
    const filePath = await download.path();
    if (!filePath) {
      throw new Error('Счет не скачался');
    }
    const size = fs.statSync(filePath).size;
    if (!size) {
      throw new Error(`Счет «${filename}» пустой`);
    }
    this.invoiceFile = filename;
    console.log('Счет скачан:', filename, `${size} байт`);
    return filename;
  }

  async openReceiptPay() {
    this.receiptLink = this.page.locator('#pay_variant > div.panel.pay_variant.psbank_container > table > tbody > tr > td.variant-container > span.link.v_psbank');
    await expect(this.receiptLink).toBeVisible({ timeout: 30000 });
    await this.receiptLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
  }

  async confirmReceiptPriceAndClose() {
    this.maxAmount = this.page.locator('#MAX_AMOUNT');
    await expect(this.maxAmount).toBeVisible({ timeout: 30000 });
    const tag = await this.maxAmount.evaluate((el) => el.tagName);
    this.receiptAmount = (tag === 'INPUT' || tag === 'TEXTAREA'
      ? await this.maxAmount.inputValue()
      : await this.maxAmount.innerText()).trim();
    if (!this.receiptAmount) {
      throw new Error('Цена в #MAX_AMOUNT пустая');
    }
    const shown = this.moneyNumber(this.receiptAmount);
    const due = this.moneyNumber(this.duePrice);
    if (shown === due) {
      this.receiptPriceOk = true;
      console.log('Цена квитанции совпала:', this.receiptAmount, 'и', this.duePrice);
    } else {
      this.receiptPriceOk = false;
      console.log(`Цена квитанции «${this.receiptAmount}» не равна «К доплате» «${this.duePrice}».`);
    }
    this.modalClose = this.page.locator('#modalContainer > div.modalTitle > a');
    await expect(this.modalClose).toBeVisible({ timeout: 30000 });
    await this.modalClose.click();
    await expect(this.payModal).toBeHidden({ timeout: 30000 });
  }

  async closePayVariantTab() {
    const context = this.page.context();
    const payPage = context.pages().find((p) => !p.isClosed() && p.url().includes('pay_variant'));
    if (!payPage) {
      throw new Error('Вкладка pay_variant не найдена');
    }
    await payPage.close();
    const claimPage = context.pages().find((p) => !p.isClosed() && /cl_refer/.test(p.url()));
    if (!claimPage) {
      throw new Error('Вкладка cl_refer не найдена');
    }
    this.page = claimPage;
    await this.page.bringToFront();
    await this.page.waitForLoadState('load', { timeout: 60000 });
    this.claimResultSet = this.page.locator('#cl_refer > div.resultset');
    await expect(this.claimResultSet).toBeVisible({ timeout: 60000 });
    console.log('Вкладка pay_variant закрыта. Просмотр заявок:', this.page.url());
  }

  async searchClaim(orderNumber) {
    const number = String(orderNumber || '').trim();
    if (!number || number === 'не найден') {
      throw new Error('Номер заявки пустой');
    }
    this.claimNumberInput = this.page.locator('#cl_refer > div.controls > table > tbody > tr > td.right_side > table > tbody > tr:nth-child(1) > td:nth-child(2) > input');
    await expect(this.claimNumberInput).toBeVisible({ timeout: 30000 });
    await this.claimNumberInput.fill(number);
    await expect(this.claimNumberInput).toHaveValue(number);

    this.claimSearchButton = this.page.locator('#cl_refer > div.controls > table > tbody > tr > td.right_side > table > tbody > tr:nth-child(5) > td > button');
    await expect(this.claimSearchButton).toBeVisible({ timeout: 30000 });
    const searchResponse = this.page.waitForResponse(
      (res) => /cl_refer/i.test(res.url()) && res.ok(),
      { timeout: 90000 },
    );
    await this.claimSearchButton.click();
    await searchResponse;
    await this.page.waitForLoadState('load', { timeout: 90000 });
    await this.page.waitForFunction(() => {
      const el = document.querySelector('#samo-circle-preloader');
      if (!el) return true;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return true;
      const r = el.getBoundingClientRect();
      return r.width === 0 || r.height === 0;
    }, { timeout: 60000 });
    this.claimNumberInput = this.page.locator('#cl_refer > div.controls > table > tbody > tr > td.right_side > table > tbody > tr:nth-child(1) > td:nth-child(2) > input');
    await expect(this.claimNumberInput).toHaveValue(number);
    this.claimResultSet = this.page.locator('#cl_refer > div.resultset');
    await expect(this.claimResultSet).toBeVisible({ timeout: 60000 });
    console.log('Найдена заявка:', number);
  }

  async openClaimDocuments(orderNumber) {
    const number = String(orderNumber || '').trim();
    if (!number || number === 'не найден') {
      throw new Error('Номер заявки пустой');
    }
    this.documentsLink = this.page.locator(`#cl_${number} > tbody > tr.edit_claim > td.cl_alink > span.link.e_doc`);
    await expect(this.documentsLink).toBeVisible({ timeout: 30000 });
    await this.documentsLink.click();
    this.payModal = this.page.locator('#modalContainer');
    await expect(this.payModal).toBeVisible({ timeout: 60000 });
    console.log('Открыты документы заявки:', number);
  }

  async downloadPrint(link) {
    await expect(link).toBeVisible({ timeout: 30000 });
    this.printClicked += 1;
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 60000 }),
      link.click(),
    ]);
    const filename = download.suggestedFilename();
    const filePath = await download.path();
    if (!filePath) {
      throw new Error('Документ не скачался');
    }
    const size = fs.statSync(filePath).size;
    if (!size) {
      throw new Error(`Документ «${filename}» пустой`);
    }
    await download.delete();
    this.printDownloaded += 1;
    console.log('Документ скачан и удалён:', filename, `${size} байт`);
  }

  printLinks() {
    return this.page.locator('#e_doc > table > tbody > tr > td:nth-child(4) > a');
  }

  async openBookletTab(link) {
    await expect(link).toBeVisible({ timeout: 30000 });
    this.printClicked += 1;
    const docsPage = this.page;
    const popupPromise = docsPage.context().waitForEvent('page', { timeout: 60000 });
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('load', { timeout: 60000 });
    this.printDownloaded += 1;
    console.log('Памятка загружена:', popup.url());
    const wentBack = await popup.goBack({ waitUntil: 'load', timeout: 60000 }).catch(() => null);
    if (!wentBack && !popup.isClosed()) await popup.close();
    this.page = docsPage;
    await this.page.bringToFront();
    await expect(this.page.locator('#e_doc')).toBeVisible({ timeout: 30000 });
  }

  async downloadAllPrints() {
    const total = await this.printLinks().count();
    if (!total) {
      throw new Error('В #e_doc > table > tbody нет кнопок «Печать»');
    }
    console.log('Кнопок «Печать» в таблице:', total);
    for (let i = 0; i < total; i++) {
      const link = this.printLinks().nth(i);
      const isBooklet = await link.evaluate((el) => (el.closest('tr')?.className || '').includes('doccategory-booklet'));
      if (isBooklet) await this.openBookletTab(link);
      else await this.downloadPrint(link);
    }
    if (this.printDownloaded !== total) {
      throw new Error(`Скачано ${this.printDownloaded} из ${total}`);
    }
  }

  async selectAllDocuments() {
    this.docSelect = this.page.locator('#e_doc > table > thead > tr > th.ids > select');
    await expect(this.docSelect).toBeVisible({ timeout: 30000 });
    await this.docSelect.selectOption({ label: 'Все' });
    await expect(this.docSelect.locator('option:checked')).toHaveText('Все');
    this.multiDownload = this.page.locator('#multiDownload');
    await expect(this.multiDownload).toBeEnabled({ timeout: 30000 });
    console.log('Выбраны все документы');
  }

  async downloadAllInOneFile() {
    this.multiDownload = this.page.locator('#multiDownload');
    await expect(this.multiDownload).toBeEnabled({ timeout: 30000 });
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 60000 }),
      this.multiDownload.click(),
    ]);
    const filename = download.suggestedFilename();
    const filePath = await download.path();
    if (!filePath) {
      throw new Error('Общий файл не скачался');
    }
    const size = fs.statSync(filePath).size;
    if (!size) {
      throw new Error(`Общий файл «${filename}» пустой`);
    }
    await download.delete();
    this.multiDownloadOk = true;
    console.log('Общий файл скачан и удалён:', filename, `${size} байт`);
  }
}

module.exports = { BronPage };
