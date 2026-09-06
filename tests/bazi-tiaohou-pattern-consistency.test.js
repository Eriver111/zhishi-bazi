const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function pillars(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('丙火生未月时调候说明不覆盖水的正式扶抑忌神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['辛丑', '乙未', '丙寅', '戊戌']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const water = result.candidateScores.find(row => row.wx === '水');

  assert.equal(result.dayMasterScore, 38);
  assert.deepEqual(Array.from(result.yongShen), ['木']);
  assert.ok(result.jiShen.includes('水'), '扶抑方向为负时，水不能被调候强行升为正式喜神');
  assert.ok(!result.xiShen.includes('水'));
  assert.equal(result.elementClassification['水'], '忌神');
  assert.equal(water.role, '忌神');
  assert.match(result.primaryReason, /调候辅助/);
});

test('偏强庚金生亥月时火接管核心调候用神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['丙寅', '己亥', '庚申', '庚辰']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const fire = result.candidateScores.find(row => row.wx === '火');

  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.dayMasterScore, 66); // v2: 日坐禄+2、休令强根联动+4，60→66
  assert.deepEqual(Array.from(result.yongShen), ['火']);
  assert.ok(result.xiShen.includes('火'));
  assert.ok(!result.jiShen.includes('火'));
  assert.equal(result.elementClassification['火'], '用神');
  assert.equal(fire.role, '用神');
});

test('月令食神未透保留冻结的硬破格依据', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['丙寅', '己亥', '庚申', '庚辰']),
    'male'
  );
  const facts = calculator.getProfessionalReportFacts(chart, 'male');

  assert.equal(facts.pattern.name, '食神格');
  assert.equal(facts.pattern.status, '破格');
  assert.ok(facts.pattern.breakReasons.includes('月令用神未透干'));
  assert.match(facts.pattern.desc, /月令食神当令但未透干/);
  assert.doesNotMatch(facts.pattern.desc, /月令透食/);
  assert.ok(facts.pattern.establishConditions.some(row =>
    row.condition === '月令格神透干' && row.met === false && row.category === 'HARD_BREAK'
  ));
});

test('丙火未月水调候不通过候选加分升为正式喜神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['甲子', '辛未', '丙寅', '甲子']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const water = result.candidateScores.find(row => row.wx === '水');

  // v2 合绊后该盘落中和边界 50（SBase=0），基线不再为负；
  // 核心意图不变：水不得经调候加分升为正式喜神
  assert.ok(water.SBase <= 0, '该盘水的扶抑基线不为正');
  assert.equal(water.SNeed, water.SBase, '未月丙火的水调候仅作说明，不进入正式候选加分');
  assert.ok(result.jiShen.includes('水'));
  assert.notEqual(result.elementClassification['水'], '喜神');
  assert.notEqual(water.role, '喜神');
  assert.match(result.primaryReason, /调候辅助/);
});

test('杂格条件不清显示待定而不伪装成破格或成格', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['甲午', '丙辰', '戊寅', '庚申']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const yongJi = calculator.getYongJi(chart);
  const facts = calculator.getProfessionalReportFacts(chart, 'male');

  assert.equal(pattern.name, '杂格');
  assert.equal(pattern.status, '条件待定');
  assert.equal(pattern.isEstablished, false);
  assert.deepEqual(Array.from(pattern.breakReasons), []);
  assert.ok(Array.from(pattern.pendingReasons).includes('月令取格条件不清'));
  assert.equal(yongJi.method, '格局条件待定');
  assert.match(yongJi.primaryReason, /条件待定|条件不足/);
  assert.match(facts.summary, /当前判为条件待定/);
  assert.ok(facts.actionChains.some(row =>
    row.title === '杂格·条件待定' && /月令取格条件不清/.test(row.detail)
  ));
});

test('癸水未月既有极弱盘判断保持原判', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['己酉', '辛未', '癸巳', '丁巳']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const pattern = calculator.getPattern(chart);

  assert.equal(result.dayMasterLevel, '极弱');
  assert.equal(result.dayMasterScore, 14);
  assert.deepEqual(Array.from(result.yongShen), ['水']);
  assert.ok(result.xiShen.includes('金'));
  assert.ok(result.jiShen.includes('火'));
  assert.ok(result.jiShen.includes('土'));
  assert.equal(pattern.status, '破格');
});

