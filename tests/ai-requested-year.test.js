const test=require('node:test'),assert=require('node:assert/strict');
const {enrichRequestedYear}=require('../lib/ai-requested-year');
const data={type:'bazi',fourPillars:{year:{gan:'壬',zhi:'午'},month:{gan:'庚',zhi:'戌'},day:{gan:'壬',zhi:'申'},hour:{gan:'丙',zhi:'午'}},birthInfo:{year:2002},daYun:{cycles:[{gan:'壬',zhi:'子',startYear:2015,endYear:2024,displayAge:'14-23'}]}};
test('saved standalone chat can answer a past year absent from its top-three ranking',()=>{
 const before=JSON.stringify(data),out=enrichRequestedYear(data,2020),r=out.timingAdjudication.requestedYear;
 assert.equal(JSON.stringify(data),before);
 assert.equal(r.year,2020);assert.equal(r.liuNian.gan+r.liuNian.zhi,'庚子');assert.equal(r.daYun.gan+r.daYun.zhi,'壬子');
 assert.equal(r.overallVerdict,'变动明显');assert.equal(r.adjudication.age,18);
 const f=r.adjudication.domainRecords.find(x=>x.domain==='family');
 assert.notEqual(f.direction,'偏有利');assert.ok(f.hasIndependentAnnualTrigger);assert.match(f.scenarioCandidates.join(''),/家人身体状况/);
});
test('the requested year is present in the actual prompt and cannot be denied by the reply',()=>{
 const ai=require('../api/ai-chat')._test,chart=enrichRequestedYear(data,2020),q='2020年家里最值得注意的事情是什么？';
 const brief=ai.buildExpertAdjudicationInstruction(q,chart,'simple');
 assert.match(brief,/本轮年份强制锚点.*2020年/);assert.match(brief,/家人身体状况/);
 for(const text of ['2020年这一年的流年裁决字段在本盘里没有提供。','只判变动明显、落点待核。'])assert.ok(ai.runReplyValidation(chart,text,q).some(w=>w.startsWith('E9-')));
 const direct='2020年家庭原有安排容易被打断，家中开销和照顾安排会有压力。子午冲带来变动成本，不能把用神到位就说成家里一切顺利。';
 assert.equal(ai.runReplyValidation(chart,direct,q).some(w=>/^E[89]-/.test(w)),false);
});
test('requested year never invents birth age, decade, or non-bazi facts',()=>{
 assert.equal(enrichRequestedYear(data,1990),data);assert.equal(enrichRequestedYear(data,2200),data);
 const noAge={...data,birthInfo:{}};assert.equal(enrichRequestedYear(noAge,2020).timingAdjudication.requestedYear.adjudication.age,null);
 for(const type of ['hepan','ziwei','liuren']){const x={...data,type};assert.equal(enrichRequestedYear(x,2020),x);}
 const bad={...data,daYun:{cycles:[...data.daYun.cycles,...data.daYun.cycles]}};assert.equal(enrichRequestedYear(bad,2020),bad);
});
test('historical year lookup spans multiple charts and preserves frozen natal inputs',()=>{
 for(const pair of ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉']){
  const x={...data,fourPillars:{...data.fourPillars,day:{gan:pair[0],zhi:pair[1]}}};
  const before=JSON.stringify(x);
  for(const year of [2016,2020,2024])assert.equal(enrichRequestedYear(x,year).timingAdjudication.requestedYear.year,year);
  assert.equal(JSON.stringify(x),before);
 }
});

