'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateChartEvidence}=require('../lib/ai-chart-evidence');
const chart=words=>({type:'bazi',fourPillars:Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:words[i][0],zhi:words[i][1]}]))});
const em=chart(['丙寅','癸巳','乙亥','壬午']);
const roots=(data,text,question='2011年是否考取？')=>validateChartEvidence(data,text,question).filter(s=>s.includes('具名天干根气范围错误'));
test('real false premise of no root is rejected despite opposite-polarity hidden metal roots',()=>{
 for(const s of ['辛金本身在命里没根（金只有巳、申里的藏干），生印的力量虚。','辛金在原局没有根，所以生印不力。','辛完全无根。','辛不通根。']){
  const w=roots(em,s);assert.equal(w.length,1,s);assert.match(w[0],/月支巳藏庚/);assert.match(w[0],/不得自动将结果翻成相反方向/);
 }
});
test('root existence is not root efficacy, strength, exposedness or a particular-pillar finding',()=>{
 for(const s of ['辛金无强根。','辛金没有有效根。','辛金无透干同类。','辛金只在藏干有根。','辛金在原局有根，但根受制。',
  '只看辛金无根。','本柱辛金无根。','辛金坐下无根。','受冲以后辛金根气受损。','辛金在原局没有完整根。'])assert.equal(roots(em,s).length,0,s);
});
test('quotations, questions, negation, hypothetical and other charts do not become the current chart assertion',()=>{
 for(const s of ['辛金无根吗？','不能说辛金无根。','辛金无根的说法是错误的。','“辛金无根”是不对的。','如果辛金无根，生印另看。',
  '例如辛金无根。','老师说：辛金无根。','> 辛金无根。','```\n辛金无根\n```','对方的命盘里辛金无根。'])assert.equal(roots(em,s).length,0,s);
 assert.equal(roots(em,'“辛金无根”不对。可是辛金在原局没根。').length,1);
 assert.equal(roots(em,'辛金无根。','换日主，以丙为参照').length,0);
});
test('all ten stems across twelve branches follow literal same-element hidden roots, not a single chart exception',()=>{
 const hidden={子:'癸',丑:'己癸辛',寅:'甲丙戊',卯:'乙',辰:'戊乙癸',巳:'丙庚戊',午:'丁己',未:'己丁乙',申:'庚壬戊',酉:'辛',戌:'戊辛丁',亥:'壬甲'};
 const stems='甲乙丙丁戊己庚辛壬癸',element=g=>Math.floor(stems.indexOf(g)/2);
 for(const g of stems)for(const [z,chars] of Object.entries(hidden)){
  const data=chart(['甲'+z,'丙'+z,'戊'+z,'庚'+z]),expected=[...chars].some(h=>element(h)===element(g));
  assert.equal(roots(data,g+'无根。').length,expected?1:0,g+z);
 }
});
test('missing chart and non-bazi contexts do not apply named-root claims',()=>{
 for(const type of ['hepan','ziwei','liuyao'])assert.deepEqual(validateChartEvidence({...em,type},'辛无根。'),[]);
 assert.deepEqual(validateChartEvidence({},'辛无根。'),[]);
});