test('同五行外透不能冒充月令格神本星透干', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['戊辰', '癸亥', '乙未', '戊寅']),
    'male'
  );
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '正印格');
  assert.equal(pattern.matchMode, 'same-element');
  assert.match(pattern.desc, /月令印星当令但本星未透干/);
  assert.doesNotMatch(pattern.desc, /月令透印/);
  assert.ok(pattern.establishConditions.some(row =>
    row.condition === '月令格神透干' && row.met === false && row.category === 'HARD_BREAK'
  ));
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.includes('月令用神未透干'));
});

test('极弱印格的承载条目只评价层次，不与成格状态互相矛盾', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars(['癸丑', '壬辰', '丁亥', '乙巳']), 'male');
  const pattern = calculator.getPattern(chart);
  const bearing = pattern.establishConditions.find(row => row.condition === '日主有承载格局之力');
  assert.equal(pattern.name, '偏印格');
  assert.equal(pattern.status, '成格');
  assert.equal(bearing.met, false);
  assert.equal(bearing.category, 'QUALITY');
});

test('财生官格同时检查承载、伤官破官和官杀混杂', () => {
  const calculator = loadCalculator();
  const established = calculator.getPattern(calculator.buildFromPillars(pillars(['壬子', '己巳', '壬午', '癸酉']), 'male'));
  const broken = calculator.getPattern(calculator.buildFromPillars(pillars(['壬戌', '丙辰', '辛丑', '乙酉']), 'male'));

  assert.equal(established.name, '财生官格');
  assert.equal(established.status, '成格');
  assert.deepEqual(Array.from(established.establishConditions, row => row.condition), ['日主能担财官', '官星不被伤官克破', '无官杀混杂']);
  assert.ok(established.establishConditions.every(row => row.category === 'HARD_BREAK' && row.met));
  assert.equal(broken.name, '财生官格');
  assert.equal(broken.status, '破格');
  assert.ok(broken.breakReasons.includes('伤官克官，财生官通路受损'));
});

test('财生杀格必须能担财杀且七杀有制化', () => {
  const calculator = loadCalculator();
  const established = calculator.getPattern(calculator.buildFromPillars(pillars(['己亥', '乙亥', '己未', '辛未']), 'male'));
  const broken = calculator.getPattern(calculator.buildFromPillars(pillars(['癸酉', '庚戌', '甲申', '壬申']), 'male'));

  assert.equal(established.name, '财生杀格');
  assert.equal(established.status, '成格');
  assert.ok(established.establishConditions.some(row => row.condition === '七杀有制化' && row.met && row.category === 'HARD_BREAK'));
  assert.equal(broken.name, '财生杀格');
  assert.equal(broken.status, '破格');
  assert.ok(broken.breakReasons.includes('日主极弱，财生杀而难承载'));
  assert.ok(!broken.breakReasons.includes('日主极弱，难以承载格局用神'));
});

test('印星化杀格接入杀印体系的财破印与印力条件', () => {
  const calculator = loadCalculator();
  const established = calculator.getPattern(calculator.buildFromPillars(pillars(['乙酉', '戊申', '壬戌', '乙亥']), 'male'));
  const broken = calculator.getPattern(calculator.buildFromPillars(pillars(['庚寅', '甲午', '戊申', '壬辰']), 'male'));

  assert.equal(established.name, '印星化杀格');
  assert.equal(established.status, '成格');
  assert.ok(established.establishConditions.some(row => row.condition === '印星不被财破' && row.met));
  assert.ok(established.establishConditions.some(row => row.condition === '印星有力（非燥土虚浮）' && row.met));
  assert.equal(broken.name, '印星化杀格');
  assert.equal(broken.status, '破格');
  assert.ok(broken.breakReasons.includes('财星破印，官杀印通路中断'));
});

test('同五行月令不在临官帝旺位时不能冒充建禄格', () => {
  const calculator = loadCalculator();
  const charts = [
    ['戊辰', '乙丑', '己巳', '己巳'],
    ['甲子', '戊辰', '己丑', '戊辰'],
  ];

  charts.forEach(values => {
    const chart = calculator.buildFromPillars(pillars(values), 'male');
    const pattern = calculator.getPattern(chart);
    assert.equal(pattern.name, '杂格');
    assert.doesNotMatch(pattern.desc, /月令为日主禄位/);
    assert.match(pattern.desc, /月令比劫当权/);
    assert.match(pattern.desc, /不作建禄、羊刃论/);
  });
});

