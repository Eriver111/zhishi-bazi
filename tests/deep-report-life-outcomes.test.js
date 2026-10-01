const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report');
const fs = require('node:fs'), path = require('node:path');
const life = {status:'working', age:30};
function record(domain,type,extra={}) { return {domain,hasIndependentAnnualTrigger:true,activationScore:8,direction:'偏不利',
  reportEventType:type,reportScenario:type === 'submission-rework' ? '交出的方案被退回重做。' : '原先约好的款项可能延迟到账。',
  reportLabel:type,reportMechanismKey:'rule:'+type,evidence:['合成作用依据'],...extra}; }
function year(records,extra={}) {return {year:2026,pillar:{gan:'丙',zhi:'午'},lifeContext:life,
  eventAdjudication:{age:30,lifeContext:life,domainRecords:records,primaryEvent:records[0],secondaryEvent:records[1]},...extra};}
function facts(rows) {return {core:{},wealth:{},relationship:{},study:{},currentYear:rows[0],fiveYear:{years:rows}};}
function describe(r,opts={}) {const y=year([r],opts);return Report.__test.describeTimingEvent(r,y.eventAdjudication,opts.lifeContext||life,y);}

test('money outcomes move ahead of rework without displacing the stronger family concern',()=>{
  const family=record('family','family-scope',{reportScenario:'家里需要处理的事情增加。',activationScore:20});
  const process=record('career','submission-rework',{activationScore:15});
  const cash=record('wealth','payment-delay',{activationScore:5});
  const y=year([family,process,cash]), before=JSON.stringify(y);
  const n=Report.buildNarratives(facts([y])).currentYear;
  assert.deepEqual(n.verdicts.map(v=>v.outcomeScope),['family','money']);
  assert.doesNotMatch(n.headline,/返工|submission-rework/);
  assert.equal(JSON.stringify(y),before);
});

test('a process-only year remains available in details without promotion to job loss',()=>{
  const n=Report.buildNarratives(facts([year([record('career','submission-rework')]) ]));
  assert.equal(n.currentYear.verdicts[0].detailOnly,true);
  assert.equal(n.fiveYear.years[0].detailOnly,true);
  assert.match(n.fiveYear.years[0].processDetails[0].scenario,/被退回重做/);
  assert.doesNotMatch(JSON.stringify(n),/将被辞退|必定失业|失业之年/);
});

test('recognized monetary consequences and formal responsibilities are not hidden by their domain',()=>{
  assert.equal(describe(record('career','payment-delay')).outcomeScope,'money');
  assert.equal(describe(record('career','responsibility-assigned')).outcomeScope,'career');
  assert.equal(describe(record('study','formal-eligibility-reviewed')).outcomeScope,'study');
  assert.equal(describe(record('career','submission-rework')).outcomeScope,'process');
});

test('adult students and exam takers retain day-palace relationship scope',()=>{
  for(const status of ['student','exam','working']) {
    const r=record('relationship','',{reportScenario:'',reportMechanismKey:'',direction:'偏有利'});
    const y=year([r],{lifeContext:{age:25,status},dynamic:{triggers:[{type:'六合',target:'day',source:'流年'}]}});
    y.eventAdjudication.lifeContext=y.lifeContext;
    const d=Report.__test.describeTimingEvent(r,y.eventAdjudication,y.lifeContext,y);
    assert.equal(d.outcomeScope,'relationship');
    assert.match(d.scenario,/明确交往|共同生活/);
    assert.doesNotMatch(d.scenario,/同学|交接|任务|一定结婚/);
  }
});

test('unknown or nonfinite age and non-day cooperation do not become marriage windows',()=>{
  const r=record('relationship','',{reportScenario:'',reportMechanismKey:''});
  for(const age of [null,'',NaN,Infinity,'unknown',17]) {
    const y=year([r],{lifeContext:{age,status:'exam'},dynamic:{triggers:[{type:'六冲',target:'day',source:'流年'}]}});
    y.eventAdjudication.lifeContext=y.lifeContext;y.eventAdjudication.age=age;
    const d=Report.__test.describeTimingEvent(r,y.eventAdjudication,y.lifeContext,y);
    assert.equal(d.outcomeScope,'process');
    assert.doesNotMatch(d.label,/分合压力|感情能否确定/);
  }
  assert.equal(describe(r,{dynamic:{triggers:[{type:'六合',target:'month',source:'流年'}]}}).outcomeScope,'process');
});

test('a dedicated bonding paragraph cannot hide a concurrent unresolved day clash',()=>{
  const r=record('relationship','relationship-bond-closer',{reportScenario:'若有交往对象，彼此联系加深。'});
  const d=describe(r,{dynamic:{triggers:[{type:'六合',target:'day',source:'流年'},{type:'六冲',target:'day',source:'流年',isGood:null}]}});
  assert.equal(d.eventType,'relationship-bond-with-conflict');
  assert.match(d.scenario,/并存|不稳/);
  assert.match(d.scenario,/分歧|疏远/);
  assert.doesNotMatch(d.scenario,/必定离婚|关系一定稳定/);
});

test('denied or untriggered relationship interpretations cannot return through outcome selection',()=>{
  const r=record('relationship','relationship-bond-closer',{reportExcluded:true});
  const y=year([r],{dynamic:{triggers:[{type:'六冲',target:'day',source:'流年'}]}});
  assert.equal(Report.buildNarratives(facts([y])).currentYear.verdicts.length,0);
  r.reportExcluded=false;r.hasIndependentAnnualTrigger=false;
  assert.equal(Report.buildNarratives(facts([y])).currentYear.verdicts.length,0);
});

test('mixed years display money and keep rework in the separate process details',()=>{
  const y=year([record('career','submission-rework'),record('wealth','payment-delay')]);
  const row=Report.buildNarratives(facts([y])).fiveYear.years[0];
  assert.equal(row.detailOnly,false);
  assert.match(row.summary,/款项/);
  assert.doesNotMatch(row.summary,/方案|重做/);
  assert.match(row.processDetails[0].scenario,/方案/);
});

test('cycle dates use the known interval, never invent a next cycle or decision event',()=>{
  const y=year([],{daYun:{gan:'甲',zhi:'子',startYear:2020,endYear:2029}});
  const f=facts([y]);f.fiveYear.daYunList=[y.daYun,{gan:'乙',zhi:'丑',startYear:2030,endYear:2039}];
  const text=Report.buildNarratives(f).fiveYear.verdicts[0].outcomeText;
  assert.match(text,/2020—2029/);assert.match(text,/2030年进入下一步乙丑/);
  assert.doesNotMatch(text,/2030年必.*(?:辞职|结婚|搬家)/);
});

test('the report does not solicit income, assets, debt or family capital to show its A grade',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/result.js'),'utf8');
  assert.doesNotMatch(source,/wealthIncomeLevel|wealthAssetLevel|wealthDebt|wealthFamilySupport|校对现实财富基准/);
  assert.match(source,/deep-report-grade/);
});
