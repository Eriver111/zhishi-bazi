const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const iztro = require('iztro');

const modulePath = path.join(__dirname, '..', 'js', 'ziwei-input.js');
const professionalPath = path.join(__dirname, '..', 'js', 'ziwei-professional.js');
const baziPath = path.join(__dirname, '..', 'js', 'bazi.js');

function loadBaziCalculator() {
  const context = { console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(baziPath, 'utf8'), context);
  return context.BaZiCalculator;
}

function loadInput() {
  assert.ok(fs.existsSync(modulePath), 'Ziwei input normalization module must exist');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('rejects impossible Gregorian dates before chart generation', () => {
  const input = loadInput();
  assert.equal(input.validateSolarDate(2024, 2, 29), true);
  assert.equal(input.validateSolarDate(2024, 2, 30), false);
  assert.equal(input.validateSolarDate(2023, 4, 31), false);
});

test('maps every clock hour to the traditional two-hour branch', () => {
  const input = loadInput();
  const expected = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0];
  assert.deepEqual(Array.from({ length: 24 }, (_, hour) => input.clockHourToBranchIndex(hour)), expected);
});

test('keeps early Zi on the civil day and maps late Zi to iztro late-Zi scope', () => {
  const input = loadInput();
  const calculator = loadBaziCalculator();
  const early = input.normalizeBirth({ year: 2000, month: 1, day: 1, hour: 0, minute: 30, calculator, useTrueSolarTime: false, ziHourNextDay: true });
  const late = input.normalizeBirth({ year: 2000, month: 1, day: 1, hour: 23, minute: 30, calculator, useTrueSolarTime: false, ziHourNextDay: true });

  assert.equal(early.timeIndex, 0);
  assert.equal(late.timeIndex, 12);
  assert.equal(early.solarDate, '2000-1-1');
  assert.equal(late.solarDate, '2000-1-1');
  assert.equal(early.dayPillarOffset, 0);
  assert.equal(late.dayPillarOffset, 1);

  const earlyChart = iztro.astro.bySolar(early.solarDate, early.timeIndex, 'male', true, 'zh-CN');
  const lateChart = iztro.astro.bySolar(late.solarDate, late.timeIndex, 'male', true, 'zh-CN');
  assert.notEqual(earlyChart.chineseDate, lateChart.chineseDate);

  const disabled = input.normalizeBirth({
    year: 2000, month: 1, day: 1, hour: 23, minute: 30,
    calculator, useTrueSolarTime: false, ziHourNextDay: false,
  });
  assert.equal(disabled.timeIndex, 0);
  assert.equal(disabled.solarDate, '2000-1-1');
  assert.equal(iztro.astro.bySolar(disabled.solarDate, disabled.timeIndex, 'male', true, 'zh-CN').chineseDate, earlyChart.chineseDate);
});

test('falls back from an unsupported district and city to the selected province longitude', () => {
  const input = loadInput();
  const calculator = loadBaziCalculator();
  const normalized = input.normalizeBirth({
    year: 2000, month: 1, day: 1, hour: 1, minute: 30,
    prov: '新疆', city: '乌鲁木齐市', dist: '天山区',
    calculator, useTrueSolarTime: true,
  });

  assert.equal(normalized.longitudeOffsetMinutes, -130);
  assert.equal(normalized.trueHour, 23);
  assert.equal(normalized.dayOffset, -1);
  assert.equal(normalized.solarDate, '1999-12-31');
});

test('moves the civil date when true solar time crosses midnight', () => {
  const input = loadInput();
  const calculator = loadBaziCalculator();
  const normalized = input.normalizeBirth({
    year: 2000, month: 1, day: 1, hour: 1, minute: 0,
    location: '新疆', calculator, useTrueSolarTime: true,
  });

  assert.equal(normalized.dayOffset, -1);
  assert.equal(normalized.solarDate, '1999-12-31');
  assert.equal(normalized.timeIndex, 11);
});

