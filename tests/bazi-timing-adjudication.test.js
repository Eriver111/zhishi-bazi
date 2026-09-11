const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

function runtime() {
  const context = { console, Date, Math, setTimeout, clearTimeout };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bazi.js'), 'utf8'), context, { filename: 'bazi.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bazi-chain.js'), 'utf8'), context, { filename: 'bazi-chain.js' });
  return context;
}

function chart() {
  return {
    year:{ gan:'丙', zhi:'戌' }, month:{ gan:'丙', zhi:'申' },
    day:{ gan:'己', zhi:'卯' }, hour:{ gan:'庚', zhi:'午' }
  };
}

test('少年流年把工作和资金信号折算到学业家庭，不误断升职发财', () => {
  const C = runtime();
  const bazi = chart();
  const adjudication = C.BaZiChain.buildAnnualEventAdjudication(
    bazi,
    { gan: '甲', zhi: '子' },
    { year: 2015, gan: '壬', zhi: '辰' },
    {
      verifiedScore: -1,
      dangerScore: 2,
      opportunityScore: 0,
      triggers: [{ type: '六冲', target: 'month', detail: '流年冲月柱，成长环境调整', isGood: false }]
    },
    { age: 15 }
  );

  assert.equal(adjudication.lifeStage.key, 'child');
  assert.equal(adjudication.domainRecords.find(item => item.domain === 'career'), undefined);
  assert.equal(adjudication.domainRecords.find(item => item.domain === 'wealth'), undefined);
  assert.ok(['study', 'family'].includes(adjudication.primaryEvent.domain));
  assert.match(adjudication.constraint, /不是既成事实/);
});

test('成年同类月柱触发优先落到事业，并保留主次事件和证据', () => {
  const C = runtime();
  const bazi = chart();
  const adjudication = C.BaZiChain.buildAnnualEventAdjudication(
    bazi,
    { gan: '甲', zhi: '子' },
    { year: 2035, gan: '乙', zhi: '卯' },
    {
      verifiedScore: -1.2,
      dangerScore: 3,
      opportunityScore: 0,
      triggers: [{ type: '天克地冲', target: 'month', detail: '流年与月柱天克地冲，工作平台调整', isGood: false }]
    },
    { age: 35 }
  );

  assert.equal(adjudication.primaryEvent.domain, 'career');
  assert.equal(adjudication.primaryEvent.direction, '偏不利');
  assert.ok(adjudication.secondaryEvent);
  assert.ok(adjudication.primaryEvent.evidence.length > 0);
});

test('领域应期排序按用户所问领域取年，不被综合高分的其他事件带偏', () => {
  const C = runtime();
  const rows = [
    {
      daYun:{ gan:'甲', zhi:'子' }, liuNian:{ gan:'丙', zhi:'午' },
      eventAdjudication:{ year:2028, age:28, triggerStrength:12, primaryEvent:{ domain:'career' }, domainRecords:[
        { domain:'career', label:'事业工作', activationScore:12, direction:'偏有利', confidence:'高', eventCandidate:'岗位推进', evidence:['事业证据'], hasIndependentAnnualTrigger:true },
        { domain:'relationship', label:'婚恋合作', activationScore:2, direction:'条件性', confidence:'中', eventCandidate:'关系被引动', evidence:[], hasIndependentAnnualTrigger:false }
      ] }
    },
    {
      daYun:{ gan:'乙', zhi:'丑' }, liuNian:{ gan:'丁', zhi:'未' },
      eventAdjudication:{ year:2030, age:30, triggerStrength:6, primaryEvent:{ domain:'relationship' }, domainRecords:[
        { domain:'relationship', label:'婚恋合作', activationScore:10, direction:'偏有利', confidence:'中高', eventCandidate:'关系确认', evidence:['婚恋证据'], hasIndependentAnnualTrigger:true }
      ] }
    }
  ];

  const relationship = C.BaZiChain.rankTimingCandidates(rows, 'relationship');
  assert.equal(relationship[0].year, 2030);
  assert.equal(relationship[0].eventCandidate, '关系确认');
});

test('流年分析自动附带应事裁决且不改写原有方向分数', () => {
  const C = runtime();
  const bazi = chart();
  const yongJi = C.BaZiCalculator.getYongJi(bazi);
  const result = C.BaZiChain.analyzeLiuNian(
    bazi,
    { gan:'甲', zhi:'子', startYear:2026, displayAge:'26' },
    { year:2028, gan:'戊', zhi:'申' },
    yongJi,
    { birthYear:2000 }
  );

  assert.equal(result.eventAdjudication.year, 2028);
  assert.equal(result.eventAdjudication.age, 28);
  assert.equal(typeof result.verifiedScore, 'number');
  assert.ok(result.eventAdjudication.primaryEvent);
});

