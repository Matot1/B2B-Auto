const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, date.getDate());
}

function toDateParts(date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function dateFieldLocator(page, inputName) {
  if (/^[A-Za-z_][\w-]*$/.test(inputName)) {
    return page.locator(`input[name="${inputName}"], #${inputName}`).first();
  }
  return page.locator(`input[name="${inputName}"]`);
}

function dateStringToClass(dateStr) {
  const [day, month, year] = dateStr.split('.');
  return `date_${year}${month}${day}`;
}

async function navigateCalendarToMonth(page, targetYear, targetMonthIndex) {
  const caption = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_caption');
  const nextBtn = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_next');
  const prevBtn = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_previous');

  for (let i = 0; i < 36; i++) {
    const h = await caption().textContent().catch(() => '');
    const curYr = parseInt(h.match(/(\d{4})/)?.[1] || '0', 10);
    const curMo = MONTH_NAMES.indexOf((h.split(',')[0] || '').trim());
    if (curYr === targetYear && curMo === targetMonthIndex) return;

    if (targetYear > curYr || (targetYear === curYr && targetMonthIndex > curMo)) {
      await nextBtn().click();
    } else {
      await prevBtn().click();
    }
    await page.waitForTimeout(50);
  }

  throw new Error(`Не удалось перейти к месяцу ${MONTH_NAMES[targetMonthIndex]} ${targetYear} в календаре`);
}

async function setDateUI(page, inputName, date) {
  const [day, month, year] = date.split('.');
  const targetYear = parseInt(year);
  const targetMonth = MONTH_NAMES[parseInt(month) - 1];
  const dayNum = String(parseInt(day, 10));

  const dateField = dateFieldLocator(page, inputName);
  const dateButton = dateField.locator('xpath=../button');
  if (await dateButton.count()) {
    await dateButton.click();
  } else {
    await dateField.click();
  }
  await page.waitForTimeout(500);
  await page.locator('.Zebra_DatePicker.dp_visible').waitFor({ timeout: 5000 }).catch(() => {});

  const caption = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_caption');
  const nextBtn = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_next');
  const prevBtn = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_previous');

  for (let i = 0; i < 36; i++) {
    const h = await caption().textContent().catch(() => '');
    if (h.includes(targetMonth) && h.includes(year)) {
      const dayCell = page.locator('.Zebra_DatePicker.dp_visible .dp_daypicker td:not(.dp_not_in_month):not(.dp_not_in_month_selectable):not(.dp_disabled):not(.dp_weekend_disabled)')
        .filter({ hasText: new RegExp(`^\\s*${dayNum}\\s*$`) });
      if (await dayCell.count() > 0) {
        await dayCell.first().click();
        await page.waitForTimeout(500);
        return;
      }
    }
    const curH = await caption().textContent().catch(() => '');
    const curYr = parseInt(curH.match(/(\d{4})/)?.[1] || '0');
    const curMo = MONTH_NAMES.indexOf((curH.split(',')[0] || '').trim());
    const targetIdx = parseInt(month) - 1;
    if (targetYear < curYr || (targetYear === curYr && targetIdx < curMo)) {
      await prevBtn().click();
    } else {
      await nextBtn().click();
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`Не удалось выбрать дату ${date} в календаре`);
}

async function setDateDirect(page, inputName, date) {
  await page.evaluate(({ name, val }) => {
    const input = document.querySelector(`input[name="${name}"]`)
      || (/^[A-Za-z_][\w-]*$/.test(name) ? document.querySelector(`#${name}`) : null);
    if (!input) return;
    try {
      const cal = JSON.parse(input.getAttribute('data-calendar'));
      cal.start = val;
      input.setAttribute('data-calendar', JSON.stringify(cal));
    } catch (e) {}
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }, { name: inputName, val: date });
}

async function setDate(page, inputName, date) {
  const [day, month, year] = date.split('.');
  const targetYear = parseInt(year);
  const currentYear = new Date().getFullYear();
  if (Math.abs(targetYear - currentYear) > 2) {
    await setDateDirect(page, inputName, date);
  } else {
    await setDateUI(page, inputName, date);
  }
}

async function setAvailableDate(page, inputName, highlight = 'gds') {
  const useColor = typeof highlight === 'string' && highlight.startsWith('#');
  const marks = useColor ? [] : (Array.isArray(highlight) ? highlight : [highlight]);
  const colorHex = useColor ? highlight : null;

  const minParts = toDateParts(addMonths(new Date(), 4));
  const minLabel = `${String(minParts.day).padStart(2, '0')}.${String(minParts.month).padStart(2, '0')}.${minParts.year}`;

  const dateField = dateFieldLocator(page, inputName);
  await dateField.waitFor({ state: 'attached', timeout: 30000 });
  const dateButton = dateField.locator('xpath=../button');
  if (await dateButton.count()) {
    await dateButton.click();
  } else {
    await dateField.click();
  }
  await page.waitForTimeout(500);
  await page.locator('.Zebra_DatePicker.dp_visible').waitFor({ timeout: 8000 });
  await page.waitForTimeout(1500);

  await navigateCalendarToMonth(page, minParts.year, minParts.month - 1);

  const nextBtn = () => page.locator('.Zebra_DatePicker.dp_visible .dp_header .dp_next');

  for (let i = 0; i < 24; i++) {
    const selected = await page.evaluate(({ min, marks: classMarks, color }) => {
      const picker = document.querySelector('.Zebra_DatePicker.dp_visible');
      if (!picker) return { found: false };

      const compare = (a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      };

      const getCellParts = (td, captionYear, captionMonth) => {
        const dateClass = [...td.classList].find((c) => /^date_\d{8}$/.test(c));
        if (dateClass) {
          const m = dateClass.match(/date_(\d{4})(\d{2})(\d{2})/);
          if (m) return { year: +m[1], month: +m[2], day: +m[3] };
        }
        const day = parseInt((td.textContent || '').trim(), 10);
        return { year: captionYear, month: captionMonth, day };
      };

      const cellMatchesColor = (td, hex) => {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const nodes = [td, ...td.querySelectorAll('*')];
        return nodes.some((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return false;
          return Math.abs(+m[1] - r) <= 5 && Math.abs(+m[2] - g) <= 5 && Math.abs(+m[3] - b) <= 5;
        });
      };

      const caption = (picker.querySelector('.dp_caption')?.textContent || '').trim();
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const [monthName, yearStr] = caption.split(',').map((s) => s.trim());
      const captionMonth = months.indexOf(monthName) + 1;
      const captionYear = parseInt(yearStr, 10);
      if (captionMonth < 1 || !captionYear) return { found: false };

      const selector = color
        ? 'table.dp_daypicker td:not(.dp_disabled):not(.dp_weekend_disabled):not(.dp_not_in_month)'
        : 'table.dp_daypicker td:not(.dp_disabled):not(.dp_weekend_disabled):not(.dp_not_in_month):not(.dp_not_in_month_selectable)';

      let cells = [...picker.querySelectorAll(selector)];

      if (color) {
        cells = cells.filter((td) => cellMatchesColor(td, color));
      } else {
        cells = cells.filter((td) => classMarks.some((m) => td.classList.contains(m)));
      }

      const cell = cells.find((td) => {
        const parts = getCellParts(td, captionYear, captionMonth);
        if (!parts.day) return false;
        return compare(parts, min) > 0;
      });
      if (!cell) return { found: false };

      const parts = getCellParts(cell, captionYear, captionMonth);
      const dateClass = [...cell.classList].find((c) => /^date_\d{8}$/.test(c)) || null;
      return {
        found: true,
        date: `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`,
        dateClass,
        classMark: classMarks.find((m) => cell.classList.contains(m)) || null,
        day: parts.day,
      };
    }, { min: minParts, marks, color: colorHex });

    if (selected?.found) {
      const cellClass = selected.dateClass || dateStringToClass(selected.date);
      let pickerCell = page.locator(`.Zebra_DatePicker.dp_visible td.${cellClass}`);
      if (await pickerCell.count() === 0 && selected.classMark) {
        pickerCell = page.locator(`.Zebra_DatePicker.dp_visible td.${selected.classMark}`)
          .filter({ hasText: new RegExp(`^\\s*${selected.day}\\s*$`) });
      }
      if (await pickerCell.count() === 0) {
        pickerCell = page.locator('.Zebra_DatePicker.dp_visible table.dp_daypicker td:not(.dp_disabled):not(.dp_weekend_disabled)')
          .filter({ hasText: new RegExp(`^\\s*${selected.day}\\s*$`) });
      }

      if (await pickerCell.count() > 0) {
        await pickerCell.first().scrollIntoViewIfNeeded();
        await pickerCell.first().click();
        await page.waitForTimeout(500);
      }

      const valueInput = dateFieldLocator(page, inputName);
      let actual = await valueInput.inputValue();
      if (actual !== selected.date) {
        await setDateDirect(page, inputName, selected.date);
        await page.waitForTimeout(300);
        actual = await valueInput.inputValue();
      }

      if (actual !== selected.date) {
        throw new Error(`Дата не установилась: ожидали ${selected.date}, в поле ${actual}`);
      }
      return selected.date;
    }

    await nextBtn().click();
    await page.waitForTimeout(400);
  }

  const label = useColor ? `цветом ${highlight}` : `классом "${highlight}"`;
  throw new Error(`В календаре нет дат с ${label} строго после ${minLabel}`);
}

module.exports = { setDate, setAvailableDate, setDateDirect };
