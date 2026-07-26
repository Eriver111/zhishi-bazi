# Paipan, Lunar Conversion, and Direct Pillars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the BaZi input page, make lunar conversion round-trip accurate, and add direct four-pillar input with two recent reverse-matched birth candidates without changing the working solar flow.

**Architecture:** Keep the existing solar and lunar request path intact. Add small global-browser modules for pillar validation and reverse lookup, add one additive `BaZiCalculator.buildFromPillars()` API, and branch only when `mode=pillars`; the selected birth candidate supplies timing metadata while the entered pillars remain the chart source of truth.

**Tech Stack:** Static HTML/CSS, browser JavaScript, existing `BaZiCalculator`, Node.js `node:test`, VM-based browser-script tests.

## Global Constraints

- Existing solar paipan parameters and results must remain unchanged.
- Existing result-page structure, professional analysis, paywall, archive, and AI follow-up flow must remain intact.
- Direct-pillar mode accepts only gender plus year/month/day/hour pillars.
- Direct-pillar mode must not read birth location, true-solar-time, or zishi-day-switch controls.
- Reverse lookup searches from the current date back 200 years, returns at most two newest matches, and searches no future date.
- A selected candidate is used only for birth metadata and DaYun timing; entered pillars are never recalculated or overwritten.
- Shichen midpoint clocks are `0,2,4,...,22`; Zi displays `23:00—00:59` and uses `00:00`.
- Lunar support remains limited to the existing `lunarInfo` range, expected to be 1900—2100.
- No new runtime dependency is permitted.

---

## File Structure

- Create `js/pillar-input.js`: pillar constants, validation, normalization, and direct-mode query serialization.
- Create `js/pillar-reverse-lookup.js`: bounded 200-year search and candidate formatting.
- Modify `js/lunar.js`: replace the independent Spring Festival anchor in `lunarToSolar()`.
- Modify `js/bazi.js`: add `buildFromPillars()` using existing private five-element, hidden-stem, ten-god, and NaYin helpers.
- Modify `js/main.js`: support the third mode, candidate selection, and direct-mode navigation.
- Modify `js/result.js`: parse direct-mode data and protect entered pillars.
- Modify `paipan.html`: add the third tab, pillar fields, candidate dialog, scoped classes, and script tags.
- Modify `result.html`: load no new layout; only update script versions if cache busting is required.
- Create `tests/lunar-calendar.test.js`: known regression, invalid input, and exhaustive round-trip checks.
- Create `tests/pillar-input.test.js`: valid/invalid pillar rules and query contract.
- Create `tests/pillar-reverse-lookup.test.js`: candidate search, ordering, range, and Zi midpoint.
- Create `tests/direct-pillar-bazi.test.js`: complete BaZi object construction and entered-pillar invariants.
- Create `tests/paipan-direct-mode-contract.test.js`: DOM, hidden-control, scripts, and URL contract.

### Task 1: Lock the Existing Solar Flow

**Files:**
- Create: `tests/solar-paipan-regression.test.js`
- Modify: none

**Interfaces:**
- Consumes: existing `paipan.html`, `js/main.js`, `js/result.js`.
- Produces: regression gates that every later task must keep passing.

- [ ] **Step 1: Write the failing/characterization tests**

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('solar submit retains the original parameter names', () => {
  const source = read('js/main.js');
  assert.match(source, /new URLSearchParams\(\{\s*year:year,\s*month:month,\s*day:day,\s*hour:hour,\s*gender:gender\s*\}\)/);
  for (const key of ['clock', 'minute', 'prov', 'city', 'dist', 'zishi', 'solar']) {
    assert.ok(source.includes(`params.set('${key}'`) || source.includes(`params.set("${key}"`), key);
  }
});

