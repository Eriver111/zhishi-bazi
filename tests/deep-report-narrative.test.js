const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const DeepReport = require(path.join(__dirname, '..', 'js', 'deep-report.js'));

function favorableFacts() {
  const annual = (year, stemRole = '喜神', risks = []) => ({
    year,
    pillar: { gan: '甲', zhi: '辰' },
    stemRole,
    branchRole: stemRole,
    triggeredRisks: risks,
    reliefs: stemRole === '喜神' ? [{ conclusion: '有缓和条件' }] : [],
    overallTriggers: [],
    career: { conclusion: '事业节奏可推进。', evidence: [] },
    wealth: { conclusion: '财富条件被激活。', evidence: [] },
    relationship: { conclusion: '关系议题较平稳。', evidence: [] },
    study: { conclusion: '适合学习与认证。', evidence: [] },
    wellbeing: { conclusion: '注意正常作息。' },
  });
  return {
    core: { strength: { score: 78, level: '偏强' }, pattern: { name: '食神生财格', status: '成格' }, yongJi: { yongShen: ['火'], xiShen: ['木'], jiShen: ['金'] } },
    wealth: {
      capacity: { state: '可承接', elementRole: '用神' },
      resource: { state: '显现', visibleCount: 2, hiddenCount: 2, elementRole: '用神', quality: { roots: ['有根'], sources: ['有生源'], restraints: [], relationships: [] } },
      pathways: [{ type: '食伤生财' }, { type: '财生官' }],
      retention: { risks: [] },
      storage: { present: true, activated: true },
    },
    relationship: {
      gender: 'male',
      interaction: { direction: '夫妻宫生身' },
      spouseStar: { element: '水', occurrences: [{ pillar: 'month', layer: '天干', gan: '癸', role: '正财' }], quality: { visibility: '透干显现', rooted: true, rolePurity: '单一口径', elementRole: '喜神' } },
      palace: { zhi: '寅', element: '木', elementRole: '用神', hiddenTenGods: [{ gan: '甲', role: '七杀', layer: '本气' }, { gan: '丙', role: '偏印', layer: '中气' }, { gan: '戊', role: '比肩', layer: '余气' }], dayInvolvingEvents: [], risks: [] },
      distance: { label: '工作圈、同学同事或同城附近的弱信号' },
      age: { label: '相仿' },
      appearance: { conclusion: '外在气质偏清爽利落。' },
    },
    study: {
      absorption: { state: '有承接', confidence: 'strong' },
      expression: { state: '稳定输出', confidence: 'strong' },
      discipline: { state: '可借规则转化', confidence: 'strong' },
      application: { state: '实践转化', confidence: 'strong' },
      path: { type: '研究与应用并重' },
      chains: [{ id: 'sha_yin', present: true, confidence: 'strong' }],
      obstacles: [],
    },
    currentYear: annual(2026),
    fiveYear: { anchorYear: 2026, years: [annual(2026), annual(2027), annual(2028, '忌神', [{ type: '调整' }]), annual(2029), annual(2030)] },
  };
}

function customerVisibleCopy(section) {
  const visible = [section.headline, section.painPoint, section.note];
  for (const verdict of section.verdicts || []) {
    visible.push(verdict.title, verdict.sourceText, verdict.outcomeText || verdict.text);
  }
  for (const year of section.years || []) {
    visible.push(year.year, year.pillar, year.daYunLabel, year.directionLabel, year.sourceText, year.summary);
  }
  return visible.filter(Boolean).join('\n');
}

test('narrative turns wealth facts into a stable A1-A10 asset magnitude without exposing evidence rows', () => {
  const facts = favorableFacts();
  const first = DeepReport.buildNarratives(facts);
  const second = DeepReport.buildNarratives(facts);

  assert.deepEqual(first, second);
  assert.match(first.wealth.grade, /^A(?:10|[1-9])$/);
  assert.match(first.wealth.level, /元级|万元级|亿元级/);
  assert.match(first.wealth.headline, /财富|赚钱|收入|资产/);
  assert.deepEqual(first.wealth.verdicts.map(row => row.title), [
    '财富量级与总判断', '钱主要从哪里来', '钱能不能留下', '哪里更容易打开财路',
  ]);
  assert.doesNotMatch(JSON.stringify(first.wealth), /relationEvents|structuralRisks|confidence|evidence|月令与季节|关系质量/);
});

