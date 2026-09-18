const { faker } = require('@faker-js/faker/locale/ru');
const { transliterate } = require('transliteration');
const { setDateDirect } = require('../object/zebraDatePicker.cjs');
const { BronPage } = require('./BronPage.js');

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

class BronCharterPage extends BronPage {
  static async resolve(context, page) {
    const base = await BronPage.resolve(context, page);
    return new BronCharterPage(base.page);
  }

  async clickAndWait(locator, hostPart, options = {}) {
    const { timeout = 60000, clickOptions = {} } = options;
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes(hostPart) && response.status() < 400,
      { timeout },
    ).catch(() => null);
    await locator.click(clickOptions);
    await responsePromise;
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  }

  async fillTouristAsia(index) {
    const prefix = `frm[People][${index}]`;
    await this.page.locator(`#tourist${index}`).scrollIntoViewIfNeeded();
    await selectChosenByName(this.page, `${prefix}[HUMAN]`, 'MRS');
    await fillInputValue(this.page.locator(`input[name="${prefix}[LASTNAME_LNAME]"]`), transliterate(faker.person.lastName()).toUpperCase());
    await fillInputValue(this.page.locator(`input[name="${prefix}[FIRSTNAME_LNAME]"]`), transliterate(faker.person.firstName()).toUpperCase());
    await setDateDirect(this.page, `${prefix}[BORN]`, '01.01.2000');
    await fillInputValue(this.page.locator(`input[name="${prefix}[EMAIL]"]`), 'test33@mail.ru');
    await selectChosenByName(this.page, `${prefix}[NATIONALITY]`, 'Россия');
    await selectChosenByName(this.page, `${prefix}[IDENTITY_DOCUMENT]`, 'Заграничный паспорт');
    await fillInputValue(this.page.locator(`input[name="${prefix}[PSERIE]"]`), faker.string.numeric(2));
    await fillInputValue(this.page.locator(`input[name="${prefix}[PNUMBER]"]`), faker.string.numeric(7));
    await setDateDirect(this.page, `${prefix}[PVALID]`, '01.01.2031');
    await setDateDirect(this.page, `${prefix}[PGIVEN]`, '10.10.2024');
    await fillInputValue(
      this.page.locator(`input[name="${prefix}[PGIVENORG]"]`),
      faker.string.alphanumeric({ length: 8, casing: 'upper' }),
    );
    await selectChosenByName(this.page, `VISA[${index}]`, 'Своя виза');
  }

  async fillTouristBy(index) {
    const prefix = `frm[People][${index}]`;
    await this.page.locator(`#tourist${index}`).scrollIntoViewIfNeeded();
    const lastNameRu = faker.person.lastName();
    const firstNameRu = faker.person.firstName();
    await selectChosenByName(this.page, `${prefix}[HUMAN]`, 'MRS');
    await fillInputValue(this.page.locator(`input[name="${prefix}[LASTNAME_LNAME]"]`), transliterate(lastNameRu).toUpperCase());
    await fillInputValue(this.page.locator(`input[name="${prefix}[FIRSTNAME_LNAME]"]`), transliterate(firstNameRu).toUpperCase());
    await fillInputValue(this.page.locator(`input[name="${prefix}[LASTNAME_NAME]"]`), lastNameRu);
    await fillInputValue(this.page.locator(`input[name="${prefix}[FIRSTNAME_NAME]"]`), firstNameRu);
    await fillInputValue(this.page.locator(`input[name="${prefix}[INN]"]`), '0700014746');
    await setDateDirect(this.page, `${prefix}[BORN]`, '01.01.2000');
    await selectChosenByName(this.page, `${prefix}[NATIONALITY]`, 'Россия');
    await selectChosenByName(this.page, `${prefix}[IDENTITY_DOCUMENT]`, 'Заграничный паспорт');
    await fillInputValue(this.page.locator(`input[name="${prefix}[PSERIE]"]`), faker.string.numeric(2));
    await fillInputValue(this.page.locator(`input[name="${prefix}[PNUMBER]"]`), faker.string.numeric(7));
    await setDateDirect(this.page, `${prefix}[PVALID]`, '01.01.2031');
    await setDateDirect(this.page, `${prefix}[PGIVEN]`, '10.10.2024');
  }

  async fillBuyerBy() {
    const lastNameRu = faker.person.lastName();
    const firstNameRu = faker.person.firstName();
    const root = '#bron_info > div.top_container > div.CLAIMINFO.WITHBUYER > div.left_block.BUYERINFO > fieldset > table > tbody';
    await fillInputValue(this.page.locator(`${root} > tr:nth-child(1) > td:nth-child(2) > input`), transliterate(lastNameRu).toUpperCase());
    await fillInputValue(this.page.locator(`${root} > tr:nth-child(2) > td:nth-child(2) > input`), transliterate(firstNameRu).toUpperCase());
    await fillInputValue(this.page.locator(`${root} > tr:nth-child(6) > td:nth-child(2) > input`), faker.location.city());
    await fillInputValue(this.page.locator(`${root} > tr:nth-child(7) > td:nth-child(2) > input`), faker.string.numeric(4));
    await fillInputValue(this.page.locator(`${root} > tr:nth-child(8) > td:nth-child(2) > input`), faker.string.numeric(6));
    await fillInputValue(
      this.page.locator(`${root} > tr:nth-child(10) > td:nth-child(2) > input`),
      `${faker.string.alphanumeric({ length: 10, casing: 'lower' })}@mail.ru`,
    );
    await this.selectChosenOpen(
      this.page.locator(`${root} > tr:nth-child(11) > td:nth-child(2) > div > a`),
      'Беларусь',
    );
    await this.selectChosenOpen(
      this.page.locator(`${root} > tr:nth-child(12) > td:nth-child(2) > div > a`),
      'Заграничный паспорт',
    );
  }

  async selectChosenOpen(openLocator, optionText) {
    await openLocator.click();
    const option = this.page.locator('.chosen-container-active .active-result').filter({ hasText: optionText }).first();
    await option.click();
    await this.page.keyboard.press('Escape');
  }

  async confirmAgreement(hostPart) {
    const agreementBtn = this.page.locator('#agreement');
    await agreementBtn.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickAndWait(agreementBtn, hostPart);
  }

  async confirmAgreementIfVisible(hostPart) {
    const agreementBtn = this.page.locator('#agreement');
    await Promise.race([
      agreementBtn.waitFor({ state: 'visible', timeout: 20000 }),
      this.page.waitForFunction(
        () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText) || /CLAIM=\d+/i.test(location.href),
        null,
        { timeout: 20000 },
      ),
    ]).catch(() => {});
    if (await agreementBtn.isVisible().catch(() => false)) {
      await this.clickAndWait(agreementBtn, hostPart);
    }
  }

  async waitClaimFlexible() {
    await this.page.waitForFunction(
      () => /Номер вашей заявки:\s*\d+/.test(document.body.innerText) || /CLAIM=\d+/i.test(location.href),
      null,
      { timeout: 90000 },
    );
    let orderNumber = 'не найден';
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const numMatch = pageText.match(/Номер вашей заявки:\s*(\d+)/);
    if (numMatch) orderNumber = numMatch[1];
    if (orderNumber === 'не найден') {
      const urlMatch = this.page.url().match(/CLAIM=(\d+)/i);
      if (urlMatch) orderNumber = urlMatch[1];
    }
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

module.exports = { BronCharterPage };