test('流年同领域裁决继承大运趋势，不把别的领域方向借过来', () => {
  const C = runtime();
  const adjudication = C.BaZiChain.buildAnnualEventAdjudication(
    chart(),
    { gan:'甲', zhi:'子' },
    { year:2035, gan:'乙', zhi:'卯' },
    { verifiedScore:2, dangerScore:0, opportunityScore:2, triggers:[] },
    {
      age:35,
      daYunEventLedger:{ domainRecords:[
        { domain:'career', label:'事业与职责', activationScore:5, direction:'偏不利', conclusion:'工作平台与责任更容易形成压力' },
        { domain:'family', label:'家庭与长辈', activationScore:5, direction:'偏有利', conclusion:'家庭支持更容易兑现' }
      ] }
    }
  );
  const career = adjudication.domainRecords.find(item => item.domain === 'career');
  assert.equal(career.direction, '偏不利');
  assert.match(career.evidence.join('；'), /本步大运.*事业与职责.*偏不利/);
});

test('未知出生年不会被 null 年龄误当成零岁', () => {
  const C = runtime();
  const adjudication = C.BaZiChain.buildAnnualEventAdjudication(
    chart(), { gan:'甲', zhi:'子' }, { year:2035, gan:'乙', zhi:'卯' },
    { verifiedScore:0, dangerScore:0, opportunityScore:0, triggers:[] },
    { age:null, birthYear:null }
  );
  assert.equal(adjudication.age, null);
  assert.equal(adjudication.lifeStage.key, 'unknown');
});

test('只有大运背景和流年十神时只定主题，不冒充重点应期', () => {
  const C = runtime();
  const bazi = {
    year:{ gan:'戊', zhi:'寅' }, month:{ gan:'癸', zhi:'亥' },
    day:{ gan:'甲', zhi:'戌' }, hour:{ gan:'辛', zhi:'未' }
  };
  const adjudication = C.BaZiChain.buildAnnualEventAdjudication(
    bazi, { gan:'丙', zhi:'寅' }, { year:2026, gan:'丙', zhi:'午' },
    { stemRole:'喜神', verifiedScore:2, dangerScore:0, opportunityScore:2, triggers:[] },
    { age:28, daYunEventLedger:{ domainRecords:[
      { domain:'career', label:'事业与职责', activationScore:7, direction:'偏不利', conclusion:'项目与规则压力增加' }
    ] } }
  );
  const career = adjudication.domainRecords.find(item => item.domain === 'career');
  assert.equal(career.direction, '条件性');
  assert.equal(career.hasIndependentAnnualTrigger, false);
  assert.match(career.evidence.join('；'), /仅凭十神只能定主题/);
  assert.equal(C.BaZiChain.rankTimingCandidates([{ eventAdjudication:adjudication }], 'career').length, 0);
});

test('流年补齐寅午戌三合火局会按食伤功能落到事业成果而非误报无触发', () => {
  const C = runtime();
  const bazi = {
    year:{ gan:'戊', zhi:'寅' }, month:{ gan:'癸', zhi:'亥' },
    day:{ gan:'甲', zhi:'戌' }, hour:{ gan:'辛', zhi:'未' }
  };
  const yongJi = C.BaZiCalculator.getYongJi(bazi);
  const result = C.BaZiChain.analyzeLiuNian(
    bazi,
    { gan:'丙', zhi:'寅', startYear:2023, displayAge:'25' },
    { year:2026, gan:'丙', zhi:'午' },
    yongJi,
    { age:28 }
  );
  const trine = result.triggers.find(item => item.type === '三合局' && item.formedWx === '火');
  const career = result.eventAdjudication.domainRecords.find(item => item.domain === 'career');
  assert.ok(trine);
  assert.deepEqual(Array.from(trine.targetPositions), ['year', 'day']);
  assert.equal(trine.functionalFamily, '食伤');
  assert.equal(career.hasIndependentAnnualTrigger, true);
  assert.ok(career.annualStructuralTriggerCount > 0);
  assert.match(career.scenarioCandidates.join('；'), /作品|方案|项目交付|业务推广/);
  assert.ok(C.BaZiChain.rankTimingCandidates([{ eventAdjudication:result.eventAdjudication }], 'career').length > 0);
});
