export class SearchTourPage {
  constructor(page) {
    this.page = page;
    this.departureCityContainer = page.locator('.TOWNFROMINC_chosen');
    this.searchButton = page.locator('button.load');
    this.resultsContainer = page.locator('div.resultset');
  }

  async goto(cityValue) {
    const url = cityValue
      ? `https://b2b.fstravel.com/search_tour?TOWNFROMINC=${cityValue}`
      : 'https://b2b.fstravel.com/search_tour?';
    await this.page.goto(url, { waitUntil: 'load', timeout: 30000 });
  }

  async gotoWithCountry(countryValue) {
    const url = countryValue
      ? `https://b2b.fstravel.com/search_tour?STATEINC=${countryValue}`
      : 'https://b2b.fstravel.com/search_tour?';
    await this.page.goto(url, { waitUntil: 'load', timeout: 30000 });
  }

  async gotoWithFilters(countryValue, tourTypeValue, productTypeValue) {
    const params = new URLSearchParams();
    if (countryValue) params.set('STATEINC', countryValue);
    if (tourTypeValue) params.set('TOURTYPE', tourTypeValue);
    if (productTypeValue) params.set('PRODUCTTYPE', productTypeValue);
    await this.page.goto(`https://b2b.fstravel.com/search_tour?${params}`, { waitUntil: 'load', timeout: 30000 });
  }

  async selectDepartureCity(cityName) {
    await this.departureCityContainer.locator('a.chosen-single').click();
    await this.page.waitForTimeout(300);

    const items = this.departureCityContainer.locator('.chosen-results li.active-result');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      if (text.trim() === cityName) {
        await items.nth(i).click();
        break;
      }
    }
    await this.page.waitForTimeout(300);
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async waitForResults() {
    try {
      await this.page.waitForFunction(
        () => {
          const el = document.querySelector('div.resultset');
          const text = el ? el.textContent.trim() : '';
          return text.length > 10 || text === '\u00a0';
        },
        { timeout: 30000 }
      );
    } catch {
      // resultset may never change if there are no tours for this city
    }
  }

  async hasResults() {
    const text = await this.page.locator('div.resultset').textContent();
    return text.trim().length > 10 && text.trim() !== '\u00a0';
  }

  async getResultText() {
    return this.page.locator('div.resultset').textContent();
  }

  async getTourCountryTexts() {
    return this.page.evaluate(() => {
      const rows = document.querySelectorAll('tr[data-state]');
      return Array.from(rows).map(r => {
        const td = r.querySelector('td.tour');
        if (!td) return '';
        for (const n of td.childNodes) {
          if (n.nodeType === 3) {
            const t = n.textContent.trim();
            if (t) return t;
          }
        }
        return '';
      }).filter(Boolean);
    });
  }

  async getResultRowCount() {
    return this.page.evaluate(() => document.querySelectorAll('tr[data-state]').length);
  }
}
