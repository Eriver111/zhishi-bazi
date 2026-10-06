'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const c={console};c.window=c;vm.createContext(c);
for(const name of ['bazi.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name),'utf8'),c);
function chart(pillars){return c.BaZiCalculator.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,{gan:pillars[i][0],zhi:pillars[i][1]}])),'male');}
function annual(b,gan,zhi='子'){return c.BaZiChain.analyzeLiuNian(b,{gan:'甲',zhi:'辰'},{gan,zhi,year:2020},c.BaZiCalculator.getYongJi(b),{age:34});}
test('all five stem combinations retain their actual non-day participants without automatic transformation',()=>{
 for(const [moving,target] of [['甲','己'],['乙','庚'],['丙','辛'],['丁','壬'],['戊','癸'],['己','甲'],['庚','乙'],['辛','丙'],['壬','丁'],['癸','戊']]){
  const b=chart([target+('甲丙戊庚壬'.includes(target)?'子':'丑'),'丙寅','甲辰','壬申']);
  const y=c.BaZiCalculator.getYongJi(b),before=JSON.stringify(b);
  const row=c.BaZiChain.collectAnnualStemInteractions(b,{gan:'甲',zhi:'辰'},{gan:moving,zhi:'子'},y).find(r=>r.type==='天干五合'&&r.target==='year');
  assert.ok(row,moving+target);assert.equal(row.targetNodeId,'year.gan');assert.equal(row.targetLayer,'stem');
  assert.equal(row.transformationEstablished,false);assert.equal(row.isGood,null);assert.equal(row.eventEstablished,false);
  assert.equal(JSON.stringify(b),before);
 }
});
test('same chart distinguishes annual targets and retains competing combinations',()=>{
 const b=chart(['丁卯','丁未','丙戌','戊子']);
 const a=annual(b,'壬','寅').annualStemInteractions.filter(r=>r.type==='天干五合');
 assert.deepEqual(Array.from(a,r=>r.target),['year','month']);
 assert.deepEqual(Array.from(a[0].competingTargetNodeIds),['month.gan']);
 const next=annual(b,'癸','卯').annualStemInteractions.filter(r=>r.type==='天干五合');
 assert.deepEqual(Array.from(next,r=>r.target),['hour']);
 assert.equal(next[0].targetShiShen,'食神');
 assert.ok(a.every(r=>r.targetShiShen==='劫财'));
});
test('generation and control preserve direction rather than reversing who acts on whom',()=>{
 const b=chart(['庚子','戊寅','丙辰','甲申']),rows=annual(b,'壬').annualStemInteractions;
 const generated=rows.find(r=>r.type==='天干生'&&r.target==='year');
 assert.equal(generated.fromNodeId,'year.gan');assert.equal(generated.toNodeId,'annual.gan');
 const controlled=rows.find(r=>r.type==='天干克'&&r.target==='month');
 assert.equal(controlled.fromNodeId,'month.gan');assert.equal(controlled.toNodeId,'annual.gan');
 const forward=rows.find(r=>r.type==='天干生'&&r.target==='hour');
 assert.equal(forward.fromNodeId,'annual.gan');assert.equal(forward.toNodeId,'hour.gan');
 const decade=rows.find(r=>r.type==='天干生'&&r.target==='dayun');
 assert.equal(decade.source,'岁运');assert.equal(decade.targetScope,'dayun');
});
test('new stem facts cannot silently alter existing domain scores or imply a salary, marriage, or loss',()=>{
 for(const pillars of [['丙寅','丁酉','丁卯','丙午'],['丁卯','丁未','丙戌','戊子'],['庚午','甲申','丙戌','壬辰']]){
  const b=chart(pillars);
  for(const gan of '甲乙丙丁戊己庚辛壬癸'){
   const a=annual(b,gan),again=c.BaZiChain.buildAnnualEventAdjudication(b,{gan:'甲',zhi:'辰'},{gan,zhi:'子',year:2020},{...a,annualStemInteractions:[]},{age:34});
   assert.equal(JSON.stringify(a.eventAdjudication),JSON.stringify(again));
   assert.ok(a.annualStemInteractions.every(r=>r.stage==='relation'&&r.eventEstablished===false&&r.isGood===null));
  }
 }
});
