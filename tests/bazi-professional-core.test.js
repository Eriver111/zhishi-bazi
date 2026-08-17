const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculatorWithInternals() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const countyData = require(path.join(__dirname, '..', 'js', 'county-longitudes.js'));
  const context = { window: {}, CountyLongitudeData: countyData };
  vm.runInNewContext(
    source + '\nwindow.__baziInternals = { getNaYin, getJieQiDates };',
    context
  );
  return {
    calculator: context.window.BaZiCalculator,
    internals: context.window.__baziInternals,
  };
}

test('shared birth normalization records the exact county longitude source', () => {
  const { calculator } = loadCalculatorWithInternals();
  const normalized = calculator.normalizeBirthInput({
    year: 1990, month: 7, day: 12, hour: 9, clock: 18, minute: 0,
    gender: 'male', trueSolarTime: true,
    prov: '河北省', city: '石家庄市', dist: '长安区',
    allowLocationFallback: false,
  });
  assert.equal(normalized.solarInfo.lng, 114.548151);
  assert.deepEqual(
    JSON.parse(JSON.stringify(normalized.solarInfo.locationResolution)),
    {
      longitude: 114.548151,
      level: 'county',
      source: 'administrative-center',
      sourceVersion: 'county-centroid-v1',
      matchedKey: '河北省|石家庄市|长安区',
      estimated: false,
    }
  );
});

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const NAYIN = [
  '海中金','海中金','炉中火','炉中火','大林木','大林木','路旁土','路旁土','剑锋金','剑锋金',
  '山头火','山头火','涧下水','涧下水','城墙土','城墙土','白蜡金','白蜡金','杨柳木','杨柳木',
  '泉中水','泉中水','屋上土','屋上土','霹雳火','霹雳火','松柏木','松柏木','长流水','长流水',
  '砂中金','砂中金','山下火','山下火','平地木','平地木','壁上土','壁上土','金箔金','金箔金',
  '覆灯火','覆灯火','天河水','天河水','大驿土','大驿土','钗钏金','钗钏金','桑柘木','桑柘木',
  '大溪水','大溪水','沙中土','沙中土','天上火','天上火','石榴木','石榴木','大海水','大海水',
];

test('all sixty valid stem-branch pairs use the canonical NaYin mapping', () => {
  const { internals } = loadCalculatorWithInternals();
  for (let index = 0; index < 60; index += 1) {
    const ganIndex = index % 10;
    const zhiIndex = index % 12;
    assert.equal(
      internals.getNaYin(ganIndex, zhiIndex),
      NAYIN[index],
      GAN[ganIndex] + ZHI[zhiIndex]
    );
  }
});

test('2024 LiQiu switches the month pillar at the actual minute, not at 20:00', () => {
  const { calculator } = loadCalculatorWithInternals();
  const before = calculator.calculate(2024, 8, 7, 5, 'male', 8);
  const after = calculator.calculate(2024, 8, 7, 5, 'male', 8.5);
  assert.equal(before.month.gan + before.month.zhi, '辛未');
  assert.equal(after.month.gan + after.month.zhi, '壬申');
});

test('wet earth adjustment remains effective after the later position weighting', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = {
    year: { gan: '庚', zhi: '申' },
    month: { gan: '己', zhi: '丑' },
    day: { gan: '癸', zhi: '卯' },
    hour: { gan: '丁', zhi: '巳' },
  };
  // 湿土修正后的阶段分为33；月干己土紧贴癸水再按位置权重扣1分。
  assert.equal(calculator.calcDayMasterStrength(chart).score, 32);
});

test('the day stem itself does not block a weak following pattern', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = {
    year: { gan: '壬', zhi: '子' },
    month: { gan: '癸', zhi: '亥' },
    day: { gan: '戊', zhi: '子' },
    hour: { gan: '癸', zhi: '卯' },
  };
  assert.equal(calculator.calcDayMasterStrength(chart).level, '极弱');
  assert.equal(calculator.getCongGe(chart).isCong, true);
});