test('study narrative states an attainable education level and the effort needed for the next level', () => {
  const narrative = DeepReport.buildNarratives(favorableFacts()).study;
  assert.match(narrative.level, /^(高学历|普通学历|低学历)$/);
  assert.match(JSON.stringify(narrative.verdicts), /本科|硕士|研究|深造/);
  assert.match(narrative.headline + narrative.paragraphs.join(''), /轻松|较顺|努力|投入|冲击/);
  assert.match(narrative.painPoint, /短板|吃力|拖累|问题|容易/);
});

test('customer study copy uses the low public band without junior-college or exclusion wording', () => {
  const facts = favorableFacts();
  facts.study.educationBand = {
    key: 'L2', rank: 2, publicKey: 'low', publicLabel: '低学历', basis: ['STUDY_BAND:L2'],
  };
  const narrative = DeepReport.buildNarratives(facts).study;
  const text = [narrative.level, narrative.headline]
    .concat(narrative.verdicts.map((row) => row.outcomeText || row.text || ''))
    .join('\n');
  assert.match(text, /低学历/);
  assert.match(text, /达到本科需要.*更多/);
  assert.doesNotMatch(text, /大专|考不上|只能|无缘本科/);
});

test('all five paid narratives use plain Chinese conclusions and contain no raw internal field names', () => {
  const narratives = DeepReport.buildNarratives(favorableFacts());
  assert.deepEqual(Object.keys(narratives), ['currentYear', 'relationship', 'wealth', 'study', 'fiveYear']);
  for (const section of Object.values(narratives)) {
    const copy = JSON.stringify(section);
    assert.doesNotMatch(copy, /relationEvents|structuralRisks|overallTriggers|confidence|evidence|elementRole|sourcePillar|targetPillar/);
    assert.ok(section.headline);
    assert.ok(Array.isArray(section.paragraphs));
  }
  assert.doesNotMatch(JSON.stringify(narratives.relationship), /弱信号|可信度|证据不足|倾向参考/);
  for (const section of Object.values(narratives)) {
    assert.equal(Object.prototype.hasOwnProperty.call(section, 'actions'), false);
    assert.ok(Array.isArray(section.verdicts) && section.verdicts.length > 0);
    for (const verdict of section.verdicts) {
      assert.ok(verdict.title && verdict.text);
      assert.ok(Array.isArray(verdict.basis) && verdict.basis.length > 0);
    }
  }
});

test('relationship narrative derives a rich spouse portrait from palace element, hidden roles and spouse-star placement', () => {
  const relationship = DeepReport.buildNarratives(favorableFacts()).relationship;
  const copy = relationship.verdicts.map(row => `${row.title}：${row.text}`).join('\n');
  for (const title of ['夫妻主导关系', '配偶性格', '婚后作用', '认识渠道', '年龄倾向', '外形气质']) {
    assert.match(copy, new RegExp(title));
  }
  assert.match(copy, /主见|果断|强势|主导/);
  assert.match(copy, /修长|骨架|眉眼|干练|清秀/);
  assert.match(copy, /工作|学习|同事|同学|熟人/);
  assert.match(copy, /相仿|略年长|成熟/);
  assert.match(copy, /帮助|助力|资源|秩序/);
  assert.match(copy, /压力|约束|管束|要求/);
});

