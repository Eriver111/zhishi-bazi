const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const Anchor = require(path.join(root, 'js', 'deep-report-anchor.js'));

function fixtureFacts(injected = '') {
  const sentence = injected || '依据来自同一份冻结事实，需结合现实条件观察。';
  const evidence = [{ label: '证据', text: sentence }];
  const annual = year => ({
    year,
    pillar: { gan: '丙', zhi: '午' },
    daYun: { gan: '甲', zhi: '辰' },
    career: { conclusion: sentence, evidence },
    wealth: { conclusion: sentence, evidence },
    relationship: { conclusion: sentence, evidence },
    study: { conclusion: sentence, evidence },
    wellbeing: { conclusion: '留意作息与情绪管理。', conditions: ['仅作身心状态风险提示，不作诊断'] },
    triggeredRisks: [],
    reliefs: [],
  });
  return {
    schemaVersion: '2.0.0',
    anchorYear: 2026,
    chartIdentity: '甲子 乙丑 丙寅 丁卯',
    core: {},
    wealth: {
      summaryLevel: '稳健',
      resource: { conclusion: sentence, evidence },
      capacity: { state: '可承接', conclusion: sentence, conditions: ['结合承载与路径'] },
      pathways: [{ type: '实践转化', conclusion: sentence, evidence }],
      retention: { conclusion: sentence, risks: [], evidence },
      storage: { conclusion: sentence, evidence },
      evidence,
    },
    relationship: {
      spouseStar: { roles: ['正财', '偏财'], quality: { visibility: '透藏并见' }, evidence },
      palace: { zhi: '寅', evidence },
      interaction: { direction: '夫妻宫生身', conclusion: sentence },
      distance: { label: '身边长期接触圈的弱信号', evidence },
      age: { label: '年龄远近证据不足', evidence },
      appearance: { conclusion: '外在气质特征不集中，仅作倾向参考。', evidence },
      stability: { conclusion: '关系议题需结合现实安排、边界和救应观察。', evidence },
      evidence,
    },
    study: {
      absorption: { state: '有承接', conclusion: sentence, evidence },
      expression: { state: '稳定输出', conclusion: sentence, evidence },
      discipline: { state: '有规则承接', conclusion: sentence, evidence },
      application: { state: '实践转化', conclusion: sentence, evidence },
      path: { type: '技术型', conclusion: sentence, conditions: ['以现实反馈校准'], evidence },
      obstacles: [],
      auxiliary: [{ name: '文昌', conclusion: '仅作辅助提示，不能单独决定学习路径或学业结果。', evidence }],
    },
    currentYear: annual(2026),
    fiveYear: { anchorYear: 2026, hasDaYun: true, years: [annual(2026), annual(2027), annual(2028), annual(2029), annual(2030)], transitions: [], trend: { label: '按年观察与节奏收敛', evidence } },
  };
}