test('displays the effective chart date when true solar time crosses into the previous day', () => {
  const input = loadInput();
  const calculator = loadBaziCalculator();
  const normalized = input.normalizeBirth({
    year: 2025, month: 2, day: 5, hour: 1, minute: 10,
    prov: '新疆', city: '乌鲁木齐市', dist: '天山区',
    calculator, useTrueSolarTime: true,
  });

  assert.equal(normalized.solarDate, '2025-2-4');
  assert.equal(input.formatChartBirth(normalized), '2025年2月4日 亥时');
});

test('Ziwei normalization is an adapter over the BaZi birth boundary', () => {
  const input = loadInput();
  const calculator = loadBaziCalculator();
  const source = {
    year: 2024, month: 6, day: 15, hour: 8, minute: 25,
    location: '喀什市', calculator, useTrueSolarTime: true, ziHourNextDay: true,
  };
  const actual = input.normalizeBirth(source);
  const expected = calculator.normalizeBirthInput({
    year: source.year, month: source.month, day: source.day,
    hour: input.clockHourToBranchIndex(source.hour), clock: source.hour, minute: source.minute,
    location: source.location, trueSolarTime: true, ziHourNextDay: true,
  });

  assert.deepEqual(
    { year: actual.year, month: actual.month, day: actual.day, branchIndex: actual.branchIndex, dayPillarOffset: actual.dayPillarOffset },
    { year: expected.year, month: expected.month, day: expected.day, branchIndex: expected.hour, dayPillarOffset: expected.dayPillarOffset },
  );
  assert.equal(actual.trueHour, expected.solarInfo.trueHour);
  assert.equal(actual.trueMinute, expected.solarInfo.trueMinute);
  assert.match(actual.summary, /真太阳时/);
});

test('Ziwei page loads the BaZi calculator before its normalization adapter', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ziwei.html'), 'utf8');
  const bazi = html.indexOf('js/bazi.js');
  const input = html.indexOf('js/ziwei-input.js');
  assert.ok(bazi >= 0 && input > bazi);
  assert.match(html, /js\/ziwei-input\.js\?v=4/);
  assert.match(html, /js\/ziwei-render\.js\?v=9/);
  const render = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-render.js'), 'utf8');
  assert.doesNotMatch(render, /var\s+(?:PROV_LNG|CITY_LNG)\s*=/);
});