test('ordinary result initialization still uses calculate then calculateDaYun', () => {
  const source = read('js/result.js');
  assert.match(source, /BaZiCalculator\.calculate\([\s\S]*?BaZiCalculator\.calculateDaYun\(/);
});
```

- [ ] **Step 2: Run the characterization tests**

Run: `node --test tests/solar-paipan-regression.test.js`

Expected: PASS against the current branch. If it fails, adjust only the test to reflect the current working behavior before changing production code.

- [ ] **Step 3: Run the complete baseline suite**

Run: `node --test tests/*.test.js`

Expected: all current tests PASS. Record the count in the task notes.

- [ ] **Step 4: Commit the safety net**

```bash
git add tests/solar-paipan-regression.test.js
git commit -m "test: lock existing solar paipan flow"
```

### Task 2: Make Lunar Conversion Use One Epoch

**Files:**
- Create: `tests/lunar-calendar.test.js`
- Modify: `js/lunar.js:18-63`

**Interfaces:**
- Consumes: `LunarCalendar.solarToLunar(y,m,d)`.
- Produces: `LunarCalendar.lunarToSolar(ly,lm,ld,isLeap)` with the same return shape `{year, month, day}` and explicit `RangeError`/`TypeError` validation.

- [ ] **Step 1: Add a VM loader and the known failing regression**

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalendar() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'lunar.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source, context);
  return context.LunarCalendar;
}

test('2013 lunar new year converts back to 2013-02-10', () => {
  const calendar = loadCalendar();
  assert.deepEqual(
    { ...calendar.lunarToSolar(2013, 1, 1, false) },
    { year: 2013, month: 2, day: 10 }
  );
});
```

- [ ] **Step 2: Run the regression to verify the current bug**

Run: `node --test tests/lunar-calendar.test.js`

Expected: FAIL because the current Spring Festival table returns 2013-02-11.

- [ ] **Step 3: Add invalid-date and leap-month tests**

```js
test('rejects a leap-month flag when that year has no matching leap month', () => {
  const calendar = loadCalendar();
  assert.throws(() => calendar.lunarToSolar(2013, 1, 1, true), /闰月/);
});

test('rejects a lunar day beyond that month length', () => {
  const calendar = loadCalendar();
  assert.throws(() => calendar.lunarToSolar(2013, 1, 31, false), /日期/);
});
```

- [ ] **Step 4: Replace `SPRING` anchoring with the shared epoch**

Implement `lunarToSolar()` by validating the year/month/day, summing `lYearDays()` from 1900 to `ly - 1`, summing normal and leap months before the requested month, adding `ld - 1`, and adding that offset to `Date.UTC(1900, 0, 31)`.

```js
function lunarToSolar(ly, lm, ld, isLeap) {
  if (ly < 1900 || ly > 2100) throw new RangeError('农历年份超出支持范围');
  if (lm < 1 || lm > 12) throw new RangeError('农历月份无效');
  var leap = leapMonth(ly);
  if (isLeap && leap !== lm) throw new RangeError('该年没有对应闰月');
  var maxDay = isLeap ? leapDays(ly) : monthDays(ly, lm);
  if (ld < 1 || ld > maxDay) throw new RangeError('农历日期无效');

  var offset = 0;
  for (var y = 1900; y < ly; y++) offset += lYearDays(y);
  for (var m = 1; m < lm; m++) {
    offset += monthDays(ly, m);
    if (m === leap) offset += leapDays(ly);
  }
  if (isLeap) offset += monthDays(ly, lm);
  offset += ld - 1;

  var date = new Date(Date.UTC(1900, 0, 31) + offset * 86400000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
```

Remove the unused `SPRING` table only after all tests pass.

- [ ] **Step 5: Add exhaustive round-trip coverage**

```js
test('every supported solar day round-trips through lunar conversion', () => {
  const calendar = loadCalendar();
  for (let time = Date.UTC(1900, 0, 31); time <= Date.UTC(2100, 11, 31); time += 86400000) {
    const date = new Date(time);
    const lunar = calendar.solarToLunar(
      date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()
    );
    const solar = calendar.lunarToSolar(
      lunar.lYear, lunar.lMonth, lunar.lDay, lunar.isLeap
    );
    assert.deepEqual(
      { ...solar },
      { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
    );
  }
});
```

- [ ] **Step 6: Run lunar and full tests**

Run: `node --test tests/lunar-calendar.test.js`

Expected: all lunar tests PASS, including the exhaustive loop.

Run: `node --test tests/*.test.js`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add js/lunar.js tests/lunar-calendar.test.js
git commit -m "fix: unify lunar conversion epoch"
```

### Task 3: Validate Pillars and Build a Complete Direct Chart

**Files:**
- Create: `js/pillar-input.js`
- Create: `tests/pillar-input.test.js`
- Create: `tests/direct-pillar-bazi.test.js`
- Modify: `js/bazi.js:474-565,3972-3999`

**Interfaces:**
- Produces `window.PillarInput.normalize(raw)` returning `{ ok, errors, pillars }`.
- `pillars` shape is `{ year:{gan,zhi}, month:{gan,zhi}, day:{gan,zhi}, hour:{gan,zhi} }`.
- Produces `PillarInput.toSearchParams(pillars)` using `yg,yz,mg,mz,dg,dz,hg,hz`.
- Produces `PillarInput.fromSearchParams(searchParams)` returning normalized pillars or `null`.
- Produces `BaZiCalculator.buildFromPillars(pillars, gender, birthDate)`.
- `birthDate` is either `{year,month,day,hour}` where `hour` is the shichen index, or `null` when no birth candidate exists.

- [ ] **Step 1: Write pillar validation tests**

```js
test('accepts four legal sexagenary pairs', () => {
  const result = PillarInput.normalize({
    year: '甲申', month: '壬申', day: '乙丑', hour: '丁亥'
  });
  assert.equal(result.ok, true);
  assert.deepEqual({ ...result.pillars.year }, { gan: '甲', zhi: '申' });
});

test('rejects an impossible yin-yang pair', () => {
  const result = PillarInput.normalize({
    year: '甲丑', month: '壬申', day: '乙丑', hour: '丁亥'
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.year, '年柱干支阴阳不匹配');
});
```

Use a VM loader like Task 2 and expose `window.PillarInput`.

- [ ] **Step 2: Run the pillar tests and verify failure**

Run: `node --test tests/pillar-input.test.js`

Expected: FAIL because `js/pillar-input.js` does not exist.

- [ ] **Step 3: Implement `PillarInput`**

Use these constants and parity rule:

```js
var GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var ZHIS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function isValidPair(gan, zhi) {
  var gi = GANS.indexOf(gan);
  var zi = ZHIS.indexOf(zhi);
  return gi >= 0 && zi >= 0 && gi % 2 === zi % 2;
}
```

`normalize()` must accept either two-character strings or `{gan,zhi}` objects, return errors keyed by pillar position, and never throw for user input.

- [ ] **Step 4: Implement and test query serialization**

`toSearchParams()` must emit exactly `yg,yz,mg,mz,dg,dz,hg,hz`. `fromSearchParams()` must validate through `normalize()` and return `null` for missing or illegal values. These methods are shared by the paipan and result pages so neither duplicates the query contract.

- [ ] **Step 5: Write the direct BaZi construction test**

```js
test('buildFromPillars preserves entered pillars and derives dependent fields', () => {
  const pillars = {
    year:{gan:'甲',zhi:'申'}, month:{gan:'壬',zhi:'申'},
    day:{gan:'乙',zhi:'丑'}, hour:{gan:'丁',zhi:'亥'}
  };
  const bazi = calculator.buildFromPillars(
    pillars, 'female', {year:2004,month:8,day:20,hour:11}
  );
  assert.equal(bazi.year.gan + bazi.year.zhi, '甲申');
  assert.equal(bazi.day.gan + bazi.day.zhi, '乙丑');
  assert.equal(bazi.day.shiShen.gan, '日主');
  assert.ok(Array.isArray(bazi.month.cangGan));
  assert.ok(bazi.hour.nayin);
  assert.equal(bazi.gender, 'female');
});
```

- [ ] **Step 6: Add `buildFromPillars()` without changing `calculate()`**

Inside `bazi.js`, validate the four gan/zhi indexes, construct pillar records with `ganIndex` and `zhiIndex`, then reuse existing `getShiShen()`, `getCangGan()`, `getNaYin()`, `WU_XING`, `DI_ZHI_WU_XING`, and `countWuXing()`. Export it only as:

```js
window.BaZiCalculator = {
  calculate: calculateBaZi,
  buildFromPillars: buildBaZiFromPillars,
  // existing exports remain byte-for-byte present
};
```

Do not route ordinary `calculate()` through the new function in this task.

- [ ] **Step 7: Support a null birth date**

When `birthDate` is null, preserve `birthDate:null` on the returned BaZi object. All pillar-derived fields must still be complete. This supports the agreed “基础命盘，无精确起运” fallback.

- [ ] **Step 8: Run focused and full tests**

Run: `node --test tests/pillar-input.test.js tests/direct-pillar-bazi.test.js`

Expected: PASS.

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add js/pillar-input.js js/bazi.js tests/pillar-input.test.js tests/direct-pillar-bazi.test.js
git commit -m "feat: build charts from entered pillars"
```

### Task 4: Reverse-Look Up Two Recent Birth Candidates

**Files:**
- Create: `js/pillar-reverse-lookup.js`
- Create: `tests/pillar-reverse-lookup.test.js`

**Interfaces:**
- Consumes `PillarInput` normalized pillars and `BaZiCalculator.calculate()`.
- Produces `PillarReverseLookup.findRecentMatches(options)`.
- `options` is `{pillars, gender, now, years, calculator}`.
- Each candidate is `{year,month,day,hourIndex,clock,hourName,hourRange,iso}`.

- [ ] **Step 1: Write known-chart and ordering tests**

```js
test('finds the source date of a chart and returns no more than two matches', () => {
  const source = calculator.calculate(2024, 3, 18, 3, 'male', 6);
  const pillars = ['year','month','day','hour'].reduce((out, key) => {
    out[key] = { gan: source[key].gan, zhi: source[key].zhi };
    return out;
  }, {});
  const matches = lookup.findRecentMatches({
    pillars, gender:'male', now:new Date('2026-07-26T00:00:00Z'),
    years:200, calculator
  });
  assert.ok(matches.some(item => item.year === 2024 && item.month === 3 && item.day === 18));
  assert.ok(matches.length <= 2);
  assert.ok(matches.every((item, i) => i === 0 || matches[i - 1].iso > item.iso));
});
```

- [ ] **Step 2: Add range and Zi-hour tests**

```js
test('zi hour uses midnight midpoint and explicit cross-day label', () => {
  assert.equal(lookup.HOUR_MIDPOINTS[0], 0);
  assert.equal(lookup.HOUR_RANGES[0], '23:00—00:59');
});

test('never returns a future or older-than-200-year candidate', () => {
  const now = new Date('2026-07-26T00:00:00Z');
  const source = calculator.calculate(2024, 3, 18, 3, 'male', 6);
  const pillars = ['year','month','day','hour'].reduce((out, key) => {
    out[key] = { gan: source[key].gan, zhi: source[key].zhi };
    return out;
  }, {});
  const matches = lookup.findRecentMatches({ pillars, gender:'male', now, years:200, calculator });
  assert.ok(matches.every(item => item.iso <= '2026-07-26'));
  assert.ok(matches.every(item => item.iso >= '1826-07-26'));
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `node --test tests/pillar-reverse-lookup.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the bounded search**

Use the entered hour branch to derive the shichen index and midpoint. For every Gregorian year from one year before the lower boundary through the current year, calculate July 1 at that hour; keep years whose year pillar matches, plus the following Gregorian year to cover dates before Li Chun. Scan only those candidate years day-by-day, skip dates outside the exact 200-year window, calculate the chart at the chosen shichen midpoint, and compare all eight characters.

Stop collecting after the complete scan, sort descending by `iso`, de-duplicate by `iso + hourIndex`, and return `.slice(0, 2)`.

- [ ] **Step 5: Add a performance assertion**

Instrument a calculator wrapper and assert the optimized search makes fewer than 5,000 calls for a normal 200-year search. This guards against accidentally changing the implementation to 876,000 hour calculations.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/pillar-reverse-lookup.test.js`

Expected: PASS in under two seconds on the development machine.

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/pillar-reverse-lookup.js tests/pillar-reverse-lookup.test.js
git commit -m "feat: reverse lookup direct pillar dates"
```

### Task 5: Add the Third Paipan Mode and Candidate Choice

**Files:**
- Create: `tests/paipan-direct-mode-contract.test.js`
- Modify: `paipan.html:915-1039`
- Modify: `js/main.js:249-365`
- Modify: `css/theme-light-forms.css`

**Interfaces:**
- Consumes `PillarInput.normalize()` and `PillarReverseLookup.findRecentMatches()`.
- Produces a direct-mode result query with:
  `mode=pillars`, `yg`, `yz`, `mg`, `mz`, `dg`, `dz`, `hg`, `hz`,
  `timing=matched`, selected `year`, `month`, `day`, `hour`, `clock`, and `gender`.
- A no-match continuation produces the same pillar parameters with `timing=unknown` and no fabricated birth date.

- [ ] **Step 1: Write the DOM and script contract**

```js
test('paipan exposes a direct-pillar mode without location controls inside it', () => {
  const html = read('paipan.html');
  assert.match(html, /data-mode=["']pillars["']/);
  assert.match(html, /id=["']pillarsPanel["']/);
  for (const id of ['pYearGan','pYearZhi','pMonthGan','pMonthZhi','pDayGan','pDayZhi','pHourGan','pHourZhi','pillarCandidates']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.ok(html.includes('js/bazi.js'));
  assert.ok(html.includes('js/pillar-input.js'));
  assert.ok(html.includes('js/pillar-reverse-lookup.js'));
});
```

- [ ] **Step 2: Run the contract test to verify failure**

Run: `node --test tests/paipan-direct-mode-contract.test.js`

Expected: FAIL because the third tab and modules are absent.

- [ ] **Step 3: Add scoped direct-mode markup**

Add a third `.mode-tab`, `#pillarsPanel`, eight selects, explanatory copy, and a hidden `#pillarCandidates` dialog. Wrap location and correction rows in `.calendar-only-fields`; do not duplicate gender controls.

Load scripts in this order:

```html
<script src="js/lunar.js"></script>
<script src="js/bazi.js"></script>
<script src="js/pillar-input.js"></script>
<script src="js/pillar-reverse-lookup.js"></script>
<script src="js/region.js"></script>
<script src="js/main.js"></script>
```

- [ ] **Step 4: Extend `switchMode()` without changing solar/lunar branches**

Map panel IDs explicitly:

```js
var panelIds = { solar:'solarPanel', lunar:'lunarPanel', pillars:'pillarsPanel' };
var newPanel = document.getElementById(panelIds[mode]);
document.querySelectorAll('.calendar-only-fields').forEach(function(el) {
  el.hidden = mode === 'pillars';
});
```

Retain `setPanelFields()` so hidden panels cannot trigger native required-field validation.

- [ ] **Step 5: Add the direct submit branch**

Before reading province/city/district, branch when `currentMode === 'pillars'`:

1. Normalize the eight selected characters.
2. Render field errors without clearing inputs.
3. Call `findRecentMatches()`.
4. Render at most two buttons with date, shichen range, and midpoint notice.
5. On candidate click, serialize the exact query contract and navigate to `result?...`.
6. If no matches, show the agreed message, “返回检查四柱”, and “仅查看基础命盘” actions.
7. “仅查看基础命盘” uses `timing=unknown`, omits date/hour/clock, and never fabricates a birth date.

The ordinary branch must continue below using the existing parameter code.

- [ ] **Step 6: Add responsive styles**

In `css/theme-light-forms.css`, scope rules under `.pillar-grid`, `.pillar-column`, and `.pillar-candidates`. At widths below 768px, use two pillar columns per row; below 420px keep two columns with 44px minimum controls and smaller gaps.

- [ ] **Step 7: Run contract and browser smoke checks**

Run: `node --test tests/paipan-direct-mode-contract.test.js tests/form-structure-contract.test.js tests/solar-paipan-regression.test.js`

Expected: PASS.

Run: `npm run dev`

Open `/paipan` at 1440×900 and 390×844. Verify solar and lunar still submit; direct mode hides location and both correction switches; candidate buttons are readable and do not overflow.

- [ ] **Step 8: Commit**

```bash
git add paipan.html js/main.js css/theme-light-forms.css tests/paipan-direct-mode-contract.test.js
git commit -m "feat: add direct pillar paipan mode"
```

### Task 6: Integrate Direct Pillars Into the Result Page

**Files:**
- Modify: `js/result.js:22-38,1202-1260`
- Modify: `result.html:2579-2727` only if cache-busting versions are needed
- Modify: `tests/direct-pillar-bazi.test.js`
- Modify: `tests/result-structure-contract.test.js`

**Interfaces:**
- Consumes the direct query contract from Task 5.
- Consumes `BaZiCalculator.buildFromPillars()`.
- Produces `_params.mode`, `_params.enteredPillars`, and a complete `_bazi` built from entered pillars.
- Produces `_params.timing` as `matched` or `unknown`; unknown timing renders no DaYun/LiuNian.

- [ ] **Step 1: Add direct-query parsing tests**

Use the shared `PillarInput.fromSearchParams(URLSearchParams)` helper. Add `js/pillar-input.js` before `js/result.js` in `result.html`. Test:

```js
const params = new URLSearchParams(
  'mode=pillars&yg=甲&yz=申&mg=壬&mz=申&dg=乙&dz=丑&hg=丁&hz=亥'
);
assert.deepEqual(PillarInput.fromSearchParams(params), {
  year:{gan:'甲',zhi:'申'}, month:{gan:'壬',zhi:'申'},
  day:{gan:'乙',zhi:'丑'}, hour:{gan:'丁',zhi:'亥'}
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `node --test tests/direct-pillar-bazi.test.js`

Expected: FAIL because result parsing does not support direct mode.

- [ ] **Step 3: Branch result initialization only for `mode=pillars`**

Keep the ordinary path unchanged:

```js
var isDirect = _params.mode === 'pillars';
var hasTiming = !isDirect || _params.timing === 'matched';
var bazi = isDirect
  ? window.BaZiCalculator.buildFromPillars(
      _params.enteredPillars,
      _params.gender,
      hasTiming
        ? {year:_params.year, month:_params.month, day:_params.day, hour:_params.hour}
        : null
    )
  : window.BaZiCalculator.calculate(
      _params.year, _params.month, _params.day, _params.hour, _params.gender, _params.clock || 0
    );
```

Run true-solar correction and zishi-day-switch code only when `!isDirect`. When `hasTiming`, continue calling the existing `calculateDaYun()` with the selected candidate date and the entered `bazi.month`/`bazi.year`. When timing is unknown, do not call `calculateDaYun()`.

- [ ] **Step 4: Add the unknown-timing base-chart branch**

When `timing=unknown`:

- bypass the ordinary year/month/day/hour validation;
- build the chart from entered pillars with `birthDate:null`;
- hide `.section-dayun` and `.section-liunian`;
- render a visible notice: “未在近200年内定位出生时间，以下仅展示基础命盘，大运与流年暂不计算”;
- skip `renderDaYun()`, `renderLiuNian()`, `renderSolarTime()`, and every call that dereferences `data.daYun`;
- continue rendering four pillars, ten gods, hidden stems, NaYin, five elements, pattern, professional analysis, and AI chart context.

- [ ] **Step 5: Protect downstream consumers**

Ensure:

- `render()` receives the direct `bazi`.
- `calculateShenSha()`, `getPattern()`, professional analysis, archive data, and `ai_chart_data` read the direct `bazi`.
- Birth date and hour labels use the selected candidate and include “四柱反查 · 起运按时辰中点估算”.
- Unknown timing displays “出生日期未定位” and does not show a false age or date.
- `renderSolarTime()` is skipped or displays “四柱直排不使用真太阳时”.
- Direct-mode archive parameters retain all eight entered characters.

- [ ] **Step 6: Add invariance tests**

Use a candidate date that would produce a different chart if recalculated. Assert the displayed/test chart still equals the entered pillars and that DaYun receives the selected date plus entered year/month pillars.

Add an unknown-timing test that asserts `buildFromPillars()` is called, `calculateDaYun()` is not called, the notice is rendered, and base analysis receives the entered chart.

- [ ] **Step 7: Run focused and full tests**

Run: `node --test tests/direct-pillar-bazi.test.js tests/result-structure-contract.test.js tests/solar-paipan-regression.test.js`

Expected: PASS.

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/result.js result.html tests/direct-pillar-bazi.test.js tests/result-structure-contract.test.js
git commit -m "feat: render results from entered pillars"
```

### Task 7: Final Regression and Visual Acceptance

**Files:**
- Modify: tests only if a confirmed regression is missing.
- Create: `docs/verification/2026-07-26-paipan-enhancements.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces a reproducible verification record and release checkpoint.

- [ ] **Step 1: Run all automated tests**

Run: `node --test tests/*.test.js`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run explicit lunar verification**

Run: `node --test tests/lunar-calendar.test.js`

Expected: the exhaustive 1900—2100 round-trip test PASS and 2013-02-10 regression PASS.

- [ ] **Step 3: Exercise the three input modes**

With `npm run dev`, verify:

- Solar: known current sample produces the same URL and result as the baseline.
- Lunar: 2013 lunar 1/1 navigates with 2013-02-10.
- Direct: a known chart returns at most two candidates; selected result shows exactly the entered pillars.
- Direct: location, true-solar, and zishi values are absent from its URL.
- Direct: a no-match input yields an actionable message and no fake date.

- [ ] **Step 4: Check desktop and mobile layouts**

At 1440×900, 390×844, and 430×932, verify tab alignment, field labels, 44px touch targets, no horizontal overflow, and readable candidate selection.

- [ ] **Step 5: Write the verification record**

Record the tested commit, commands, pass counts, three representative URLs, viewport results, and any intentionally deferred issue in `docs/verification/2026-07-26-paipan-enhancements.md`.

- [ ] **Step 6: Commit**

```bash
git add docs/verification/2026-07-26-paipan-enhancements.md
git commit -m "docs: verify paipan enhancements"
```
