const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report');

const life = { status: 'student', age: 17, studyRelevant: true };
function record(domain, scene, overrides = {}) {
  return { domain, label: domain, direction: '偏不利', hasIndependentAnnualTrigger: true,
    activationScore: 7, scenarioCandidates: [scene], evidence: ['独立年度作用证据'], ...overrides };
}
function annual(year, primary, secondary = null) {
  return { year, pillar: { gan: '庚', zhi: '子' }, stemRole: '用神', branchRole: '喜神',
    lifeContext: life, eventAdjudication: { age: 17, lifeContext: life,
      lifeStage: { key: 'education', label: '在读（该年约17岁）' },
      domainRecords: [primary, secondary].filter(Boolean), primaryEvent: primary, secondaryEvent: secondary } };
}
function facts(years) { return { core: {}, wealth: {}, relationship: {}, study: {}, currentYear: years[0], fiveYear: { years } }; }
function body(n) { return [n.headline,n.painPoint,...n.verdicts.filter(v=>!v.detailOnly).map(v=>v.outcomeText)].join(' '); }

test('distinct school events survive life-context selection without merging into a generic obstacle', () => {
  const a = Report.__test.selectTimingScenario(record('study','准备好的作业因要求临时改变而返工'), { lifeContext: life });
  const b = Report.__test.selectTimingScenario(record('study','当面反驳老师的要求，影响课程评定'), { lifeContext: life });
  assert.match(a, /作业.*返工/);
  assert.match(b, /反驳老师.*评定/);
  assert.notEqual(a,b);
});

test('favorable element roles cannot sugarcoat a selected adverse event or add opposite interaction prose', () => {
  const year = annual(2026,record('wealth','为新增学习开支用掉存下的钱'));
  year.interactions=[{source:'流年',type:'六合',direction:'favorable',domains:['wealth'],sourceText:'另一项原始作用'}];
  const output=Report.buildNarratives(facts([year])).currentYear;
  assert.match(body(output),/用掉存下的钱/);
  assert.doesNotMatch(body(output),/整体环境对你偏有帮助|回款会更顺|钱也更有机会存下来/);
  assert.equal(output.verdicts.length,1);
});

test('generic health fallback gives no symptom-checking or medical instruction', () => {
  const out=Report.__test.selectTimingScenario(record('health','身心状态波动增大，需要结合现实症状核对',{direction:'条件性'}),{lifeContext:life});
  assert.match(out,/休息时间|日常节奏/);
  assert.doesNotMatch(out,/症状|医院|就医|检查身体|治疗|用药|器官|需要结合现实.*核对/);
});

test('family disruption is not automatically converted into a family bodily-condition event', () => {
  const common=record('family','临时承担家事打乱安排',{unresolvedDisruptionCount:1});
  const bodily=record('family','家人身体状况可能出现变化，需核对实际安排',{unresolvedDisruptionCount:1});
  assert.doesNotMatch(Report.__test.selectTimingScenario(common,{}),/身体|疾病|健康/);
  assert.match(Report.__test.selectTimingScenario(bodily,{}),/身体状况可能出现变化/);
});

test('calibration question and exclusions never become future report prose without a dedicated baseline', () => {
  const year=annual(2026,record('study','已经交上的作业被退回重做'));
  const f=facts([year]);
  Report.applyReportReview(f,{adjustments:[],candidates:[{year:2026,domain:'study',hasIndependentAnnualTrigger:true,
    mechanism_key:'rule:owl-seizes-food',manifestation:'study:rework',label:'问卷选项',detail:'这一年是否返工？请选择，也可回答没有。正常修改不算。'}]});
  const out=body(f.currentYear.narrative);
  assert.match(f.currentYear.narrative.verdicts[0].outcomeText,/作业被退回重做/);
  assert.equal(f.currentYear.narrative.verdicts[0].detailOnly,true);
  assert.doesNotMatch(out,/是否|请选择|可回答|不算/);
});

test('review uses a dedicated report event and preserves its meaning identity through rendering data', () => {
  const f=facts([annual(2026,record('study','旧的概括'))]);
  Report.applyReportReview(f,{adjustments:[],candidates:[{year:2026,domain:'study',hasIndependentAnnualTrigger:true,
    mechanism_key:'rule:owl-seizes-food',manifestation:'study:rework',label:'是否被退回',detail:'这一年是否发生？',
    reportLabel:'交出的东西要重做',reportBaseline:'准备好的答案被要求改写，原定交付时间更紧。',meaningKey:'owl:school:study'}]});
  const out=f.currentYear.narrative.verdicts[0];
  assert.equal(out.displayTitle,'交出的东西要重做');
  assert.equal(out.meaningKey,'2026:study:owl:school:study');
  assert.match(out.sourceText,/独立年度作用证据/);
  assert.match(out.outcomeText,/答案被要求改写/);
});

test('the same event across years is referenced once while a different second event stays visible', () => {
  const scene='原先安排好的活动临时延期，参加时间需要重排。';
  const second='为了新增学习费用，用掉了原先存下的一笔钱。';
  const years=[annual(2026,record('change',scene)),annual(2027,record('change',scene),record('wealth',second))];
  const out=Report.buildNarratives(facts(years)).fiveYear.years[1];
  assert.match(out.processDetails[0].scenario,/临时延期/);
  assert.doesNotMatch(out.summary,/临时延期/);
  assert.match(out.summary,/新增学习费用/);
  assert.equal(out.summary.includes(scene),false);
  assert.match(out.sourceText,/原先安排好的活动临时延期/);
  assert.match(out.fullSummary,/原先安排好的活动临时延期/);
});

test('a past answer cannot create an event without an independent annual trigger', () => {
  const r=record('career','工作受阻',{hasIndependentAnnualTrigger:false});
  const f=facts([annual(2026,r)]);
  Report.applyReportReview(f,{adjustments:[{year:2026,domain:'career',mechanismKey:'rule:pressure',manifestation:'pressure',state:'repeated',outcome:'曾经两次符合'}],
    candidates:[{year:2026,domain:'career',hasIndependentAnnualTrigger:false,mechanism_key:'rule:pressure',manifestation:'pressure',reportBaseline:'必定工作受阻'}]});
  assert.doesNotMatch(body(f.currentYear.narrative),/工作受阻/);
  assert.equal(f.currentYear.narrative.verdicts.length,0);
});

test('a minor receives a relationship communication section rather than a marriage forecast', () => {
  const f=facts([]);
  f.lifeContext={status:'student',age:14};
  f.relationship={palace:{zhi:'子',hiddenTenGods:[]},spouseStar:{quality:{visibility:'透干显现',rooted:true}},interaction:{direction:'干支同类'}};
  const n=Report.buildNarratives(f).relationship;
  assert.equal(n.sectionTitle,'相处与沟通');
  assert.doesNotMatch(body(n),/婚嫁|结婚|认真相处|好感走向明确/);
  f.lifeContext={status:'working',age:30};
  assert.equal(Report.buildNarratives(f).relationship.sectionTitle,'婚姻感情');
});
