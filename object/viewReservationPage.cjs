class ViewReservationPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://b2b.fstravel.com/cl_refer', { waitUntil: 'networkidle', timeout: 60000 });
    await this.page.waitForSelector('td.left_side .chosen-container', { timeout: 10000 });
  }

  async selectFilter(label) {
    await this.page.evaluate((lbl) => {
      const select = document.querySelector('td.left_side select');
      if (!select) throw new Error('Filter select not found');

      const option = Array.from(select.options).find(opt => opt.text === lbl);
      if (!option) throw new Error(`Option "${lbl}" not found`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, label);
    await this.page.waitForTimeout(1000);
  }

  async selectPaymentFilter(label) {
    await this.page.evaluate((lbl) => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[1];
      if (!select) throw new Error('Payment filter select not found');

      const option = Array.from(select.options).find(opt => opt.text === lbl);
      if (!option) throw new Error(`Option "${lbl}" not found`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, label);
    await this.page.waitForTimeout(1000);
  }

  async selectCountryFilter(label) {
    await this.page.evaluate((lbl) => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[2];
      if (!select) throw new Error('Country filter select not found');

      const option = Array.from(select.options).find(opt => opt.text === lbl);
      if (!option) throw new Error(`Option "${lbl}" not found`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, label);
    await this.page.waitForTimeout(1000);
  }

  async selectManagerFilter(label) {
    await this.page.evaluate((lbl) => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[3];
      if (!select) throw new Error('Manager filter select not found');

      const option = Array.from(select.options).find(opt => opt.text === lbl);
      if (!option) throw new Error(`Option "${lbl}" not found`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, label);
    await this.page.waitForTimeout(1000);
  }

  async getManagerOptions() {
    return await this.page.evaluate(() => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[3];
      if (!select) return [];
      return Array.from(select.options).map(o => o.text).filter(t => t !== '---');
    });
  }

  async selectOperatorFilter(label) {
    await this.page.evaluate((lbl) => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[4];
      if (!select) throw new Error('Operator filter select not found');

      const option = Array.from(select.options).find(opt => opt.text === lbl);
      if (!option) throw new Error(`Option "${lbl}" not found`);

      select.value = option.value;
      select.dispatchEvent(new CustomEvent('chosen:updated', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, label);
    await this.page.waitForTimeout(1000);
  }

  async getOperatorOptions() {
    return await this.page.evaluate(() => {
      const selects = document.querySelectorAll('td.left_side select');
      const select = selects[4];
      if (!select) return [];
      return Array.from(select.options).map(o => o.text).filter(t => t !== '---');
    });
  }

  async getFirstClaimNumber() {
    return await this.page.evaluate(() => {
      const span = document.querySelector('span.claim');
      return span ? span.textContent.trim() : null;
    });
  }

  async enterClaimNumber(number) {
    await this.page.locator('input[name="CLAIMBEGIN"]').fill(String(number));
    await this.page.waitForTimeout(500);
  }

  async clearClaimNumber() {
    await this.page.locator('input[name="CLAIMBEGIN"]').fill('');
    await this.page.waitForTimeout(300);
  }

  async setCheckinDate(date) {
    await this.page.evaluate((d) => {
      const input = document.querySelector('input[name="CHECKINBEG"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, d);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, date);
    await this.page.waitForTimeout(500);
  }

  async clearCheckinDate() {
    await this.page.evaluate(() => {
      const input = document.querySelector('input[name="CHECKINBEG"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await this.page.waitForTimeout(300);
  }

  async setCheckinEndDate(date) {
    await this.page.evaluate((d) => {
      const input = document.querySelector('input[name="CHECKINEND"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, d);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, date);
    await this.page.waitForTimeout(500);
  }

  async clearCheckinEndDate() {
    await this.page.evaluate(() => {
      const input = document.querySelector('input[name="CHECKINEND"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await this.page.waitForTimeout(300);
  }

  async setCreationDate(date) {
    await this.page.evaluate((d) => {
      const input = document.querySelector('input[name="CDATEBEG"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, d);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, date);
    await this.page.waitForTimeout(500);
  }

  async clearCreationDate() {
    await this.page.evaluate(() => {
      const input = document.querySelector('input[name="CDATEBEG"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await this.page.waitForTimeout(300);
  }

  async setCreationEndDate(date) {
    await this.page.evaluate((d) => {
      const input = document.querySelector('input[name="CDATEEND"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, d);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, date);
    await this.page.waitForTimeout(500);
  }

  async clearCreationEndDate() {
    await this.page.evaluate(() => {
      const input = document.querySelector('input[name="CDATEEND"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await this.page.waitForTimeout(300);
  }

  async fillTouristSurname(surname) {
    await this.page.locator('input[name="FIO"]').fill(surname);
    await this.page.waitForTimeout(300);
  }

  async clickSearch() {
    await this.page.locator('button.load:has-text("Искать")').click();
    await this.page.waitForTimeout(5000);
  }

  async hasResults() {
    await this.page.waitForSelector('div.resultset', { timeout: 10000 });
    const text = await this.page.locator('div.resultset').textContent();
    return !text.includes('Нет данных');
  }
}

module.exports = ViewReservationPage;
