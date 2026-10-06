'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Report = require('../js/deep-report');
const { engine, chartFor, reportFor, payload } = require('../scripts/real-case-audit-utils');
const { applyEmptyReview } = require('../scripts/real-case-round3');
const { enrichRequestedYear } = require('../lib/ai-requested-year');
const { renderFacts } = require('../scripts/real-case-report-render');
const plain = x => JSON.parse(JSON.stringify(x));
async function reportEngine() {
  const e = await engine(false);
  for (const file of ['report-imagery.js','calibration-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),e.context,{filename:file});
  }
  return e;
}

const cases = [
  { id:'public-career-annual', gender:'male', birthYear:1981,
    birth:{date:'1981-07-27',clock:'15:16'}, pillars:['辛酉','乙未','丙午','丙申'],
    cycles:[{gan:'壬',zhi:'辰',startYear:2008,endYear:2017}], year:2011 },
  { id:'public-study-entry', gender:'female', birthYear:1994,
    birth:{date:'1994-06-03',clock:'16:36'}, pillars:['甲戌','己巳','庚申','甲申'],
    cycles:[{gan:'丁',zhi:'卯',startYear:2013,endYear:2022}], year:2014 },
  { id:'public-study-exam', gender:'male', birthYear:2001,
    birth:{date:'2001-06-19',clock:'22:37'}, pillars:['辛巳','甲午','癸丑','癸亥'],
    cycles:[{gan:'壬',zhi:'辰',startYear:2016,endYear:2025}], year:2023 }
];

test('broad favorable/adverse decade domains cannot change annual direction, evidence, or ranking', async () => {
  const e = await engine(false);
  for (const c of cases) {
    const chart=chartFor(e,c), dy=c.cycles[0], yongJi=e.calculator.getYongJi(chart);
    const ln=e.calculator.calculateLiuNian(dy,chart.day.gan).find(r=>r.year===c.year);
    const options={birthYear:c.birthYear,age:c.year-c.birthYear};
    const base=e.chain.analyzeLiuNian(chart,dy,ln,yongJi,options);
    for (const direction of ['偏有利','偏不利','条件性']) {
      const ledger={domainRecords:['study','career','wealth','relationship','family','health','change'].map(domain=>({
        domain,label:domain,direction,activationScore:999,conclusion:'合成十年背景'
      }))};
      const before=JSON.stringify(ledger);
      const withBackground=e.chain.analyzeLiuNian(chart,dy,ln,yongJi,{...options,daYunEventLedger:ledger});
      assert.deepEqual(plain(withBackground.eventAdjudication.domainRecords),plain(base.eventAdjudication.domainRecords),c.id+direction);
      assert.deepEqual(plain(withBackground.triggers),plain(base.triggers),'Actual year/decade interactions remain present');
      assert.equal(withBackground.verifiedScore,base.verifiedScore);
      assert.equal(withBackground.eventAdjudication.daYunBackground.domainRecords.length,7);
      assert.equal(withBackground.eventAdjudication.daYunBackground.domainRecords[0].direction,direction);
      assert.equal(JSON.stringify(ledger),before);
    }
  }
});

test('decade-only background never manufactures an independent annual event', async () => {
  const e=await engine(false),c=cases[0],chart=chartFor(e,c),dy=c.cycles[0];
  const source={triggers:[],stemRole:'中性',dangerScore:0,opportunityScore:0};
  const background={domainRecords:[{domain:'family',direction:'偏有利',activationScore:1000,conclusion:'家人支持增加'}]};
  const ledger=e.chain.buildAnnualEventAdjudication(chart,dy,{year:2011,gan:'辛',zhi:'卯'},source,{age:30,daYunPeriod:{eventLedger:background}});
  assert.ok(ledger.domainRecords.every(r=>!r.hasIndependentAnnualTrigger));
  const family=ledger.domainRecords.find(r=>r.domain==='family');
  assert.equal(family.direction,'条件性');
  assert.equal(family.evidence.length,0);
  assert.equal(ledger.daYunBackground.domainRecords[0].conclusion,'家人支持增加');
});

test('public conditional career year has the same annual verdict in AI enrichment and actual report', async () => {
  const e=await reportEngine(),c=cases[0],chart=chartFor(e,c),f=reportFor(e,c,c.year);
  const core=JSON.stringify(f.core),grade=f.wealth.narrative.grade;
  const api=enrichRequestedYear(payload(e,c,c.year,'direction-regression').chartData,c.year).timingAdjudication.requestedYear;
  const report=f.currentYear.eventAdjudication;
  for(const record of report.domainRecords) {
    assert.deepEqual(plain(record.evidence),plain(api.adjudication.domainRecords.find(r=>r.domain===record.domain).evidence));
    assert.equal(record.direction,api.adjudication.domainRecords.find(r=>r.domain===record.domain).direction);
  }
  assert.equal(report.domainRecords.find(r=>r.domain==='career').direction,'条件性');
  assert.equal(report.daYunBackground.domainRecords.find(r=>r.domain==='career').direction,'偏有利');
  await applyEmptyReview(e,c,chart,f,c.year);
  const career=f.currentYear.narrative.verdicts.find(v=>/:career:/.test(v.meaningKey));
  assert.ok(career);
  assert.doesNotMatch(career.text,/更容易落实|易升职|已经录用/);
  assert.equal(career.displayTitle,'工作与求职的变化');
  assert.equal(JSON.stringify(f.core),core);
  assert.equal(f.wealth.narrative.grade,grade);
});

test('supported academic domains survive actual review and paid rendering without inventing exam outcomes', async () => {
  const e=await reportEngine();
  for(const c of cases.slice(1)) {
    const chart=chartFor(e,c),f=reportFor(e,c,c.year),before=JSON.stringify(f.core),grade=f.wealth.narrative.grade;
    assert.equal(f.currentYear.eventAdjudication.primaryEvent.domain,'study');
    await applyEmptyReview(e,c,chart,f,c.year);
    const study=f.currentYear.narrative.verdicts.find(v=>/:study:/.test(v.meaningKey));
    assert.ok(study,c.id);
    assert.equal(study.eventType,'study-opportunity-domain');
    assert.equal(study.detailOnly,false);
    assert.match(study.text,/若当时在读或备考/);
    assert.doesNotMatch(study.text,/已经考上|一定考上|考研失败|进入大学|已被录取/);
    const html=Object.values(renderFacts(f,chart,c.gender)).map(s=>s.html).join('\n');
    assert.ok(html.includes(study.displayTitle));
    assert.equal(JSON.stringify(f.core),before);
    assert.equal(f.wealth.narrative.grade,grade);
  }
});

function fixture(studyScene, studyDirection='偏有利') {
  const lifeContext={status:'unknown',age:23};
  const study={domain:'study',direction:studyDirection,activationScore:10,hasIndependentAnnualTrigger:true,
    scenarioCandidates:[studyScene],evidence:['合成年度独立学业依据']};
  const work={domain:'career',direction:'偏有利',activationScore:5,hasIndependentAnnualTrigger:true,
    scenarioCandidates:['项目交付、成果展示或岗位推进更容易落实'],evidence:['合成年度独立工作依据']};
  const year={year:2026,lifeContext,eventAdjudication:{age:23,lifeContext,primaryEvent:study,secondaryEvent:work,domainRecords:[study,work]}};
  return {core:{},wealth:{},relationship:{},study:{},currentYear:year,fiveYear:{years:[year]}};
}

test('learning wording is not demoted to process merely because it omits the word exam',()=>{
  for(const [scene,direction] of [['复习吸收与临场发挥更容易稳定','偏有利'],['复习节奏、临场发挥或成绩稳定性更容易受阻','偏不利']]) {
    const f=fixture(scene,direction),v=Report.buildNarratives(f).currentYear.verdicts[0];
    assert.equal(v.eventType,'study-opportunity-domain');
    assert.equal(v.detailOnly,false);
    assert.match(v.text,/若当时在读或备考/);
  }
});

test('a specific supported cash outcome may precede the strongest academic domain',()=>{
  const f=fixture('复习吸收与临场发挥更容易稳定');
  const cash={domain:'wealth',direction:'偏不利',activationScore:3,hasIndependentAnnualTrigger:true,
    reportScenario:'约好的款项延迟到账',reportEventType:'payment-delay',reportMechanismKey:'rule:synthetic',reportLabel:'款项延迟',evidence:['合成独立钱款依据']};
  f.currentYear.eventAdjudication.domainRecords.push(cash);
  const vs=Report.buildNarratives(f).currentYear.verdicts;
  assert.equal(vs[0].eventType,'payment-delay');
  assert.equal(vs[1].eventType,'study-opportunity-domain');
  f.currentYear.eventAdjudication.primaryEvent.hasIndependentAnnualTrigger=false;
  assert.equal(Report.buildNarratives(f).currentYear.verdicts.some(v=>v.eventType==='study-opportunity-domain'),false);
});