function renderFixture(options = {}) {
  const ids = [
    'thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent',
    'thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection',
  ];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    id,
    innerHTML: '',
    style: {},
    classList: { add() {} },
  }]));
  const document = {
    addEventListener() {},
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  let buildFactsCalls = 0;
  let receivedOptions = null;
  const context = {
    console,
    document,
    window: {
      DeepReportAnchor: { resolve() { return 2026; } },
      DeepReport: {
        buildFacts(_bazi, _gender, buildOptions) {
          buildFactsCalls += 1;
          receivedOptions = buildOptions;
          return options.facts || fixtureFacts(options.injected);
        },
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8'), context);
  vm.runInContext('_bazi = { year: {}, month: {}, day: {}, hour: {} }; _params = { gender: "male" }; renderPaidContent(); renderPaidContent();', context);
  return {
    nodes,
    buildFactsCalls,
    receivedOptions,
    html: ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent']
      .map(id => nodes[id].innerHTML).join('\n'),
  };
}

function createInitFixture({ search, storage, now, facts = fixtureFacts() }) {
  const ids = ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent', 'thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection'];
  const nodes = Object.fromEntries(ids.map(id => [id, { id, innerHTML: '', style: {}, classList: { add() {} } }]));
  let ready;
  let buildOptions;
  let paywallParams;
  let buildResultParams;
  const document = {
    addEventListener(event, callback) { if (event === 'DOMContentLoaded') ready = callback; },
    getElementById(id) { return nodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new RealDate(now).getTime(); }
  }
  const context = {
    console,
    document,
    Date: FrozenDate,
    URLSearchParams,
    window: {
      location: { search },
      localStorage: storage,
      BaZiCalculator: {
        normalizeBirthInput(input) { return { ...input, dayPillarOffset: 0, solarInfo: null }; },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'deep-report-anchor.js'), 'utf8'), context);
  context.window.DeepReport = {
    buildFacts(_bazi, _gender, options) { buildOptions = options; return facts; },
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);
  context.buildResultData = function(params) {
    buildResultParams = params;
    return { bazi: { year:{gan:'甲',zhi:'子'}, month:{gan:'乙',zhi:'丑'}, day:{gan:'丙',zhi:'寅'}, hour:{gan:'丁',zhi:'卯'} }, daYun:null, shenSha:[], hasTiming:true };
  };
  context.render = function() { vm.runInContext('renderPaidContent(); initPaywall(_params);', context); };
  vm.runInContext('initPaywall = function(params) { globalThis.__capturedPaywallParams = params; };', context);
  ready();
  return { context, nodes, buildOptions, paywallParams: context.__capturedPaywallParams || paywallParams, buildResultParams, makeLocalReportKey: context.makeLocalReportKey };
}

test('five paid sections render from one deep report fact object', () => {
  const rendered = renderFixture();
  assert.equal(rendered.buildFactsCalls, 1);
  for (const id of ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent']) {
    assert.notEqual(rendered.nodes[id].innerHTML, '');
  }
});

test('paid report escapes all fact text before HTML insertion', () => {
  const rendered = renderFixture({ injected: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(rendered.html, /<img/);
  assert.match(rendered.html, /&lt;img/);
});

test('rendered copy contains no prohibited deterministic claims', () => {
  const rendered = renderFixture();
  assert.doesNotMatch(rendered.html, /千万|百万级|必发财|必结婚|必离婚|克夫|克妻|患病|大凶|死亡/);
});

test('resolved anchor year is passed to the single facts build', () => {
  const rendered = renderFixture();
  assert.equal(rendered.receivedOptions.anchorYear, 2026);
});

test('anchor year is not part of payment identity source', () => {
  const paywall = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  assert.doesNotMatch(paywall, /report_year|reportYear|anchorYear/);
});

test('Task 6 anchor precedence and guest rollover stay outside report identity', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  assert.equal(Anchor.resolve({ reportYear: 2026, chartKey: 'chart', storage, now: new Date('2030-01-01T00:00:00+08:00') }), 2026);
  assert.equal(Anchor.resolve({ chartKey: 'guest', storage, now: new Date('2026-12-31T20:00:00+08:00') }), 2026);
  assert.equal(Anchor.resolve({ chartKey: 'guest', storage, now: new Date('2027-01-01T00:00:00+08:00') }), 2026);
  const paywall = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const result = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');
  assert.doesNotMatch(paywall, /report_year|reportYear|anchorYear/);
  assert.match(result, /delete\s+_params\.reportYear/);
});

test('real result initialization passes report_year anchor and strips it from paywall identity', () => {
  const storage = { getItem() { return null; }, setItem() {} };
  const fixture = createInitFixture({
    search: '?year=1990&month=1&day=1&hour=0&gender=male&report_year=2026',
    storage,
    now: '2030-01-01T00:00:00+08:00',
  });
  assert.equal(fixture.buildOptions.anchorYear, 2026);
  assert.equal(fixture.paywallParams.reportYear, undefined);
  assert.doesNotMatch(JSON.stringify(fixture.paywallParams), /report_year|reportYear/);
  assert.doesNotMatch(fixture.makeLocalReportKey(fixture.paywallParams), /report_year|reportYear/);
  assert.equal(fixture.buildResultParams.reportYear, undefined);
});

test('real guest result initialization reuses the first anchor year across a China-year rollover', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const first = createInitFixture({
    search: '?year=1990&month=1&day=1&hour=0&gender=male',
    storage,
    now: '2026-12-31T20:00:00+08:00',
  });
  const second = createInitFixture({
    search: '?year=1990&month=1&day=1&hour=0&gender=male',
    storage,
    now: '2027-01-01T00:00:00+08:00',
  });
  assert.equal(first.buildOptions.anchorYear, 2026);
  assert.equal(second.buildOptions.anchorYear, 2026);
});

test('missing chart or params renders one explicit error card in every paid section', () => {
  const ids = ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent'];
  const nodes = Object.fromEntries(ids.concat(ids.map(id => id.replace('Content', 'Section'))).map(id => [id, { innerHTML: '', style: {}, classList: { add() {} } }]));
  const context = { console, document: { addEventListener() {}, getElementById(id) { return nodes[id] || null; }, querySelector() { return null; }, querySelectorAll() { return []; } }, window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8'), context);
  vm.runInContext('_bazi = null; _params = null; renderPaidContent();', context);
  for (const id of ids) {
    assert.match(nodes[id].innerHTML, /专业报告暂时无法生成/);
    assert.match(nodes[id].innerHTML, /重试/);
  }
});