test('a neutral-but-strong chart uses the same favorable elements in annual analysis', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = calculator.buildFromPillars({
    year: { gan: '甲', zhi: '子' },
    month: { gan: '甲', zhi: '子' },
    day: { gan: '癸', zhi: '卯' },
    hour: { gan: '甲', zhi: '子' },
  }, 'male', { year: 1990, month: 6, day: 15, hour: 6 });
  const yongJi = calculator.getYongJi(chart);

  assert.equal(yongJi.dayMasterLevel, '中和');
  assert.ok(yongJi.dayMasterScore >= 50);
  assert.ok(yongJi.xiShen.includes('火'));
  assert.equal(calculator.analyzeThisYear(chart, 'male', yongJi).isFavorable, true);
  assert.equal(calculator.analyzeFortune(chart, 'male', yongJi).years[0].isFavorable, true);
});

test('this-year analysis includes the actual current DaYun when timing exists', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = calculator.calculate(1990, 6, 15, 3, 'male', 6);
  const analysis = calculator.analyzeThisYear(chart, 'male', calculator.getYongJi(chart));
  assert.match(analysis.dyInfo, /大运/);
});

test('a direct branch clash takes precedence over generic five-element control', () => {
  const { calculator } = loadCalculatorWithInternals();
  const relations = calculator.getPillarRelations({
    year: { gan: '甲', zhi: '子' },
    month: { gan: '丙', zhi: '午' },
    day: { gan: '戊', zhi: '辰' },
    hour: { gan: '庚', zhi: '申' },
  });
  assert.equal(relations[0].zhi, '冲');
  assert.match(relations[0].details.join(' '), /六冲/);
});

test('professional displays do not redefine the core strength thresholds', () => {
  const pro = fs.readFileSync(path.join(__dirname, '..', 'js', 'pro-analysis.js'), 'utf8');
  const result = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
  assert.doesNotMatch(pro, /l>=65\?'身强':l>=45\?'中和':'身弱'/);
  assert.doesNotMatch(result, /l>=65\?'身强':l>=45\?'中和':'身弱'/);
});

test('true solar time reports a calendar-day offset when longitude correction crosses midnight', () => {
  const { calculator } = loadCalculatorWithInternals();
  const adjusted = calculator.getTrueSolarHour(0, '新疆', 2024, 1, 15, 10, 0);
  assert.equal(adjusted.dayOffset, -1);
  assert.ok(adjusted.solarMinutes >= 0 && adjusted.solarMinutes < 1440);
});

test('shared birth normalization separates true-solar civil-date changes from Zi-hour pillar changes', () => {
  const { calculator } = loadCalculatorWithInternals();
  const solar = calculator.normalizeBirthInput({
    year: 2024, month: 1, day: 15, hour: 0, clock: 0, minute: 10,
    gender: 'male', location: '新疆', trueSolarTime: true, ziHourNextDay: false,
  });
  // 晚子时（23:00-24:00）换日：civil 日期不变、日柱滚动一天
  const ziHour = calculator.normalizeBirthInput({
    year: 2024, month: 1, day: 15, hour: 0, clock: 23, minute: 0,
    gender: 'male', trueSolarTime: false, ziHourNextDay: true,
  });
  // 早子时（00:00-01:00）不换日（2026-08-10 约定：仅晚子时换日）
  const earlyZi = calculator.normalizeBirthInput({
    year: 2024, month: 1, day: 15, hour: 0, clock: 0, minute: 0,
    gender: 'male', trueSolarTime: false, ziHourNextDay: true,
  });
  assert.deepEqual({ year: solar.year, month: solar.month, day: solar.day }, { year: 2024, month: 1, day: 14 });
  assert.equal(solar.dayPillarOffset, 0);
  assert.deepEqual({ year: ziHour.year, month: ziHour.month, day: ziHour.day }, { year: 2024, month: 1, day: 15 });
  assert.equal(ziHour.dayPillarOffset, 1);
  assert.deepEqual({ year: earlyZi.year, month: earlyZi.month, day: earlyZi.day }, { year: 2024, month: 1, day: 15 });
  assert.equal(earlyZi.dayPillarOffset, 0);
});

