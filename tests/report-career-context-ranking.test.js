'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report');
const {engine,chartFor,reportFor} = require('../scripts/real-case-audit-utils');
const {applyEmptyReview} = require('../scripts/real-case-round3');
const {renderFacts} = require('../scripts/real-case-report-render');

function row(domain, score, scene, extra = {}) {
  return {domain,activationScore:score,direction:'偏有利',hasIndependentAnnualTrigger:true,
    scenarioCandidates:[scene],evidence:['合成年度独立依据'],...extra};
}
function fixture(records, status = 'unknown', age = 30) {
  const lifeContext = {status,age};
  const year = {year:2026,lifeContext,dynamic:{triggers:[{type:'六合',target:'day',source:'流年'}]},
    eventAdjudication:{age,lifeContext,primaryEvent:records[0],secondaryEvent:records[1],domainRecords:records}};
  return {core:{},wealth:{},relationship:{},study:{},currentYear:year,fiveYear:{years:[year]}};
}
const career = () => row('career',10.5,'项目交付、成果展示或岗位推进更容易落实');
const relationship = () => row('relationship',8,'感情联系加深');

test('unknown adult occupation preserves supplied work evidence without claiming employment or an offer', () => {
  const f=fixture([career(),relationship()]);
  const before=JSON.stringify(f.currentYear);
  const n=Report.buildNarratives(f).currentYear;
  const first=n.verdicts[0];
  assert.match(first.meaningKey,/:career:/);
  assert.equal(first.supportLevel,'domain');
  assert.equal(first.outcomeScope,'domain');
  assert.equal(first.detailOnly,false);
  assert.match(first.outcomeText,/若当时在工作或求职/);
  assert.match(first.outcomeText,/岗位推进/);
  assert.doesNotMatch(first.outcomeText,/已经入职|成功录用|一定升职|被辞退/);
  assert.equal(JSON.stringify(f.currentYear),before);
});

test('a stronger relationship domain remains first; concrete cash consequence still outranks broad domains', () => {
  const romance=relationship();romance.activationScore=12;
  assert.match(Report.buildNarratives(fixture([romance,career()])).currentYear.verdicts[0].meaningKey,/:relationship:/);
  const cash=row('wealth',5,'约好的款项延迟到账',{reportScenario:'约好的款项延迟到账',reportEventType:'payment-delay',reportMechanismKey:'rule:synthetic',reportLabel:'款项延迟'});
  assert.equal(Report.buildNarratives(fixture([career(),cash])).currentYear.verdicts[0].eventType,'payment-delay');
});

test('known nonwork contexts and minors do not acquire an adult career claim', () => {
  for(const [status,age] of [['student',30],['exam',28],['home',35],['retired',65],['unknown',15],['unknown',null]]) {
    const f=fixture([career()],status,age);
    const d=Report.__test.describeTimingEvent(f.currentYear.eventAdjudication.primaryEvent,f.currentYear.eventAdjudication,f.currentYear.lifeContext,f.currentYear);
    assert.notEqual(d.eventType,'career-opportunity-domain',status+':'+age);
    assert.doesNotMatch(d.scenario,/岗位推进|若当时在工作或求职/);
  }
});

test('unknown occupation does not elevate task pressure or untriggered work background into an event', () => {
  const generic=row('career',12,'约好的任务需要重新安排');
  const n=Report.buildNarratives(fixture([generic])).currentYear;
  assert.equal(n.verdicts[0].detailOnly,true);
  const untriggered=career();untriggered.hasIndependentAnnualTrigger=false;
  assert.equal(Report.buildNarratives(fixture([untriggered])).currentYear.verdicts.length,0);
});

test('unknown adult schooling keeps an existing annual exam domain as conditional, not an admission fact', () => {
  const study=row('study',12,'考试发挥和录取推进有机会，但稳定性不足',{direction:'条件性'});
  const f=fixture([study,relationship()],'unknown',22);
  const n=Report.buildNarratives(f).currentYear;
  assert.equal(n.verdicts[0].eventType,'study-opportunity-domain');
  assert.match(n.verdicts[0].outcomeText,/若当时在读或备考/);
  assert.equal(n.verdicts[0].supportLevel,'domain');
  assert.doesNotMatch(n.verdicts[0].outcomeText,/已经录取|一定考上/);
});

test('actual report pipeline retains triggered annual study for unknown status and still excludes it for a known worker', async () => {
  const c={id:'public-study-context',gender:'female',birthYear:1994,birth:{date:'1994-06-03',clock:'16:36'},
    pillars:['甲戌','己巳','庚申','甲申'],cycles:[{gan:'丁',zhi:'卯',startYear:2013,endYear:2022}]};
  const e=await engine(false),chart=chartFor(e,c),f=reportFor(e,c,2014);
  assert.ok(f.currentYear.eventAdjudication.domainRecords.some(r=>r.domain==='study'&&r.hasIndependentAnnualTrigger));
  assert.equal(f.study.relevant,false,'No invented current student status or automatic study chapter');
  const calc=Object.assign({},e.calculator,{calculateDaYun:()=>({list:c.cycles})});
  const working=e.report.buildFacts(chart,c.gender,{anchorYear:2014,currentYear:2014,lifeContext:{status:'working'},deps:{calculator:calc,chain:e.chain,structural:e.structural}});
  assert.equal(working.currentYear.eventAdjudication.domainRecords.some(r=>r.domain==='study'),false);
  assert.equal(working.wealth.narrative.grade,f.wealth.narrative.grade);
  assert.deepEqual(JSON.parse(JSON.stringify(working.core.strength)),JSON.parse(JSON.stringify(f.core.strength)));
});

test('public career case survives actual empty calibration and paid rendering without converting it to generic household work', async () => {
  const c={id:'public-career-context',gender:'female',birthYear:1992,birth:{date:'1992-04-03',clock:'06:00',trueSolarClock:'05:19'},
    pillars:['壬申','癸卯','己酉','丁卯'],cycles:[{gan:'辛',zhi:'丑',startYear:2011,endYear:2020}]};
  const e=await engine(false), chart=chartFor(e,c), f=reportFor(e,c,2018);
  const core=JSON.stringify(f.core), grade=f.wealth.narrative.grade;
  await applyEmptyReview(e,c,chart,f,2018);
  assert.match(f.currentYear.narrative.verdicts[0].meaningKey,/:career:/);
  assert.equal(f.currentYear.narrative.verdicts[0].outcomeScope,'domain');
  assert.equal(JSON.stringify(f.core),core);
  assert.equal(f.wealth.narrative.grade,grade);
  const sections=renderFacts(f,chart,c.gender);
  const html=Object.values(sections).map(s=>s.html).join('\n');
  assert.match(html,/工作机会与岗位进展/);
  assert.match(html,/若当时在工作或求职/);
  assert.doesNotMatch(f.currentYear.narrative.verdicts[0].outcomeText,/约好要完成的事更容易有人配合/);
});
