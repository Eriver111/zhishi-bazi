'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const report=require('../js/deep-report');
const life={age:30,status:'working',relationshipStatus:'unknown'};
const base={domain:'relationship',hasIndependentAnnualTrigger:true,direction:'偏不利',activationScore:8,
  evidence:['流年申冲日支寅'],scenarioCandidates:[]};
function describe(rows,extra={}) {
  const record={...base,...extra};
  const year={year:2026,lifeContext:life,dynamic:{triggers:rows},eventAdjudication:{age:30,lifeContext:life,domainRecords:[record]}};
  return report.__test.describeTimingEvent(record,year.eventAdjudication,life,year);
}
const clash={type:'六冲',target:'day',source:'流年',detail:'流年申冲日支寅'};
test('clash alone retains a relationship topic without manufacturing arguments or separation',()=>{
  const event=describe([clash]);
  assert.equal(event.eventType,'relationship-palace-contact');assert.equal(event.structuralOnly,true);
  assert.equal(event.eventEstablished,false);assert.equal(event.supportLevel,'domain');
  assert.match(event.scenario,/感情变动/);assert.doesNotMatch(event.scenario,/争吵|疏远|分合压力|聚少离多|待复核/);
  assert.equal(event.palaceContacts[0].evidence,'流年申冲日支寅');
});
test('coexisting combine and clash are retained in either order without selecting an outcome by order',()=>{
  const combine={type:'六合',target:'day',source:'流年',detail:'流年合日支'};
  const a=describe([clash,combine]),b=describe([combine,clash,clash]);
  assert.deepEqual(a,b);assert.equal(a.palaceContacts.length,2);
  for(const direction of ['偏不利','偏有利','条件性'])assert.equal(describe([clash],{direction}).scenario,a.scenario);
});
test('decade-only, inactive, stem and other-palace contacts cannot become this annual marriage topic',()=>{
  for(const change of [{source:'大运'},{active:false},{layer:'天干'},{target:'month'}])
    assert.notEqual(describe([{...clash,...change}]).eventType,'relationship-palace-contact');
});
test('explicitly recorded marriage or breakup is preserved rather than generalized away',()=>{
  for(const event of ['marriage','breakup']){
    const text=event==='marriage'?'2026年登记结婚。':'2026年结束交往。';
    const result=describe([clash],{reportScenario:text,reportLabel:text,reportEventType:'relationship-'+event,
      reportMechanismKey:'rule:confirmed',reportFeedback:{state:'repeated',confirmedYears:[2026],outcome:text}});
    assert.equal(result.eventType,'relationship-'+event);assert.equal(result.scenario,text);
  }
});