test('Zi-hour rollover affects only branch index zero when enabled', () => {
  const { calculator } = loadCalculatorWithInternals();
  for (let hour = 0; hour < 12; hour += 1) {
    const normalized = calculator.normalizeBirthInput({
      year: 2024, month: 6, day: 15, hour, clock: hour === 0 ? 23 : hour * 2,
      minute: 0, gender: 'male', trueSolarTime: false, ziHourNextDay: true,
    });
    assert.equal(normalized.dayPillarOffset, hour === 0 ? 1 : 0, `branch index ${hour}`);
  }
});

test('heavenly-stem combination distinguishes combination from successful transformation', () => {
  const { calculator } = loadCalculatorWithInternals();
  const unsupported = calculator.getGanHe({
    year: { gan: '甲', zhi: '子' },
    month: { gan: '丙', zhi: '寅' },
    day: { gan: '己', zhi: '酉' },
    hour: { gan: '壬', zhi: '子' },
  }).find(item => item.gan1 === '甲' && item.gan2 === '己');
  assert.equal(unsupported.isTransformed, false);
  assert.match(unsupported.desc, /合而不化/);

  const supported = calculator.getGanHe({
    year: { gan: '戊', zhi: '子' },
    month: { gan: '甲', zhi: '辰' },
    day: { gan: '己', zhi: '酉' },
    hour: { gan: '丙', zhi: '午' },
  }).find(item => item.gan1 === '甲' && item.gan2 === '己');
  assert.equal(supported.isTransformed, true);
  assert.match(supported.desc, /化土/);
});

test('pattern output records established or broken status and the break reason', () => {
  const { calculator } = loadCalculatorWithInternals();
  const established = calculator.getPattern({
    year: { gan: '辛', zhi: '亥' },
    month: { gan: '丙', zhi: '寅' },
    day: { gan: '甲', zhi: '子' },
    hour: { gan: '癸', zhi: '亥' },
  });
  assert.equal(established.status, '成格');
  assert.equal(established.isEstablished, true);

  const broken = calculator.getPattern({
    year: { gan: '庚', zhi: '申' },
    month: { gan: '丙', zhi: '寅' },
    day: { gan: '甲', zhi: '子' },
    hour: { gan: '癸', zhi: '亥' },
  });
  assert.equal(broken.status, '破格');
  assert.equal(broken.isEstablished, false);
  assert.ok(broken.breakReasons.some(reason => reason.includes('月令') && reason.includes('冲')));
});

test('month-command special patterns distinguish JianLu from YangRen', () => {
  const { calculator } = loadCalculatorWithInternals();
  const common = {
    year: { gan: '辛', zhi: '亥' },
    day: { gan: '甲', zhi: '子' },
    hour: { gan: '癸', zhi: '亥' },
  };
  const jianLu = calculator.getPattern({ ...common, month: { gan: '丙', zhi: '寅' } });
  const yangRen = calculator.getPattern({ ...common, month: { gan: '丁', zhi: '卯' } });
  assert.equal(jianLu.name, '建禄格');
  assert.equal(yangRen.name, '羊刃格');
  assert.notEqual(jianLu.type, '透干取格');
  assert.notEqual(yangRen.type, '透干取格');
});

test('major canonical blockers mark an otherwise named pattern as broken', () => {
  const { calculator } = loadCalculatorWithInternals();
  const pattern = calculator.getPattern({
    year: { gan: '丁', zhi: '亥' },
    month: { gan: '辛', zhi: '酉' },
    day: { gan: '甲', zhi: '子' },
    hour: { gan: '壬', zhi: '辰' },
  });
  assert.equal(pattern.name, '正官格');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.some(reason => reason.includes('伤官克官')));
});

