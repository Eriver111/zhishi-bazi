const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function makeDaySelect() {
  const select = {
    children: [],
    value: '',
    appendChild(option) { this.children.push(option); },
  };
  Object.defineProperty(select, 'innerHTML', {
    set(value) { this.children = []; this._innerHTML = value; },
    get() { return this._innerHTML || ''; },
  });
  return select;
}

function renderLunarDays(year, monthValue) {
  const daySelect = makeDaySelect();
  const elements = {
    lYear: { value: String(year) },
    lMonth: { value: monthValue },
    lDay: daySelect,
    lunarPreview: { classList: { remove() {} } },
  };
  const context = {
    setTimeout() {},
    document: {
      addEventListener() {},
      getElementById(id) { return elements[id] || null; },
      createElement() { return { value: '', textContent: '' }; },
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('js/lunar.js'), context);
  vm.runInContext(read('js/main.js'), context);
  context.updateLunarDays();
  return daySelect.children.map((option) => Number(option.value));
}

test('lunar day selector honors the selected leap-month state', () => {
  const cases = [
    { year: 2017, monthValue: '6', expectedLastDay: 29 },
    { year: 2017, monthValue: 'r6', expectedLastDay: 30 },
    { year: 2023, monthValue: '2', expectedLastDay: 30 },
    { year: 2023, monthValue: 'r2', expectedLastDay: 29 },
  ];

  for (const { year, monthValue, expectedLastDay } of cases) {
    const days = renderLunarDays(year, monthValue);
    assert.equal(days.length, expectedLastDay, `${year} ${monthValue}`);
    assert.equal(days.at(-1), expectedLastDay, `${year} ${monthValue}`);
  }
});
