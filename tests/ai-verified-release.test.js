'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHarness,response}=require('./helpers/ai-release-harness.cjs');
const {validateChartEvidence}=require('../lib/ai-chart-evidence');
const {validateExplicitActionClaims,validatePalaceAbsenceInference}=require('../lib/ai-explicit-action-claims');
const chart={type:'bazi',gender:'female',fourPillars:{year:{gan:'甲',zhi:'寅'},month:{gan:'丙',zhi:'寅'},day:{gan:'乙',zhi:'巳'},hour:{gan:'癸',zhi:'未'}}};
const wrong='年柱、月柱都是甲，所以父母办事的方式一致，你需要按他们的方式处理所有事情。';
const corrected='你的年干是甲，月干是丙。不能把两柱都当成甲来推断父母的做事方式；这里只能先说明这两个位置的区别。';
test('captured grouped-stem error is repaired from facts without retaining the false narrative',async()=>{
  const h=createHarness(async(_,n)=>response(n===1?wrong:corrected)),meta={};
  const reply=await h.callAI('请解释父母关系的依据。',chart,null,[],'simple',null,meta);
  assert.equal(reply,corrected);assert.equal(h.payloads.length,2);
  assert(!JSON.stringify(h.payloads[1]).includes('你需要按他们的方式处理所有事情'));
  assert.equal(h.payloads[1].messages.at(-1).content,'请解释父母关系的依据。');
  assert.equal(meta.expertScorecard.eventAccuracyAssessed,false);
});
test('persistent invalid facts return a retryable failure before saving or consuming quota',async()=>{
  const h=createHarness(async()=>response(wrong));
  const result=await h.request('请解释父母关系的依据。',chart);
  assert.equal(result.statusCode,502);assert.equal(result.body.code,'REPLY_EVIDENCE_VALIDATION_FAILED');
  assert.equal(result.body.charged,false);assert.equal(result.body.retryable,true);
  assert.deepEqual(h.counters,{charged:0,saved:0});assert.equal(h.payloads.length,2);
});
test('failed correction transport does not release or charge for the invalid answer',async()=>{
  const h=createHarness(async(_,n)=>{if(n===2)throw Error('simulated unavailable');return response(wrong);});
  const result=await h.request('请解释父母关系的依据。',chart);
  assert.equal(result.statusCode,502);assert.deepEqual(h.counters,{charged:0,saved:0});
});
test('the original broken-pattern phrasing is a status rather than a renamed pattern',()=>{
  const api=createHarness(()=>{}).api;
  const d={...chart,pattern:{name:'偏财格',status:'破格'}};
  assert(!api.runReplyValidation(d,'主格为偏财格，格局判为破格。','格局是什么？').some(w=>/^E3-/.test(w)));
  assert(api.runReplyValidation(d,'主格为偏财格，格局判为成格。','格局是什么？').some(w=>/^E3-格局状态/.test(w)));
  assert(api.runReplyValidation(d,'主格为正官格。','格局是什么？').some(w=>/^E3-格局名/.test(w)));
});
test('captured literal mistakes and unsupported absence exclusions remain rejected',()=>{
  for(const bad of ['己克乙。','寅丑相刑。','年柱、月柱都是甲。'])
    assert(validateExplicitActionClaims(chart,bad).length,bad);
  assert(validatePalaceAbsenceInference(chart,'因为夫妻宫没有冲合，所以这一年不会结婚。').length);
  for(const allowed of ['乙克己。','没有夫妻宫冲合不等于不能结婚。','如果己克乙，这个说法是错的。'])
    assert.deepEqual(validateExplicitActionClaims(chart,allowed),[]);
});
test('hidden output does not become visible output when discussing a dated year',()=>{
  const d={type:'bazi',fourPillars:{year:{gan:'丁',zhi:'酉'},month:{gan:'乙',zhi:'巳'},day:{gan:'戊',zhi:'寅'},hour:{gan:'丁',zhi:'巳'}},
    daYun:{cycles:[{gan:'庚',zhi:'子',startYear:1997,endYear:2006}]},
    timingAdjudication:{requestedYear:{year:2005,liuNian:{gan:'乙',zhi:'酉'},daYun:{gan:'庚',zhi:'子'}}}};
  assert(validateChartEvidence(d,'天干伤官见官。','2005年感情如何？').some(w=>/透藏层次/.test(w)));
  assert.deepEqual(validateChartEvidence(d,'伤官藏在酉中，正官乙透干。','2005年感情如何？'),[]);
});
test('multiple exposed columns cannot be assigned one ten-god identity indiscriminately',()=>{
  assert(validateExplicitActionClaims(chart,'你年柱、月柱都是劫财当头，说明家里人人有主张。').some(w=>/多柱十神/.test(w)));
  const stems='甲乙丙丁戊己庚辛壬癸',gods=[['比肩','劫财'],['食神','伤官'],['偏财','正财'],['七杀','正官'],['偏印','正印']];
  for(let i=0;i<10;i++)for(let j=0;j<10;j++){
    const d=structuredClone(chart);d.fourPillars.day.gan=stems[i];d.fourPillars.year.gan=stems[j];d.fourPillars.month.gan=stems[j];
    const god=gods[(Math.floor(j/2)-Math.floor(i/2)+5)%5][i%2===j%2?0:1];
    assert.deepEqual(validateExplicitActionClaims(d,'年柱、月柱都是'+god+'。'),[]);
    const wrong=god==='正印'?'偏财':'正印';
    assert(validateExplicitActionClaims(d,'年干和月干都是'+wrong+'。').length);
  }
  for(const text of ['不能说年柱、月柱都是劫财。','“年柱、月柱都是劫财”是错误说法。','假如年柱、月柱都是劫财，另作判断。','年柱、月柱都是劫财吗？'])
    assert.deepEqual(validateExplicitActionClaims(chart,text),[]);
});
