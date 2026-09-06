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

function pillars(text) {
  const records = text.split(' ').map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('辛金丑月：湿库厚土、火再生土且无申酉本气根时，不再机械判为得令身强', () => {
  const calculator = loadCalculator();
  const chart = pillars('戊辰 乙丑 辛巳 甲午');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const burialStages = strength.audit.stages.filter(stage => stage.id === 'thick-earth-buries-metal');

  assert.equal(strength.score, 39);
  assert.equal(strength.level, '偏弱');
  assert.match(strength.detail, /湿库厚土成势/);
  assert.equal(strength.audit.sumMatches, true);
  assert.equal(burialStages.length, 1, '厚土埋金必须作为合并事件只结算一次');
  assert.equal(burialStages[0].delta, -18);
  assert.equal(burialStages[0].meta.hasIntactMetalRoot, false);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'dry-earth-buries-metal').delta, 0);
});

test('厚土埋金型身弱不再把致病印土选作用神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('戊辰 乙丑 辛巳 甲午'), 'male');
  const yongJi = calculator.getYongJi(chart);
  const ledger = Object.fromEntries(yongJi.elementRoleLedger.entries.map(item => [item.element, item]));

  assert.equal(yongJi.weaknessCause.type, '厚土埋金');
  assert.deepEqual(Array.from(yongJi.yongShen), ['木']);
  assert.equal(yongJi.elementClassification.木, '用神');
  assert.match(yongJi.elementClassification.水, /喜/);
  assert.equal(yongJi.elementClassification.金, '条件喜神');
  assert.equal(yongJi.elementClassification.土, '忌神');
  assert.equal(yongJi.elementClassification.火, '忌神');
  assert.match(yongJi.conditionalAuxiliaryReason, /土未松|厚土/);
  assert.match(ledger.木.functions.join('；'), /疏松厚土/);
  assert.match(ledger.土.risks.join('；'), /由生金转为埋金/);
});

test('护栏：申酉本气强根完整时，湿库厚土不触发埋金扣分', () => {
  const calculator = loadCalculator();
  const chart = pillars('庚申 戊辰 辛丑 丁酉');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const burial = strength.audit.stages.find(stage => stage.id === 'thick-earth-buries-metal');

  assert.equal(burial.delta, 0);
  assert.equal(burial.meta.applies, false);
  assert.equal(burial.meta.hasIntactMetalRoot, true);
});

test('杂气丑月藏干均未精确透出时，不拿同五行戊土冒充己土取偏印格', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('戊辰 乙丑 辛巳 甲午'), 'male');
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '杂格');
  assert.equal(pattern.type, '杂气月待取格');
  assert.equal(pattern.status, '条件待定');
  assert.match(pattern.source, /丑藏己、癸、辛/);
  assert.doesNotMatch(pattern.source, /同属土气|取偏印格/);
});

test('护栏：杂气丑月本气己土真实透出时，仍按精确透干取偏印格', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('戊辰 己丑 辛巳 甲午'), 'male');
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '偏印格');
  assert.equal(pattern.matchMode, 'exact-canggan');
  assert.match(pattern.source, /月支丑藏己，透于月柱/);
});