test('relationship narrative hides scoring and keeps only evidence-backed plain conclusions', () => {
  const relationship = DeepReport.buildNarratives(favorableFacts()).relationship;

  assert.equal(relationship.hideScore, true);
  assert.equal(Object.prototype.hasOwnProperty.call(relationship, 'grade'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(relationship, 'level'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(relationship, 'difficulty'), false);
  assert.match(relationship.headline + relationship.painPoint, /另一半|关系|生活|你/);
});

test('an adverse half-combination states the concrete emotional and relationship outcome in plain Chinese', () => {
  const facts = favorableFacts();
  facts.core.yongJi = { yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] };
  facts.relationship.palace.dayInvolvingEvents = [
    { type: '半合', pillars: ['year', 'day'], source: '年柱午', target: '日柱寅', elements: ['午寅', '合火'] },
  ];

  const copy = DeepReport.buildNarratives(facts).relationship.verdicts
    .map(row => `${row.title}：${row.text}`).join('\n');

  assert.match(copy, /寅午半合火势/);
  assert.match(copy, /火在本命中为忌神/);
  assert.match(copy, /心里没底|内心反复/);
  assert.match(copy, /还能不能继续走下去|这段感情能不能走下去/);
  assert.match(copy, /一阵亲近、一阵疏远|忽远忽近/);
  assert.doesNotMatch(copy, /牵绊、消耗或失衡模式/);
});

test('relationship narrative keeps every original day-palace clash punishment harm combination and stem-control signal', () => {
  const facts = favorableFacts();
  facts.relationship.palace.dayInvolvingEvents = [
    { type: '六冲', pillars: ['month', 'day'], source: '月柱申', target: '日柱寅' },
    { type: '刑', pillars: ['day', 'hour'], source: '日柱寅', target: '时柱巳' },
    { type: '六害', pillars: ['year', 'day'], source: '年柱巳', target: '日柱寅' },
    { type: '六合', pillars: ['day', 'hour'], source: '日柱寅', target: '时柱亥', elements: ['木、水', '合木'] },
    { type: '半合', pillars: ['year', 'day'], source: '年柱午', target: '日柱寅', elements: ['午寅', '合火'] },
    { type: '天干五合', pillars: ['month', 'day'], source: '月柱癸', target: '日柱戊' },
    { type: '天干克', pillars: ['month', 'day'], source: '月柱庚', target: '日柱甲' },
  ];

  const copy = DeepReport.buildNarratives(facts).relationship.verdicts
    .map(row => `${row.title}：${row.text}`).join('\n');

  assert.match(copy, /感情容易出现明显变化/);
  assert.match(copy, /月柱申与日柱寅形成六冲/);
  assert.match(copy, /同一个问题容易反复争执/);
  assert.match(copy, /不满容易憋在心里/);
  assert.match(copy, /夫妻宫六合木·偏有利/);
  assert.match(copy, /日柱寅与时柱亥形成六合/);
  assert.match(copy, /寅午半合/);
  assert.match(copy, /夫妻宫半合火·偏有利/);
  assert.match(copy, /火.*为用神/);
  assert.doesNotMatch(copy, /合为喜时|合住忌神|如果|若为/);
  assert.match(copy, /正财妻星合身/);
  assert.match(copy, /月柱癸与日柱戊五合/);
  assert.match(copy, /两个人容易争谁说了算/);
  assert.match(copy, /月柱庚克日柱甲/);
  assert.match(copy, /喜用|有利|稳定/);
});

test('a non-spouse stem combining the day master is excluded from the marriage narrative', () => {
  const facts = favorableFacts();
  facts.relationship.palace.dayInvolvingEvents = [
    { type: '天干五合', pillars: ['year', 'day'], source: '年柱己', target: '日柱甲' },
  ];
  facts.relationship.spouseStar.occurrences = [{ pillar: 'month', layer: '天干', gan: '癸', role: '正财' }];

  const copy = DeepReport.buildNarratives(facts).relationship.verdicts.map(row => `${row.title}：${row.text}`).join('\n');
  assert.doesNotMatch(copy, /日干被合|配偶星合身|妻星合身|年柱己与日柱甲五合/);
});

test('annual relationship verdict distinguishes favorable palace damage from favorable force breaking an adverse palace', () => {
  const favorablePalace = favorableFacts();
  favorablePalace.currentYear.relationship = {
    activations: [{ source: '流年', type: '六冲', movingBranch: '申', palaceBranch: '寅', palaceRole: '用神', movingRole: '忌神', direction: 'adverse' }],
    evidence: ['流年申冲夫妻宫寅'],
  };
  const adversePalace = favorableFacts();
  adversePalace.currentYear.relationship = {
    activations: [{ source: '流年', type: '六冲', movingBranch: '申', palaceBranch: '寅', palaceRole: '忌神', movingRole: '喜神', direction: 'favorable' }],
    evidence: ['流年申冲夫妻宫寅'],
  };

  const adverseCopy = DeepReport.buildNarratives(favorablePalace).currentYear.verdicts.map(row => row.text).join('\n');
  const favorableCopy = DeepReport.buildNarratives(adversePalace).currentYear.verdicts.map(row => row.text).join('\n');
  assert.match(adverseCopy, /喜用夫妻宫|稳定基础受扰|偏不利/);
  assert.match(favorableCopy, /忌神夫妻宫|旧有压力|改善|偏有利/);
});

test('five-year narrative names the relationship direction in the exact activated year', () => {
  const facts = favorableFacts();
  facts.fiveYear.years[1].relationship = {
    activations: [{ source: '流年', type: '六冲', movingBranch: '申', palaceBranch: '寅', palaceRole: '用神', movingRole: '忌神', direction: 'adverse' }],
    evidence: [],
  };

  const year = DeepReport.buildNarratives(facts).fiveYear.years.find(row => row.year === 2027);
  assert.match(year.summary, /流年申冲夫妻宫寅/);
  assert.match(year.summary, /喜用|稳定基础|偏不利/);
});

test('study narrative uses the evidence-gated profile and education band without advice language', () => {
  const facts = favorableFacts();
  facts.study.profile = {
    key: 'persistent_sha_yin', rank: 100,
    sourceText: '杀印相生链成立，印星为本命用神。',
    outcomeText: '你属于不怕重复、肯下功夫的长期投入型，准备周期越长越容易显出优势。',
    basis: ['PROFILE:SHA_YIN'],
  };
  facts.study.educationBand = { key: 'L8', label: '硕士层级有较强潜力', rank: 8, basis: ['STUDY_BAND:L8'] };
  facts.study.limitations = [{
    key: 'uncontrolled_output', severity: 'medium',
    sourceText: '食伤过旺且没有制化。',
    outcomeText: '你思路多、反应快，但容易厌烦重复训练，成绩会低于真实聪明程度。',
    basis: ['STUDY_LIMIT:uncontrolled_output'],
  }];
  const narrative = DeepReport.buildNarratives(facts).study;
  assert.equal(narrative.level, '硕士层级有较强潜力');
  assert.ok(narrative.verdicts.some(row => row.sourceText === '杀印相生链成立，印星为本命用神。'));
  assert.ok(narrative.verdicts.some(row => /不怕重复、肯下功夫/.test(row.outcomeText)));
  assert.ok(narrative.verdicts.some(row => /食伤过旺且没有制化/.test(row.sourceText)));
  const visible = [narrative.headline, narrative.painPoint, narrative.note]
    .concat(narrative.verdicts.flatMap(row => [row.title, row.sourceText, row.outcomeText || row.text]))
    .filter(Boolean).join('\n');
  assert.doesNotMatch(visible, /建议|应该|应当|优先|最好|宜|需注意|需要做到/);
});

test('wealth narrative groups magnitude source retention and direction into four conclusions without advice verbs', () => {
  const narrative = DeepReport.buildNarratives(favorableFacts()).wealth;
  const copy = JSON.stringify(narrative);
  assert.match(copy, /A(?:10|[1-9])/);
  for (const title of ['财富量级与总判断', '钱主要从哪里来', '钱能不能留下', '哪里更容易打开财路']) {
    assert.match(copy, new RegExp(title));
  }
  assert.doesNotMatch(copy, /建议|应该|应当|优先|最好|宜|需注意|控制投入|建立|选择/);
});

test('a generic annual wealth sentence does not override the no-storage steady-accumulation conclusion', () => {
  const facts = favorableFacts();
  facts.wealth.pathways = [];
  facts.wealth.storage = { present: false, activated: false, candidates: [], storages: [] };
  facts.currentYear.wealth = { conclusion: '财富条件被激活。', evidence: ['普通年度说明'], timing: { activation: [] } };
  const retention = DeepReport.buildNarratives(facts).wealth.verdicts.find(row => row.title === '钱能不能留下');
  assert.match(retention.outcomeText, /一点点做大/);
});

test('an activated Ji wealth storage under pressure never becomes a money-retention promise', () => {
  const facts = favorableFacts();
  facts.core.yongJi = { yongShen: ['水'], xiShen: [], jiShen: ['土'] };
  facts.wealth.capacity = { state: '承压', elementRole: '忌神' };
  facts.wealth.resource.elementRole = '忌神';
  facts.wealth.storage = {
    present: true, activated: true, candidates: [{ zhi: '辰' }],
    storages: [{
      pillarLabel: '年柱', zhi: '辰', storageRoleKey: 'wealth', storageRole: '财库',
      elementRole: '忌神', activated: true, wealthConnection: false,
      hiddenRoles: [{ role: '偏财', gan: '戊' }], outcome: '财库被引动，但资金议题可能伴随压力。',
    }],
  };
  const retention = DeepReport.buildNarratives(facts).wealth.verdicts.find(row => row.title === '钱能不能留下');
  assert.doesNotMatch(retention.outcomeText, /更容易沉淀成存款|赚钱以后有地方可存/);
  assert.doesNotMatch(retention.outcomeText, /相对更容易留住|更容易留住/);
  assert.match(retention.outcomeText, /垫的钱|责任|支出/);
});

test('five storage roles enter the wealth source and retention conclusions with different plain results', () => {
  const facts = favorableFacts();
  facts.wealth.storage.storages = [
    { pillarLabel: '年柱', zhi: '未', storageRoleKey: 'peer', storageRole: '比劫库', elementRole: '喜神', activated: true, wealthConnection: true, hiddenRoles: [], outcome: '伙伴条件已接入财富路径。' },
    { pillarLabel: '月柱', zhi: '丑', storageRoleKey: 'resource', storageRole: '印库', elementRole: '用神', activated: true, wealthConnection: true, hiddenRoles: [], outcome: '资质支持已接入财富路径。' },
    { pillarLabel: '日柱', zhi: '戌', storageRoleKey: 'output', storageRole: '食伤库', elementRole: '喜神', activated: true, wealthConnection: true, hiddenRoles: [], outcome: '技能产出已接入财富路径。' },
    { pillarLabel: '时柱', zhi: '辰', storageRoleKey: 'wealth', storageRole: '财库', elementRole: '用神', activated: true, wealthConnection: true, hiddenRoles: [{ role: '偏财', gan: '戊' }], outcome: '资产已接入财富路径。' },
    { pillarLabel: '时柱', zhi: '丑', storageRoleKey: 'officer', storageRole: '官杀库', elementRole: '喜神', activated: true, wealthConnection: true, hiddenRoles: [], outcome: '管理平台已接入财富路径。' },
  ];
  const verdicts = DeepReport.buildNarratives(facts).wealth.verdicts;
  const copy = verdicts.filter(row => /钱主要从哪里来|钱能不能留下/.test(row.title))
    .map(row => row.sourceText + row.outcomeText).join('\n');
  for (const text of ['伙伴', '资质', '技能', '资产', '管理']) assert.match(copy, new RegExp(text));
});

test('strong partial wealth prevents a no-storage chart from being reduced to only slow accumulation', () => {
  const facts = favorableFacts();
  facts.wealth.pathways = [];
  facts.wealth.storage = { present: false, activated: false, candidates: [], storages: [] };
  facts.wealth.partialWealth = { strong: true, exposedCount: 2, hiddenCount: 0, evidence: ['年干偏财', '月干偏财'] };
  const retention = DeepReport.buildNarratives(facts).wealth.verdicts.find(row => row.title === '钱能不能留下');
  assert.doesNotMatch(retention.outcomeText, /一点点做大/);
  assert.match(retention.outcomeText, /偏财|机会/);
});

test('wealth timing names the exact year relation and a concrete money outcome', () => {
  const facts = favorableFacts();
  facts.currentYear.interactions = [{
    source: '流年', type: '六冲', targetPillar: 'month', targetLabel: '月支',
    actor: '戌', target: '辰', actorRole: '喜神', targetRole: '忌神',
    direction: 'favorable', domains: ['wealth'],
    sourceText: '流年戌冲原局财库辰，辰土为本命忌神。',
  }];
  const narrative = DeepReport.buildNarratives(facts).currentYear;
  const copy = narrative.verdicts.map(row => [row.sourceText, row.outcomeText || row.text].join(' ')).join('\n');
  assert.match(copy, /流年戌冲原局财库辰/);
  assert.match(copy, /收入|进账|支出|资金|资产/);
});

function addFiveYearInteractions(facts) {
  const rows = [
    { source: '流年', type: '六冲', layer: '地支', actor: '申', target: '寅', targetPillar: 'day', targetLabel: '日支', targetRole: '用神', actorRole: '忌神', direction: 'adverse', domains: ['relationship'], sourceText: '流年申冲日支寅，寅木为本命用神。' },
    { source: '流年', type: '六冲', layer: '地支', actor: '子', target: '午', targetPillar: 'day', targetLabel: '日支', targetRole: '忌神', actorRole: '喜神', direction: 'favorable', domains: ['relationship'], sourceText: '流年子冲日支午，午火为本命忌神。' },
    { source: '流年', type: '六合', layer: '地支', actor: '亥', target: '寅', targetPillar: 'day', targetLabel: '日支', formedElement: '木', formedRole: '喜神', direction: 'favorable', domains: ['relationship'], sourceText: '流年亥与日支寅六合，合向木，木为本命喜神。' },
    { source: '流年', type: '六害', layer: '地支', actor: '巳', target: '寅', targetPillar: 'day', targetLabel: '日支', direction: 'adverse', domains: ['relationship'], sourceText: '流年巳害日支寅，寅木为本命用神。' },
    null,
  ];
  facts.fiveYear.years.forEach((year, index) => {
    year.pillar = { gan: ['丙', '丁', '戊', '己', '庚'][index], zhi: ['申', '子', '亥', '巳', '戌'][index] };
    year.daYun = { gan: index < 2 ? '甲' : '乙', zhi: index < 2 ? '辰' : '巳' };
    year.interactions = rows[index] ? [rows[index]] : [];
  });
  facts.currentYear = facts.fiveYear.years[0];
  return facts;
}

test('current-year and five-year narratives expose no scores or score-derived labels', () => {
  const narratives = DeepReport.buildNarratives(addFiveYearInteractions(favorableFacts()));
  for (const section of [narratives.currentYear, narratives.fiveYear]) {
    assert.equal(section.hideScore, true);
    assert.equal(Object.prototype.hasOwnProperty.call(section, 'grade'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(section, 'difficulty'), false);
    assert.doesNotMatch(JSON.stringify(section), /\/10|最高分|最低分|高分年份|低分年份|ANNUAL_SCORE|FIVE_YEAR_AVERAGE/);
  }
});

test('each five-year row includes pillar, DaYun, professional source and a plain outcome', () => {
  const years = DeepReport.buildNarratives(addFiveYearInteractions(favorableFacts())).fiveYear.years;
  assert.equal(years.length, 5);
  for (const year of years) {
    assert.ok(year.pillar);
    assert.ok(Object.prototype.hasOwnProperty.call(year, 'daYunLabel'));
    assert.ok(year.directionLabel);
    assert.ok(year.sourceText || /延续/.test(year.summary));
    assert.doesNotMatch(JSON.stringify(year), /\/10/);
  }
});

test('five-year outcomes distinguish favorable and adverse clash, favorable combine, harm and continuation', () => {
  const years = DeepReport.buildNarratives(addFiveYearInteractions(favorableFacts())).fiveYear.years;
  assert.match(years[0].summary, /争吵|分开住|聚少离多|重新考虑/);
  assert.match(years[1].summary, /打破|改善|原来.*压力/);
  assert.match(years[2].summary, /靠近|稳定|推进|落实/);
  assert.match(years[3].summary, /误会|怀疑|不信任|冷淡/);
  assert.match(years[4].summary, /延续/);
});

test('customer-visible paid narratives contain outcomes rather than advice or internal abstractions', () => {
  const narratives = DeepReport.buildNarratives(addFiveYearInteractions(favorableFacts()));
  for (const section of Object.values(narratives)) {
    const copy = customerVisibleCopy(section);
    assert.doesNotMatch(copy, /建议|应该|应当|优先|最好|宜|需注意|需要做到/);
    assert.doesNotMatch(copy, /relationEvents|structuralRisks|elementRole|confidence|evidence|sourcePillar|targetPillar/);
    assert.doesNotMatch(copy, /消耗结构|关系结构|议题增强|暗耗|失衡模式/);
  }
});