test('both result renderers show broken-pattern status as secondary copy', () => {
  const pro = fs.readFileSync(path.join(__dirname, '..', 'js', 'pro-analysis.js'), 'utf8');
  const result = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
  assert.match(pro, /p\.status===['"]破格['"]/);
  assert.match(result, /p\.status===['"]破格['"]/);
});

test('the browser result script remains valid JavaScript', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
});

test('AI context preserves structured strength and pattern status', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
  assert.doesNotMatch(api, /\$\{data\.dayMasterStrength\}/);
  assert.match(api, /pt\.status/);
  assert.match(api, /pt\.breakReasons/);
});

test('AI context carries the same three-category yongji evidence used by the report', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
  assert.match(api, /yj\.method/);
  assert.match(api, /yj\.primaryReason/);
  assert.match(api, /yj\.elementReasons/);
  assert.match(api, /用神是喜神中的核心取用/);
  assert.match(api, /只允许使用“用神、喜神、忌神”三类/);
});

test('AI flow never treats a missing element as an automatic remedy', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
  assert.doesNotMatch(api, /五行欠缺：[^\n]*补益/);
  assert.match(api, /缺失不等于喜用/);
});

test('direct-pillar AI context safely handles absent DaYun timing', () => {
  const integration = fs.readFileSync(path.join(__dirname, '..', 'js', 'ai-chat-integration.js'), 'utf8');
  assert.match(integration, /_daYunData\s*&&\s*_daYunData\.list/);
  assert.doesNotMatch(integration, /typeof _daYunData !== ['"]undefined['"]\s*&&\s*_daYunData\.list/);
});

test('TianShe requires the complete seasonal day pillar, not only its branch', () => {
  const { calculator } = loadCalculatorWithInternals();
  const base = {
    year: { gan: '丙', zhi: '子' },
    month: { gan: '庚', zhi: '寅' },
    hour: { gan: '乙', zhi: '卯' },
  };
  const valid = calculator.calculateShenSha({ ...base, day: { gan: '戊', zhi: '寅' } });
  const invalid = calculator.calculateShenSha({ ...base, day: { gan: '甲', zhi: '寅' } });
  assert.ok(valid.some(item => item.name === '天赦'));
  assert.ok(!invalid.some(item => item.name === '天赦'));
});

test('half seasonal combinations require adjacent branches', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  assert.match(source, /has\[0\]\s*&&\s*has\[1\]/);
  assert.match(source, /has\[1\]\s*&&\s*has\[2\]/);
});

test('renyuan seasonal command is exposed as reference evidence without changing strength', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = calculator.calculate(2025, 2, 5, 3, 'female', 6);
  const before = calculator.calcDayMasterStrength(chart);
  const evidence = calculator.getRenYuanEvidence(chart);
  const after = calculator.calcDayMasterStrength(chart);

  assert.equal(evidence.visible, true);
  assert.equal(evidence.days, 3);
  assert.equal(evidence.stem, '戊');
  assert.equal(evidence.element, '土');
  assert.equal(evidence.tenGod, '正财');
  assert.equal(evidence.status, '囚');
  assert.equal(evidence.scoreDelta, -10);
  assert.match(evidence.text, /节气后第3天/);
  assert.match(evidence.text, /仅供参考/);
  assert.deepEqual(after, before);
});

test('renyuan note is hidden when it agrees with benqi or lacks a real date', () => {
  const { calculator } = loadCalculatorWithInternals();
  const sameElement = calculator.calculate(2025, 2, 17, 3, 'female', 6);
  calculator.calcDayMasterStrength(sameElement);
  assert.equal(calculator.getRenYuanEvidence(sameElement).visible, false);

  const directPillars = calculator.buildFromPillars({
    year: { gan: '乙', zhi: '巳' },
    month: { gan: '戊', zhi: '寅' },
    day: { gan: '乙', zhi: '巳' },
    hour: { gan: '己', zhi: '卯' },
  }, 'female');
  assert.equal(calculator.getRenYuanEvidence(directPillars).visible, false);
});

test('professional facts reuse the same renyuan evidence contract', () => {
  const { calculator } = loadCalculatorWithInternals();
  const chart = calculator.calculate(2025, 2, 5, 3, 'female', 6);
  const facts = calculator.getProfessionalReportFacts(chart, 'female');
  assert.deepEqual(facts.renYuan, calculator.getRenYuanEvidence(chart));
  assert.equal(facts.strength.level, calculator.calcDayMasterStrength(chart).level);
});