test('临官月即使比肩透干仍然保留真正的建禄格', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['庚申', '甲申', '庚辰', '庚辰']),
    'male'
  );
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '建禄格');
  assert.equal(pattern.type, '月令特别格');
  assert.match(pattern.desc, /临官|建禄|禄/);
});

test('冬土仅见弱火时不把调候作用写成已经完成', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['甲申', '丁丑', '己丑', '乙亥']),
    'female'
  );
  const result = calculator.getYongJi(chart);

  assert.deepEqual(Array.from(result.yongShen), ['水']);
  assert.equal(result.elementClassification['火'], '忌神');
  assert.match(result.primaryReason, /原局虽见火/);
  assert.match(result.primaryReason, /根气有限/);
  assert.doesNotMatch(result.primaryReason, /寒谷回春|调候已得/);
});

// 注：下列三盘中 丁巳月、癸亥月两盘为阴干帝旺月（阴刃口径）。2026-08-23 用户裁定
// 下一阶段改判月劫（预案见 _yinren_yuejie_ruling.md），届时这两处断言需随改。
test('羊刃藏官杀未透时说明制刃不足而不是完全无制', () => {
  const calculator = loadCalculator();
  const cases = [
    { gz: ['丁丑', '辛亥', '癸丑', '癸亥'], detail: /官杀藏支未透，制刃不足/ },
    { gz: ['甲午', '丙子', '壬子', '辛亥'], detail: /官杀根受冲/ },
    { gz: ['戊戌', '丁巳', '丁酉', '庚子'], detail: /天干食伤牵制官杀/ },
  ];

  for (const item of cases) {
    const chart = calculator.buildFromPillars(pillars(item.gz), 'male');
    const pattern = calculator.getPattern(chart);
    const control = pattern.establishConditions.find(row => row.condition === '官杀制刃');

    assert.equal(pattern.name, '羊刃格');
    assert.equal(pattern.status, '破格');
    assert.ok(control);
    assert.equal(control.met, false);
    assert.match(control.detail, /官杀藏支未透，制刃不足/);
    assert.match(control.detail, item.detail);
    assert.ok(pattern.breakReasons.some(reason => /官杀藏支未透，制刃不足/.test(reason)));
    assert.ok(!pattern.breakReasons.includes('羊刃无制'));
  }
});

test('建禄财星藏支未透时披露真实位置而不写成无财官', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['庚戌', '辛巳', '戊子', '庚申']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const support = pattern.establishConditions.find(row => row.condition === '财官透出为用');

  assert.equal(pattern.name, '建禄格');
  assert.equal(pattern.status, '破格');
  assert.ok(support);
  assert.equal(support.met, false);
  assert.match(support.detail, /财星藏于日支子但未透干/);
  assert.match(support.detail, /天干食伤已透出泄秀/);
  assert.doesNotMatch(support.detail, /无财官/);
  assert.ok(pattern.breakReasons.some(reason => /财星藏支未透/.test(reason)));
});

test('七杀格把透干伤官计入制杀证据但不改变极弱盘破格状态', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    // 丑为杂气月，七杀本星己土须真实透干；丁财另置时干以保留财党杀条件。
    pillars(['甲寅', '己丑', '癸丑', '丁巳']),
    'female'
  );
  const pattern = calculator.getPattern(chart);
  const control = pattern.establishConditions.find(row => row.condition === '有食伤制杀或印星化杀');

  assert.equal(pattern.name, '七杀格');
  assert.equal(pattern.status, '破格');
  assert.ok(control);
  assert.equal(control.met, true);
  assert.match(control.detail, /伤官制杀/);
  assert.ok(pattern.breakReasons.some(reason => /伤官透出制杀，但日主极弱且财星党杀，制化不足/.test(reason)));
  assert.ok(!pattern.breakReasons.includes('七杀无制化'));
});

test('七杀同时见伤官印财时仍保留极弱财党杀的破格依据', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['壬子', '戊申', '甲戌', '丁卯']),
    'male'
  );
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '七杀格');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.some(reason => /伤官透出制杀，但日主极弱且财星党杀，制化不足/.test(reason)));
});

