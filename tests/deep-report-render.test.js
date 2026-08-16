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
    fetch() { return Promise.resolve({ ok: true, json: async () => ({ unlocked: false }) }); },
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

function createInitFixture({ search, storage, now, facts = fixtureFacts(), authenticated = false, accessResponse = null }) {
  const ids = ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent', 'thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection'];
  const nodes = {};
  const rootNode = { id: 'root', children: [], appendChild(node) { node.parentNode = this; this.children.push(node); if (node.id) nodes[node.id] = node; return node; }, insertBefore(node) { return this.appendChild(node); } };
  function makeNode(id) {
    return { id, innerHTML: '', textContent: '', style: {}, offsetHeight: 160,
      classList: { add() {}, remove() {} }, parentNode: rootNode,
      addEventListener() {}, setAttribute() {}, removeAttribute() {},
      appendChild(node) { node.parentNode = this; if (node.id) nodes[node.id] = node; return node; },
      insertBefore(node) { return this.appendChild(node); },
      remove() { if (this.parentNode && this.parentNode.children) this.parentNode.children = this.parentNode.children.filter(child => child !== this); },
      querySelectorAll() { return []; } };
  }
  ids.forEach(id => { nodes[id] = makeNode(id); });
  let ready;
  let buildOptions;
  const buildOptionsHistory = [];
  let buildResultParams;
  const document = {
    addEventListener(event, callback) { if (event === 'DOMContentLoaded') ready = callback; },
    getElementById(id) {
      if (['unifiedReport', 'rptPaywall', 'rptAccessGate'].includes(id)) return nodes[id] || null;
      return nodes[id] || (nodes[id] = makeNode(id));
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeNode(''); },
    body: rootNode,
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
    localStorage: storage,
    setTimeout,
    clearTimeout,
    fetch() {
      return Promise.resolve({ ok: true, json: async () => accessResponse || { unlocked: false, paid_at: null } });
    },
    window: {
      location: { search },
      localStorage: storage,
      PillarInput: { fromSearchParams() { return { year: {}, month: {}, day: {}, hour: {} }; } },
      BaZiCalculator: {
        normalizeBirthInput(input) { return { ...input, dayPillarOffset: 0, solarInfo: null }; },
      },
    },
  };
  if (authenticated) {
    context.Auth = {
      isLoggedIn() { return true; },
      getToken() { return 'token'; },
      ready(callback) { callback(); },
      syncData() {},
      getData() { return Promise.resolve('[]'); },
    };
  }
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'deep-report-anchor.js'), 'utf8'), context);
  context.window.DeepReport = {
    buildFacts(_bazi, _gender, options) { buildOptions = options; buildOptionsHistory.push(options); return facts; },
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);
  context.buildResultData = function(params) {
    buildResultParams = params;
    return { bazi: { year:{gan:'甲',zhi:'子'}, month:{gan:'乙',zhi:'丑'}, day:{gan:'丙',zhi:'寅'}, hour:{gan:'丁',zhi:'卯'} }, daYun:null, shenSha:[], hasTiming:false };
  };
  for (const name of ['renderSiZhu', 'renderRiZhuJieXi', 'renderPillarAnalysis', 'renderDayMasterPower', 'renderPattern', 'renderYongJi', 'renderCharacter', 'renderParents']) {
    context[name] = function() {};
  }
  ready();
  return { context, nodes, buildOptions, buildOptionsHistory, paywallParams: context._baziPayParams, buildResultParams, makeLocalReportKey: context.makeLocalReportKey };
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
  assert.equal(Anchor.resolve({ reportYear: 2026, chartKey: 'chart', storage, now: new Date('2030-01-01T00:00:00+08:00') }), 2030);
  assert.equal(Anchor.resolve({ chartKey: 'guest', storage, now: new Date('2026-12-31T20:00:00+08:00') }), 2026);
  assert.equal(Anchor.resolve({ chartKey: 'guest', storage, now: new Date('2027-01-01T00:00:00+08:00') }), 2026);
  const paywall = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const result = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');
  assert.doesNotMatch(paywall, /report_year|reportYear|anchorYear/);
  assert.match(result, /delete\s+_params\.reportYear/);
});

test('guest result initialization ignores report_year and strips it from paywall identity', () => {
  const storage = { getItem() { return null; }, setItem() {} };
  const fixture = createInitFixture({
    search: '?mode=pillars&timing=unknown&yg=%E7%94%B2&yz=%E5%AD%90&mg=%E4%B9%99&mz=%E4%B8%91&dg=%E4%B8%99&dz=%E5%AF%85&hg=%E4%B8%81&hz=%E5%8D%AF&gender=male&report_year=2026',
    storage,
    now: '2030-01-01T00:00:00+08:00',
  });
  assert.equal(fixture.buildOptions.anchorYear, 2030);
  assert.equal(fixture.paywallParams.reportYear, undefined);
  assert.doesNotMatch(JSON.stringify(fixture.paywallParams), /report_year|reportYear/);
  assert.doesNotMatch(fixture.makeLocalReportKey(fixture.paywallParams), /report_year|reportYear/);
  assert.equal(fixture.context._baziHash, fixture.makeLocalReportKey(fixture.paywallParams));
  assert.equal(fixture.buildResultParams.reportYear, undefined);
});

