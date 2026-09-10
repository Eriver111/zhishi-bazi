const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
  return context.window.BaZiCalculator;
}

function chartOf(calculator, text, gender = 'male') {
  const records = text.split(' ').map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return calculator.buildFromPillars({ year: records[0], month: records[1], day: records[2], hour: records[3] }, gender);
}

function entryOf(result, element) {
  return result.elementRoleLedger.entries.find(item => item.element === element);
}

test('寒湿厚土弱木把寅卯根与甲乙浮透分开裁决', () => {
  const calculator = loadCalculator();
  const result = calculator.getYongJi(chartOf(calculator, '丁丑 癸丑 乙丑 癸未', 'female'));
  const wood = entryOf(result, '木');
  const fire = entryOf(result, '火');

  assert.equal(result.elementRoleLedger.version, 'element-role-ledger-v3');
  assert.deepEqual(Array.from(wood.carrierGuidance.preferredBranches), ['寅', '卯']);
  assert.equal(wood.carrierGuidance.requiresMainRoot, true);
  assert.match(wood.carrierGuidance.summary, /首喜寅、卯本气根/);
  assert.match(wood.carrierGuidance.stemCondition, /甲、乙只透不根仍属浮木/);
  assert.match(fire.carrierGuidance.summary, /兼调候.*不是越多越好/);

  const floatingJia = calculator.classifyFortuneElement('木', result, '测试甲申', {
    type: 'stem', symbol: '甲', companionElement: '金', companionSymbol: '申'
  });
  const rootedJia = calculator.classifyFortuneElement('木', result, '测试甲寅', {
    type: 'stem', symbol: '甲', companionElement: '木', companionSymbol: '寅'
  });
  const yinRoot = calculator.classifyFortuneElement('木', result, '测试寅运', {
    type: 'branch', symbol: '寅', companionElement: '木', companionSymbol: '甲'
  });

  assert.equal(floatingJia.carrierStatus, '透而待根');
  assert.ok(floatingJia.score < floatingJia.baseScore);
  assert.equal(rootedJia.carrierStatus, '透而有根');
  assert.ok(rootedJia.score > rootedJia.baseScore);
  assert.equal(yinRoot.carrierStatus, '落地得力');
});

test('水多木漂时戌未燥土与辰丑湿土不再等效', () => {
  const calculator = loadCalculator();
  const result = calculator.getYongJi(chartOf(calculator, '壬子 癸亥 乙亥 壬子'));
  const earth = entryOf(result, '土');

  assert.equal(earth.carrierGuidance.preferDryEarth, true);
  assert.deepEqual(Array.from(earth.carrierGuidance.preferredBranches), ['戌', '未']);
  assert.match(earth.carrierGuidance.summary, /辰、丑湿土不能等量代替/);

  const xu = calculator.classifyFortuneElement('土', result, '测试戌运', { type:'branch', symbol:'戌' });
  const chou = calculator.classifyFortuneElement('土', result, '测试丑运', { type:'branch', symbol:'丑' });
  assert.equal(xu.carrierStatus, '落地得力');
  assert.equal(chou.carrierStatus, '同类未必同效');
  assert.ok(xu.score > chou.score);
});

test('食伤旺身弱与财多身弱分别输出印根、比劫根的载体任务', () => {
  const calculator = loadCalculator();
  const outputDrain = calculator.getYongJi(chartOf(calculator, '壬子 丙午 甲午 丁巳'));
  const wealthDrain = calculator.getYongJi(chartOf(calculator, '甲子 甲子 己亥 丙戌'));
  const outputSeal = entryOf(outputDrain, '水');
  const wealthPeer = entryOf(wealthDrain, '土');

  assert.equal(outputDrain.weaknessCause.type, '食伤泄身');
  assert.match(outputSeal.carrierGuidance.summary, /制食伤并生身/);
  assert.equal(outputSeal.carrierGuidance.requiresRoot, true);
  assert.equal(wealthDrain.weaknessCause.type, '财多耗身');
  assert.match(wealthPeer.carrierGuidance.summary, /落根分财/);
  assert.equal(wealthPeer.carrierGuidance.requiresRoot, true);
});

test('身强也按来源区分财制印、官制比劫和食伤泄秀的落点', () => {
  const calculator = loadCalculator();
  const sealStrong = calculator.getYongJi(chartOf(calculator, '癸未 己卯 丁亥 丙寅'));
  const peerStrong = calculator.getYongJi(chartOf(calculator, '己亥 丙子 壬申 甲辰'));
  const metalWealth = entryOf(sealStrong, '金');
  const earthOfficer = entryOf(peerStrong, '土');
  const woodOutput = entryOf(peerStrong, '木');

  assert.equal(sealStrong.strongCause.type, '印旺生身');
  assert.match(metalWealth.carrierGuidance.summary, /制印并承接食伤/);
  assert.equal(metalWealth.carrierGuidance.requiresRoot, true);
  assert.equal(peerStrong.strongCause.type, '比劫成势');
  assert.match(earthOfficer.carrierGuidance.summary, /制约成势比劫/);
  assert.match(woodOutput.carrierGuidance.summary, /透出泄秀/);
});

test('前端与 AI 上下文都公开干支落点，不把载体裁决藏在内部', () => {
  const calculator = loadCalculator();
  const chart = chartOf(calculator, '丁丑 癸丑 乙丑 癸未', 'female');
  const yongJi = calculator.getYongJi(chart);
  const apiContext = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern,
    yongJi,
  });
  const resultSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');

  assert.match(apiContext, /干支落点：首喜寅、卯本气根/);
  assert.match(resultSource, /干支落点/);
  assert.match(resultSource, /carrierGuidance/);
});
