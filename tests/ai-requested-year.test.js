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

test('requested-year stem evidence survives server recomputation and reaches the actual AI prompt',()=>{
 const ai=require('../api/ai-chat')._test,chart=enrichRequestedYear(data,2020);
 const rows=chart.timingAdjudication.requestedYear.annualStemInteractions;
 assert.ok(rows.some(r=>r.targetNodeId==='hour.gan'&&r.type==='天干克'&&r.movingActsOnTarget===false));
 const brief=ai.buildTimingAdjudicationBrief('2020年发生什么事？',chart);
 assert.match(brief,/本年天干作用事实/);assert.match(brief,/时柱丙克流年庚/);
 assert.match(brief,/收入、投资损益、购置资产、借贷周转分别判断/);
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

test('favorable structure cannot be used as an unsupported real-life safety net',()=>{
 const ai=require('../api/ai-chat')._test;
 for(const text of ['壬子大运本身是喜用，所以这十年的底子是有人能帮、有资源可用。','方向不算坏到底。','走喜运意味着有人搭手。','大运是帮身的运，所以不是"家里出事"的格局。']) {
  assert.ok(ai.runReplyValidation(null,text,'').some(w=>w.startsWith('E6-')),text);
 }
 for(const text of ['喜用不说明有人能帮，家里仍可能有额外开支。','家人已经明确答应提供资金，这份帮助来自你提供的事实。','喜运只表示扶抑关系，不能据此保证现实顺利。']) {
  assert.equal(ai.runReplyValidation(null,text,'').some(w=>w.startsWith('E6-')),false,text);
 }
});
test('historical year lookup spans multiple charts and preserves frozen natal inputs',()=>{
 for(const pair of ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉']){
  const x={...data,fourPillars:{...data.fourPillars,day:{gan:pair[0],zhi:pair[1]}}};
  const before=JSON.stringify(x);
  for(const year of [2016,2020,2024])assert.equal(enrichRequestedYear(x,year).timingAdjudication.requestedYear.year,year);
  assert.equal(JSON.stringify(x),before);
 }
});

test('AI timing brief carries relationship scope and keeps ranked domains separate from established outcomes',()=>{
 const ai=require('../api/ai-chat')._test;
 const record={domain:'relationship',label:'同辈合作',direction:'偏不利',confidence:'中',relationshipScopes:['cooperation'],concreteOutcomeEstablished:false,hasIndependentAnnualTrigger:true,evidence:['比劫引动'],scenarioCandidates:['合作分工争执']};
 const chart={type:'bazi',timingAdjudication:{requestedYear:{year:2022,adjudication:{age:30,primaryEvent:record,domainRecords:[record]}}}};
 const brief=ai.buildTimingAdjudicationBrief('2022年发生什么事？',chart);
 assert.match(brief,/关系触发范围=同辈合作/);
 assert.match(brief,/尚未证明具体结果/);
 assert.match(brief,/不能算分手/);
});

test('historical event prompt distinguishes outcomes instead of prescribing the same disrupted-plan story',()=>{
 const ai=require('../api/ai-chat')._test;
 const record={domain:'wealth',label:'收入资金',direction:'条件性',confidence:'中',concreteOutcomeEstablished:false,hasIndependentAnnualTrigger:true,evidence:['合成年度事实']};
 const chart={type:'bazi',timingAdjudication:{requestedYear:{year:2021,adjudication:{age:34,primaryEvent:record,domainRecords:[record]}}}};
 const brief=ai.buildTimingAdjudicationBrief('回看2021年，最突出的具体事件是什么？',chart);
 assert.match(brief,/收入增加、投资损失、购置资产/);
 assert.match(brief,/主动换工作、被辞退、录用/);
 assert.match(brief,/不能把同一件事的成本算成第二次命中/);
 assert.match(brief,/没有该事件依据时省略该项/);
 assert.doesNotMatch(brief,/用实际影响解释：哪项安排被打断/);
 assert.match(brief,/尚未证明具体结果/);
});

test('open past-event questions can examine a secondary domain without being forced into the first template',()=>{
 const ai=require('../api/ai-chat')._test;
 const career={domain:'career',label:'事业工作',direction:'偏不利',hasIndependentAnnualTrigger:true,activationScore:9,evidence:['甲克戊'],scenarioCandidates:['任务重做'],concreteOutcomeEstablished:false};
 const relationship={domain:'relationship',label:'感情婚恋',direction:'条件性',hasIndependentAnnualTrigger:true,activationScore:8,evidence:['丙辛合，辰酉合'],relationshipScopes:['marriage'],concreteOutcomeEstablished:false};
 const chart={type:'bazi',timingAdjudication:{requestedYear:{year:1976,adjudication:{age:21,primaryEvent:career,secondaryEvent:relationship,domainRecords:[career,relationship]}}}};
 const question='回看1976年，最突出的具体事件是什么？';
 const brief=ai.buildTimingAdjudicationBrief(question,chart);
 assert.match(brief,/首位领域不是必须回答的答案/);
 assert.match(brief,/同年其他领域依据：感情婚恋/);
 assert.match(brief,/丙辛合，辰酉合/);
 const reply='1976年我优先把结婚列为候选，年干丙合日辛、年支辰合日酉是两处实际关系；仍须由本人确认婚事是否完成。';
 assert.equal(ai.runReplyValidation(chart,reply,question).some(w=>w.startsWith('E8-缺少应期领域锚点')),false);
 assert.ok(ai.runReplyValidation(chart,reply,'1976年工作怎么样？').some(w=>w.startsWith('E8-缺少应期领域锚点')));
});