test('Ziwei exposes public and lunar input without a direct-pillar mode', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ziwei.html'), 'utf8');
  for (const value of ['solar', 'lunar']) assert.match(html, new RegExp(`data-zw-calendar=["']${value}["']`));
  for (const id of ['zwSolarPanel', 'zwLunarPanel', 'zwLY', 'zwLM', 'zwLD']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  assert.doesNotMatch(html, /data-zw-calendar=["']pillars["']/);
  assert.ok(html.indexOf('js/lunar.js') < html.indexOf('js/ziwei-render.js'));
});

test('Ziwei corrections keep true solar time on and Zi-hour rollover off by default', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ziwei.html'), 'utf8');
  const ziHourInput = html.match(/<input[^>]+id=["']zwZishiHuanri["'][^>]*>/)?.[0] || '';
  assert.doesNotMatch(ziHourInput, /\bchecked\b/);
  assert.match(html, /<input[^>]+id=["']zwSolarEnabled["'][^>]+checked/);
  const render = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-render.js'), 'utf8');
  assert.match(render, /LunarCalendar\.lunarToSolar/);
  assert.match(render, /LunarCalendar\.LUNAR_DAY\[day\]/, 'lunar day labels must use the one-based calendar table');
  assert.match(render, /prov:\s*prov[\s\S]*?city:\s*city[\s\S]*?dist:\s*dist/, 'Ziwei must preserve all location fallback levels');
  assert.match(render, /ziHourNextDay:\s*document\.getElementById\(["']zwZishiHuanri["']\)\.checked/);
});

test('reads current iztro soul/body fields and derives Yin-Yang gender label', () => {
  const input = loadInput();
  const chart = iztro.astro.bySolar('2004-8-14', 1, 'male', true, 'zh-CN');
  assert.deepEqual(input.getSoulBodyBranches(chart), { soul: '午', body: '申' });
  assert.equal(input.getGenderDesignation('辛巳 庚寅 甲子 甲子', 'male'), '阴男');
  assert.equal(input.getGenderDesignation('庚辰 戊寅 甲子 甲子', 'female'), '阳女');
});

test('collects four transformations from both major and minor stars', () => {
  const professional = require(professionalPath);
  const cases = [
    [1986, '文昌', '科'],
    [1988, '右弼', '科'],
    [1989, '文曲', '忌'],
    [1991, '文昌', '忌'],
    [1992, '左辅', '科'],
  ];
  for (const [year, star, hua] of cases) {
    const chart = iztro.astro.bySolar(`${year}-6-15`, 0, 'male', true, 'zh-CN');
    const collected = professional.collectMutagens(chart);
    assert.ok(collected.some(item => item.star === star && item.hua === hua && item.scope === 'minor'), `${year} ${star}化${hua}`);
    assert.equal(collected.length, 4, `${year} should expose all four birth-year transformations`);
  }
});

test('surrounded evidence includes target, two trines, and opposite palace', () => {
  const professional = require(professionalPath);
  const chart = iztro.astro.bySolar('2004-8-14', 1, 'male', true, 'zh-CN');
  const evidence = professional.getSurroundedEvidence(chart, '命宫');
  assert.deepEqual(evidence.map(item => item.role), ['target', 'wealth', 'career', 'opposite']);
  assert.deepEqual(evidence.map(item => item.palace), ['命宫', '财帛', '官禄', '迁移']);
});

test('empty-palace borrowing returns opposite evidence without a deterministic conclusion', () => {
  const professional = require(professionalPath);
  let chart = null;
  for (let year = 1980; year <= 2000 && !chart; year += 1) {
    const candidate = iztro.astro.bySolar(`${year}-6-15`, 0, 'female', true, 'zh-CN');
    const spouse = candidate.palaces.find(palace => palace.name === '夫妻');
    if (spouse && spouse.majorStars.length === 0) chart = candidate;
  }
  assert.ok(chart, 'fixture should contain an empty spouse palace');
  const borrowed = professional.getBorrowedOpposite(chart, '夫妻');
  assert.equal(borrowed.isEmpty, true);
  assert.equal(borrowed.target.name, '夫妻');
  assert.ok(borrowed.opposite);
  assert.equal(typeof borrowed.conclusion, 'undefined');
});

test('Ziwei renderer and saved AI data use the shared complete transformation list', () => {
  const renderSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-render.js'), 'utf8');
  const pageSource = fs.readFileSync(path.join(__dirname, '..', 'ziwei.html'), 'utf8');
  assert.match(pageSource, /ziwei-professional\.js/);
  assert.match(renderSource, /ZiweiProfessional\.collectMutagens\(zi\)/);
  assert.match(renderSource, /ZiweiProfessional\.buildChatData\(zi,\s*bd,\s*normalized,\s*currentHoroscope\)/);
});

test('builds reproducible AI chart data with palace branches, full star facts and current scopes', () => {
  const professional = require(professionalPath);
  const chart = iztro.astro.bySolar('2004-8-14', 1, 'male', true, 'zh-CN');
  const asOf = new Date('2026-08-14T12:00:00+08:00');
  const horoscope = chart.horoscope(asOf);
  const data = professional.buildChatData(chart, {
    y: 2004, m: 8, d: 14, h: 1, min: 30, isMale: true,
    prov: '四川', city: '成都市', dist: '锦江区', calendar: 'solar',
    useTrueSolarTime: true, ziHourNextDay: false,
  }, {
    solarDate: '2004-8-14', trueHour: 0, trueMinute: 26,
    summary: '真太阳时 00:26 · 子时',
  }, horoscope);

  assert.equal(data.type, 'ziwei');
  assert.equal(data.mingGong, '午');
  assert.equal(data.bodyPalace, '福德');
  assert.equal(data.bodyPalaceZhi, '申');
  assert.equal(data.birth.effectiveSolarDate, '2004-8-14');
  assert.equal(data.birth.calendar, 'solar');
  assert.equal(data.birth.dist, '锦江区');
  assert.ok(data.palaces.some((palace) => palace.name === '田宅' && palace.cs12 && palace.minor.some((star) => star.name === '文昌')));
  assert.equal(data.currentHoroscope.yearly.heavenlyStem + data.currentHoroscope.yearly.earthlyBranch, '丙午');
  assert.equal(data.currentHoroscope.monthly.heavenlyStem + data.currentHoroscope.monthly.earthlyBranch, '丙申');
  assert.ok(data.currentHoroscope.decadal.palaceNames.includes('命宫'));
});

test('normalizes the only palace name that already includes the 宫 suffix', () => {
  const professional = require(professionalPath);
  const chart = iztro.astro.bySolar('2013-2-10', 6, 'male', true, 'zh-CN');
  const data = professional.buildChatData(chart, {
    y: 2013, m: 2, d: 10, h: 12, min: 0, isMale: true,
  }, { solarDate: '2013-2-10' }, null);

  assert.equal(chart.palaces.find((palace) => palace.earthlyBranch === chart.earthlyBranchOfBodyPalace).name, '命宫');
  assert.equal(professional.normalizePalaceName('命宫'), '命');
  assert.equal(data.bodyPalace, '命');
});

test('uses the four canonical palace triads in the explanatory cards', () => {
  const professional = require(professionalPath);
  assert.deepEqual(
    professional.getPalaceTriadGroups().map((item) => item.palaces),
    [
      ['命宫', '财帛', '官禄'],
      ['兄弟', '疾厄', '田宅'],
      ['夫妻', '迁移', '福德'],
      ['子女', '仆役', '父母'],
    ],
  );
});

test('Ziwei analysis is evidence based instead of fixed good-bad scoring', () => {
  const analysisSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-analysis.js'), 'utf8');
  assert.doesNotMatch(analysisSource, /ZW_GOOD|ZW_BAD|scorePalaceQuality|scoreTriadAxis/);
  assert.doesNotMatch(analysisSource, /晚婚更利|伴侣或合作伙伴的力量开拓事业|命宫综合评分|大吉|中平/);
  assert.match(analysisSource, /ZiweiProfessional\.getBorrowedOpposite/);
  assert.match(analysisSource, /ZiweiProfessional\.getSurroundedEvidence/);
  assert.match(analysisSource, /三方四正/);
});

test('empty-palace copy states borrowing evidence without inferring strength or timing', () => {
  const analysisSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-analysis.js'), 'utf8');
  assert.match(analysisSource, /空宫本身不直接等同于吉、凶、强或弱/);
  assert.match(analysisSource, /借对宫主星作为参照/);
  assert.doesNotMatch(analysisSource, /缘分较弱|晚婚|依靠配偶|一生/);
});

test('Ziwei time scopes and brightness come directly from iztro', () => {
  const renderSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'ziwei-render.js'), 'utf8');
  assert.doesNotMatch(renderSource, /lnByZhi|MINOR_B|ZA_B|function getBright/);
  assert.match(renderSource, /ZiweiProfessional\.getCurrentHoroscope\(zi/);
  assert.match(renderSource, /p\.decadal\s*&&\s*p\.decadal\.range/);
  assert.match(renderSource, /p\.ages\s*\|\|\s*\[\]/);
  assert.match(renderSource, /yearly\.palaceNames\[p\.index\]/);
});