test('relationship rendering exposes escaped palace, spouse quality, day events and conditional risks', () => {
  const facts = fixtureFacts();
  facts.relationship.palace = {
    zhi: '寅', element: '木', elementRole: '喜神',
    hiddenTenGods: [{ gan: '<img src=x>', role: '比肩', layer: '本气' }],
    dayInvolvingEvents: [{ type: '六合', detail: '日支关系事件' }],
    risks: [{ type: '关系边界', why: '仅在相关条件引动时观察' }],
  };
  facts.relationship.spouseStar.quality = {
    visibility: '透藏并见', strengthTendency: '有根气响应', rooted: true,
    rolePurity: '单一口径', elementRole: '用神',
  };
  const rendered = renderFixture({ facts });

  assert.match(rendered.nodes.marriageContent.innerHTML, /夫妻宫藏干与十神/);
  assert.match(rendered.nodes.marriageContent.innerHTML, /配偶星质量/);
  assert.match(rendered.nodes.marriageContent.innerHTML, /日柱关系事件/);
  assert.match(rendered.nodes.marriageContent.innerHTML, /条件性结构风险/);
  assert.match(rendered.nodes.marriageContent.innerHTML, /可信度/);
  assert.match(rendered.nodes.marriageContent.innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(rendered.nodes.marriageContent.innerHTML, /<img src=x>/);
});

test('study rendering exposes each chain evidence, blockers and confidence', () => {
  const facts = fixtureFacts();
  facts.study.chains = [{
    id: 'sha_yin', present: true, confidence: 'medium',
    conclusion: '杀印链只作条件性学习结构参考。',
    evidence: ['七杀与印星均有实际出现证据'],
    blockers: ['仍需现实执行反馈'],
    conditions: ['不承诺学历或录取结果'],
  }];
  const rendered = renderFixture({ facts });

  assert.match(rendered.nodes.studyContent.innerHTML, /杀印相生链/);
  assert.match(rendered.nodes.studyContent.innerHTML, /七杀与印星均有实际出现证据/);
  assert.match(rendered.nodes.studyContent.innerHTML, /仍需现实执行反馈/);
  assert.match(rendered.nodes.studyContent.innerHTML, /可信度：medium/);
  assert.doesNotMatch(rendered.nodes.studyContent.innerHTML, /必然录取|必得学历/);
});

test('paid rendering neutralizes deterministic legacy risk wording', () => {
  const facts = fixtureFacts();
  facts.currentYear.triggeredRisks = [{
    type: '旧风险判词',
    detail: '事业/家庭根基动摇，属于大凶，谨防口舌官非、工作变动、与上级冲突。',
  }];
  const rendered = renderFixture({ facts });
  assert.doesNotMatch(rendered.nodes.thisYearContent.innerHTML, /根基动摇|大凶|谨防口舌官非/);
  assert.match(rendered.nodes.thisYearContent.innerHTML, /可能调整|条件性波动|沟通/);
});

test('authenticated access paid_at anchors the only report build despite URL tampering', async () => {
  const storage = { getItem() { return null; }, setItem() {} };
  const fixture = createInitFixture({
    search: '?mode=pillars&timing=unknown&yg=%E7%94%B2&yz=%E5%AD%90&mg=%E4%B9%99&mz=%E4%B8%91&dg=%E4%B8%99&dz=%E5%AF%85&hg=%E4%B8%81&hz=%E5%8D%AF&gender=male&report_year=2099',
    storage,
    now: '2030-01-01T00:00:00+08:00',
    authenticated: true,
    accessResponse: { unlocked: true, paid_at: '2026-07-30T12:00:00.000Z' },
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(fixture.buildOptionsHistory.map(item => item.anchorYear), [2026]);
  assert.doesNotMatch(JSON.stringify(fixture.paywallParams), /report_year|reportYear/);
});

test('real guest result initialization reuses the first anchor year across a China-year rollover', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const first = createInitFixture({
    search: '?mode=pillars&timing=unknown&yg=%E7%94%B2&yz=%E5%AD%90&mg=%E4%B9%99&mz=%E4%B8%91&dg=%E4%B8%99&dz=%E5%AF%85&hg=%E4%B8%81&hz=%E5%8D%AF&gender=male',
    storage,
    now: '2026-12-31T20:00:00+08:00',
  });
  const second = createInitFixture({
    search: '?mode=pillars&timing=unknown&yg=%E7%94%B2&yz=%E5%AD%90&mg=%E4%B9%99&mz=%E4%B8%91&dg=%E4%B8%99&dz=%E5%AF%85&hg=%E4%B8%81&hz=%E5%8D%AF&gender=male',
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