test('杀印相生同时见财与伤官时只由财破印判破并保留制杀证据', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['甲寅', '己巳', '庚戌', '癸未']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const wealthBlock = pattern.establishConditions.find(row => row.condition === '印星不被财破');
  const outputControl = pattern.establishConditions.find(row => row.condition === '伤官制杀参与制化');

  assert.equal(pattern.name, '杀印相生格');
  assert.equal(pattern.status, '破格');
  assert.equal(pattern.isEstablished, false);
  assert.equal(wealthBlock.met, false);
  assert.equal(wealthBlock.category, 'HARD_BREAK');
  assert.equal(outputControl.met, true);
  assert.equal(outputControl.category, 'QUALITY');
  assert.match(outputControl.detail, /伤官制杀/);
  assert.ok(pattern.breakReasons.some(reason => /财星破印，官杀印通路中断/.test(reason)));
  assert.ok(!pattern.breakReasons.some(reason => /伤官克官|官印链断裂/.test(reason)));
});

test('食神格财星藏支未透时披露真实位置而不写成缺财', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙卯', '戊寅', '壬午', '己酉']),
    'male'
  );
  const yongJi = calculator.getYongJi(chart);
  const pattern = calculator.getPattern(chart);
  const wealthPath = pattern.establishConditions.find(row => row.condition === '食神有生财之路');

  assert.equal(yongJi.dayMasterLevel, '极弱');
  assert.equal(pattern.name, '食神格');
  assert.equal(pattern.status, '破格');
  assert.equal(wealthPath.met, false);
  assert.match(wealthPath.detail, /财星藏于日支午但未透干/);
  assert.doesNotMatch(wealthPath.detail, /缺财星/);
});

test('杀印相生见伤官时按制杀并行判断而不套用伤官克官', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['甲辰', '壬申', '甲子', '丁卯']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const outputControl = pattern.establishConditions.find(row => row.condition === '伤官制杀参与制化');

  assert.equal(calculator.calcDayMasterStrength(chart).level, '中和');
  assert.equal(pattern.name, '杀印相生格');
  assert.equal(pattern.status, '成格');
  assert.ok(outputControl);
  assert.equal(outputControl.met, true);
  assert.equal(outputControl.category, 'QUALITY');
  assert.match(outputControl.detail, /伤官制杀/);
  assert.doesNotMatch(outputControl.detail, /伤官克官|官印链断裂/);
  assert.ok(!pattern.breakReasons.some(reason => /伤官克官|官印链断裂/.test(reason)));
});

test('七杀格只见藏支印星时说明化杀不足而不写无制无化', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['壬子', '壬子', '丁丑', '壬寅']),
    'female'
  );
  const pattern = calculator.getPattern(chart);
  const control = pattern.establishConditions.find(row => row.condition === '有食伤制杀或印星化杀');

  assert.equal(pattern.name, '七杀格');
  assert.equal(pattern.status, '破格');
  assert.equal(control.met, false);
  assert.match(control.detail, /印星藏于时支寅但未透干，化杀力量不足/);
  assert.doesNotMatch(control.detail, /无制无化/);
  assert.ok(pattern.breakReasons.some(reason => /印星藏支未透，化杀力量不足/.test(reason)));
  assert.ok(!pattern.breakReasons.includes('七杀无制化'));
});

test('七杀格藏印说明细化后仍沿用无制化救应取用', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['癸酉', '乙卯', '己丑', '己巳']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const yongJi = calculator.getYongJi(chart);

  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.includes('印星藏支未透，化杀力量不足'));
  assert.deepEqual(Array.from(yongJi.yongShen), ['火']);
});

test('伤官格只见藏支印星时披露制伤不足而不写缺印', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['己亥', '丁丑', '丙申', '壬辰']),
    'male'
  );
  const pattern = calculator.getPattern(chart);
  const yongJi = calculator.getYongJi(chart);
  const control = pattern.establishConditions.find(row => row.condition === '有印星制伤或财星引化');

  assert.equal(yongJi.dayMasterLevel, '极弱');
  assert.deepEqual(Array.from(yongJi.yongShen), ['木']);
  assert.equal(pattern.name, '伤官格');
  assert.equal(pattern.status, '破格');
  assert.equal(control.met, false);
  assert.match(control.detail, /印星藏于年支亥、时支辰但未透干，制伤力量不足/);
  assert.doesNotMatch(control.detail, /缺印|无制无化/);
});
