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
    overallTriggers: [],
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
    cloneNode() {
      return { innerHTML: this.innerHTML, querySelectorAll() { return []; } };
    },
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
  vm.runInContext('_bazi = { year: {}, month: {}, day: {}, hour: {} }; _params = { gender: "male", mode: "pillars", timing: "unknown" }; renderPaidContent(); renderPaidContent();', context);
  const sectionContent = {
    thisYearSection: 'thisYearContent', marriageSection: 'marriageContent', wealthSection: 'wealthContent',
    studySection: 'studyContent', fortuneSection: 'fortuneContent',
  };
  Object.entries(sectionContent).forEach(([sectionId, contentId]) => {
    nodes[sectionId].innerHTML = nodes[contentId].innerHTML;
  });
  const pdfHtml = vm.runInContext('buildReportHTML()', context);
  return {
    nodes,
    buildFactsCalls,
    receivedOptions,
    html: ['thisYearContent', 'marriageContent', 'wealthContent', 'studyContent', 'fortuneContent']
      .map(id => nodes[id].innerHTML).join('\n'),
    pdfHtml,
  };
}

function createInitFixture({ search, storage, now, facts = fixtureFacts(), authenticated = false, accessResponse = null, normalizeBirthInput = null }) {
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
        normalizeBirthInput(input) {
          return normalizeBirthInput
            ? normalizeBirthInput(input)
            : { ...input, dayPillarOffset: 0, solarInfo: null };
        },
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

test('payment identity keeps the original birth clock before true-solar normalization', () => {
  const storage = { getItem() { return null; }, setItem() {} };
  const fixture = createInitFixture({
    search: '?year=1990&month=7&day=12&hour=9&clock=18&gender=male&prov=广东省&city=广州市&dist=天河区',
    storage,
    now: '2026-08-23T12:00:00+08:00',
    normalizeBirthInput(input) {
      return { ...input, hour: 9, clock: 17.55, dayPillarOffset: 0, solarInfo: { solarMinutes: 1053 } };
    },
  });

  assert.equal(fixture.paywallParams.clock, 18);
  assert.equal(fixture.paywallParams.reportClockNormalized, false);
  assert.equal(fixture.buildResultParams.clock, 17.55);
});

test('historical fractional-clock report restores without rejecting or normalizing twice', () => {
  const storage = { getItem() { return null; }, setItem() {} };
  let normalizationInput;
  const fixture = createInitFixture({
    search: '?year=1990&month=7&day=12&hour=9&clock=17.55&gender=male&prov=广东省&city=广州市&dist=天河区&solar=1&report_clock_normalized=1',
    storage,
    now: '2026-08-23T12:00:00+08:00',
    normalizeBirthInput(input) {
      normalizationInput = input;
      return { ...input, dayPillarOffset: 0, solarInfo: null };
    },
  });

  assert.equal(fixture.paywallParams.clock, 17.55);
  assert.equal(fixture.paywallParams.reportClockNormalized, true);
  assert.equal(normalizationInput.trueSolarTime, false);
  assert.equal(fixture.buildResultParams.clock, 17.55);
});

test('customer narrative hides internal evidence cards while keeping decisive Chinese conclusions in page and PDF', () => {
  const facts = fixtureFacts();
  const narrative = {
    grade: 'A7', level: '百万元级', difficulty: '需要持续经营',
    headline: '你不是赚不到钱，真正的问题是收入增加后也容易被长期投入分走。',
    painPoint: '最大的财富漏洞，是把能赚钱误当成能留下钱。',
    paragraphs: ['更适合依靠专业能力和项目经验放大收入。', '控制低回报投入后，财富留存会更稳定。'],
    actions: ['优先建立可重复成交的收入来源。'],
    note: '财富等级表示个人净资产峰值的命局量级参考。',
  };
  facts.wealth.narrative = narrative;
  const rendered = renderFixture({ facts });
  const page = rendered.nodes.wealthContent.innerHTML;

  assert.match(page, /A7/);
  assert.doesNotMatch(page, /百万元级|元级|万元级|亿元级/);
  assert.match(page, /真正的问题/);
  assert.doesNotMatch(rendered.pdfHtml, /百万元级|元级|万元级|亿元级/);
  assert.doesNotMatch(page, /资源质量依据|月令与季节|根气|生源|关系质量|可信度|<strong>依据<\/strong>/);
  assert.doesNotMatch(page, /你最应该做的事/);
});

test('relationship narrative removes the score strip without affecting scores in other paid sections', () => {
  const facts = fixtureFacts();
  facts.relationship.narrative = {
    hideScore: true,
    headline: '另一半的主见更强，你容易觉得自己被管得多。',
    painPoint: '两个人容易一阵亲近、一阵疏远。',
    verdicts: [{ title: '命盘依据', text: '夫妻宫受冲，所以感情状态更容易发生明显变化。' }],
    note: '依据夫妻宫与配偶星推演。',
  };
  facts.wealth.narrative = {
    grade: 'A6', level: '十万元级', difficulty: '需要持续经营',
    headline: '财富结论', painPoint: '财富短板', verdicts: [], note: '财富说明。',
  };

  const rendered = renderFixture({ facts });
  const relationshipPage = rendered.nodes.marriageContent.innerHTML;
  const wealthPage = rendered.nodes.wealthContent.innerHTML;

  assert.doesNotMatch(relationshipPage, /deep-report-overview|deep-report-grade|\/10|需要磨合/);
  assert.match(relationshipPage, /一阵亲近、一阵疏远/);
  assert.match(wealthPage, /deep-report-overview/);
  assert.match(wealthPage, /A6/);
});

test('wealth renderer preserves the four-part customer structure and escapes direction copy', () => {
  const facts = fixtureFacts();
  facts.wealth.narrative = {
    grade: 'A6', level: '十万元级', difficulty: '持续经营时更容易逐步达到',
    headline: '财富结论', painPoint: '财富短板', note: '财富说明。',
    verdicts: [
      { title: '财富量级与总判断', sourceText: '命盘依据。', outcomeText: '总判断。' },
      { title: '钱主要从哪里来', sourceText: '命盘依据。', outcomeText: '来源。' },
      { title: '钱能不能留下', sourceText: '命盘依据。', outcomeText: '留存。' },
      { title: '哪里更容易打开财路', sourceText: '木为用神且接入食伤生财。', outcomeText: '东方和东南的客户、市场或合作机会更容易把收入打开。<east>' },
    ],
  };
  const page = renderFixture({ facts }).nodes.wealthContent.innerHTML;
  const titles = ['财富量级与总判断', '钱主要从哪里来', '钱能不能留下', '哪里更容易打开财路'];
  assert.deepEqual(titles.map(title => page.indexOf(title)), titles.map(title => page.indexOf(title)).slice().sort((a, b) => a - b));
  assert.equal((page.match(/deep-report-verdict-item/g) || []).length, 4);
  assert.match(page, /A6/);
  assert.doesNotMatch(page, /十万元级|持续经营时更容易逐步达到/);
  assert.match(page, /&lt;east&gt;/);
  assert.doesNotMatch(page, /<east>/);
});

test('paid verdict renders professional source before the plain outcome and escapes both', () => {
  const facts = fixtureFacts();
  facts.currentYear.narrative = {
    hideScore: true,
    headline: '本年结论',
    painPoint: '',
    verdicts: [{
      title: '感情稳定基础被打乱',
      sourceText: '流年申冲日支寅，寅木为本命用神。',
      outcomeText: '两个人更容易争吵、分开住，或者重新考虑关系。<img src=x>',
      basis: ['TIMING:LIUNIAN:CLASH:DAY'],
    }],
    note: '传统命理推演参考。',
  };

  const rendered = renderFixture({ facts });
  const page = rendered.nodes.thisYearContent.innerHTML;
  assert.ok(page.indexOf('流年申冲日支寅') < page.indexOf('两个人更容易争吵'));
  assert.match(page, /deep-report-verdict-source/);
  assert.match(page, /deep-report-verdict-outcome/);
  assert.doesNotMatch(page, /<img/);
  assert.match(page, /&lt;img src=x&gt;/);
  assert.match(rendered.pdfHtml, /流年申冲日支寅/);
  assert.doesNotMatch(page, /TIMING:LIUNIAN/);
});

test('legacy text-only verdicts remain visible during source-outcome migration', () => {
  const facts = fixtureFacts();
  facts.study.narrative = {
    grade: 'L6',
    level: '本科较顺',
    difficulty: '',
    headline: '学业结论',
    painPoint: '',
    verdicts: [{ title: '学习方式', text: '理解和表达能够连接起来。', basis: ['LEGACY'] }],
    note: '',
  };

  const rendered = renderFixture({ facts });
  assert.match(rendered.nodes.studyContent.innerHTML, /理解和表达能够连接起来/);
});

test('paid five-year report keeps the overview but does not render repetitive yearly cards', () => {
  const facts = fixtureFacts();
  facts.fiveYear.narrative = {
    hideScore: true,
    headline: '五年变化',
    painPoint: '',
    verdicts: [],
    note: '传统命理推演参考。',
    years: [{
      year: 2028,
      pillar: '戊申',
      daYunLabel: '甲辰大运',
      directionLabel: '偏不利',
      sourceText: '流年申冲日支寅，寅木为本命用神。',
      summary: '两个人更容易争吵、分开住或聚少离多。',
    }],
  };
  const rendered = renderFixture({ facts });
  const page = rendered.nodes.fortuneContent.innerHTML;
  assert.match(page, /五年变化/);
  assert.doesNotMatch(page, /deep-report-year-verdicts|deep-report-year/);
  assert.doesNotMatch(page, /戊申|甲辰大运|流年申冲日支寅|争吵、分开住/);
  assert.doesNotMatch(page, /\/10/);
  assert.doesNotMatch(rendered.pdfHtml, /甲辰大运|流年申冲日支寅/);
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

test('current-year and five-year sections render each non-domain overall trigger once after dedupe', () => {
  const facts = fixtureFacts();
  facts.currentYear.wealth.evidence = [{ id: 'wealth-domain', type: '财星激活', detail: '财星资源议题' }];
  facts.currentYear.triggeredRisks = [{ id: 'risk-1', type: '条件风险', detail: '风险重复提示' }];
  facts.currentYear.overallTriggers = [
    { id: 'overall-1', type: '年度节点', detail: '通用结构变化' },
    { id: 'wealth-domain', type: '财星激活', detail: '财星资源议题' },
    { id: 'risk-copy', type: '条件风险', detail: '风险重复提示' },
    { id: 'overall-1', type: '年度节点', detail: '通用结构变化' },
  ];
  facts.fiveYear.years[0].overallTriggers = [
    { id: 'original-relation', type: '六冲', sourcePillar: 'year', targetPillar: 'annual', detail: '流年午与原局年支子形成六冲' },
    { id: 'original-relation', type: '六冲', sourcePillar: 'year', targetPillar: 'annual', detail: '流年午与原局年支子形成六冲' },
  ];

  const rendered = renderFixture({ facts });
  assert.equal((rendered.nodes.thisYearContent.innerHTML.match(/综合变化/g) || []).length, 1);
  assert.equal((rendered.nodes.thisYearContent.innerHTML.match(/通用结构变化/g) || []).length, 1);
  assert.equal((rendered.nodes.thisYearContent.innerHTML.match(/财星资源议题/g) || []).length, 1);
  assert.equal((rendered.nodes.thisYearContent.innerHTML.match(/风险重复提示/g) || []).length, 1);
  assert.equal((rendered.nodes.fortuneContent.innerHTML.match(/原局互动/g) || []).length, 1);
  assert.equal((rendered.nodes.fortuneContent.innerHTML.match(/流年午与原局年支子形成六冲/g) || []).length, 1);
});

test('direct-pillar original-chart annual relation is visible without inventing DaYun', () => {
  const facts = fixtureFacts();
  facts.currentYear.daYun = null;
  facts.currentYear.hasDaYun = false;
  facts.currentYear.overallTriggers = [{
    id: 'direct-original', type: '六合', sourcePillar: 'day', targetPillar: 'annual',
    detail: '流年亥与原局日支寅形成六合',
  }];
  const rendered = renderFixture({ facts });
  assert.match(rendered.nodes.thisYearContent.innerHTML, /流年亥与原局日支寅形成六合/);
  assert.doesNotMatch(rendered.nodes.thisYearContent.innerHTML, /大运/);
});

test('overall trigger output neutralizes disaster lawsuit illness divorce loss and certainty wording', () => {
  const facts = fixtureFacts();
  facts.currentYear.overallTriggers = [{
    type: '旧判词',
    detail: '必然发生灾祸、诉讼、疾病、离婚与损失。',
  }];
  const rendered = renderFixture({ facts });
  assert.match(rendered.nodes.thisYearContent.innerHTML, /综合变化/);
  assert.doesNotMatch(rendered.nodes.thisYearContent.innerHTML, /必然|灾祸|诉讼|疾病|离婚|损失/);
  assert.match(rendered.nodes.thisYearContent.innerHTML, /相关条件下可能.*高强度变化.*规则或沟通争议.*身心状态.*关系边界.*资源波动/);
});

test('wealth quality evidence is escaped in the live section and copied into PDF HTML', () => {
  const facts = fixtureFacts();
  facts.wealth.resource.quality = {
    season: { state: '月令同气<script>', evidence: ['月支辰为土<img>'] },
    roots: ['年柱本气戊<root>'],
    sources: ['月柱余气丁<source>'],
    restraints: ['财星受制<restraint>'],
    relationships: ['财印关系<relation>'],
    uncertainty: '关系证据有限<uncertain>',
  };
  const rendered = renderFixture({ facts });
  const page = rendered.nodes.wealthContent.innerHTML;
  for (const label of ['月令与季节', '根气', '生源', '受制', '关系质量', '不确定性']) assert.match(page, new RegExp(label));
  for (const escaped of ['&lt;script&gt;', '&lt;img&gt;', '&lt;root&gt;', '&lt;source&gt;', '&lt;restraint&gt;', '&lt;relation&gt;', '&lt;uncertain&gt;']) {
    assert.match(page, new RegExp(escaped));
    assert.match(rendered.pdfHtml, new RegExp(escaped));
  }
  assert.doesNotMatch(page, /<(?:script|img|root|source|restraint|relation|uncertain)>/);
});

test('wealth quality keeps every evidence dimension visible when a category has no rows', () => {
  const facts = fixtureFacts();
  facts.wealth.resource.quality = {
    season: { state: '未见月令直接支持', evidence: [] },
    roots: [], sources: [], restraints: [], relationships: [], uncertainty: '',
  };
  const page = renderFixture({ facts }).nodes.wealthContent.innerHTML;
  for (const label of ['月令与季节', '根气', '生源', '受制', '关系质量', '不确定性']) assert.match(page, new RegExp(label));
  assert.match(page, /未见明确财星根气证据/);
  assert.match(page, /未见明确财星生源证据/);
  assert.match(page, /未见权威财星受制证据/);
  assert.match(page, /未见权威财星关系事件/);
  assert.match(page, /相关质量保持不确定/);
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
