'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-09-23T12:00:00+08:00']));} }
function load(chain=false){const box={window:{},Date:FixedDate};vm.runInNewContext(read('js/bazi.js'),box);if(chain)vm.runInNewContext(read('js/bazi-chain.js'),box);return {box,E:box.window.BaZiCalculator};}
function chart(E,text){const p=text.split(' ').map(x=>({gan:x[0],zhi:x[1]}));return E.buildFromPillars({year:p[0],month:p[1],day:p[2],hour:p[3]},'male');}

test('财运统一主引擎旺衰，普通强弱、中和与从格不再另算等级',()=>{
 const {E}=load();
 for(const text of ['辛丑 丙申 己亥 乙亥','丙午 丙午 甲午 戊辰','甲寅 乙卯 甲寅 癸亥','甲子 甲子 癸卯 甲子','丁亥 丁未 壬子 戊申']){
  const b=chart(E,text),j=E.getYongJi(b),w=E.analyzeWealth(b,'male',j);
  assert.equal(w.wangScore,j.dayMasterScore);assert.equal(w.wangStatus,j.dayMasterLevel);
  assert.doesNotMatch(JSON.stringify(w),/千万级别|三五百万|百万级别|你的财运是有根的|方位是财库方向/);
  if(j.congGe)assert.match(w.caiWanxi,/不能套用普通身弱补印比/);
  assert.deepEqual(plain(E.analyzeWealth(b,'male')),plain(w),'省略结果参数也走同一主引擎');
 }
});

test('未定和旧数据缺失清单，不默认补财星方位或身强取用',()=>{
 const {E}=load(),b=chart(E,'甲子 丁卯 己未 庚午');
 const frozen={dayMasterLevel:'中和',dayMasterScore:50,selectionStatus:'undetermined',yongShen:[],xiShen:[],jiShen:[]};
 const w=E.analyzeWealth(b,'male',frozen);
 assert.equal(w.goodDirection,'待定');assert.equal(w.badDirection,'待定');assert.match(w.caiAdvice,/取用尚未确定/);
 assert.equal(E.analyzeWealth(b,'male',{}).goodDirection,'待定');
 const y=E.analyzeThisYear(b,'male',frozen);
 assert.equal(y.isFavorable,null);assert.equal(y.verifiedFavorable,null);assert.equal(y.verificationVerdict,'待复核');
 assert.match(y.opportunities[0],/尚未完成/);assert.doesNotMatch(y.opportunities.join(''),/经.*复核，今年/);
});

test('五年分析跨交运时逐年选大运，不沿用当前大运',()=>{
 const {E,box}=load();let chosen;
 for(let year=1980;year<2000&&!chosen;year++){
  const b=E.calculate(year,6,15,3,'male',6),dy=E.calculateDaYun(b.month,b.year,'male',year,6,15,3,6);
  if(dy.list.some(d=>d.startYear>2026&&d.startYear<=2030))chosen={b,dy};
 }
 assert.ok(chosen,'必须覆盖一次交运');const calls=[];
 box.window.BaZiChain={analyzeLiuNian(b,dy,year){calls.push({dy,year});return {verdict:'中性',verifiedScore:0,summary:'测试复核',verificationBasis:'按本年大运'};}};
 const out=E.analyzeFortune(chosen.b,'male',E.getYongJi(chosen.b));
 assert.equal(calls.length,5);assert.ok(new Set(calls.map(c=>c.dy.gan+c.dy.zhi)).size>=2);
 out.years.forEach((y,i)=>{
  const expected=chosen.dy.list.find(d=>y.year>=d.startYear&&y.year<=d.endYear);
  assert.equal(calls[i].dy.gan+calls[i].dy.zhi,expected.gan+expected.zhi);
  assert.equal(y.verificationDaYun.startYear,expected.startYear);
  assert.equal(y.isFavorable,null);assert.equal(y.verifiedFavorable,null);assert.equal(y.overallLabel,'平稳');
 });
});

test('复核结论能覆盖原局基础方向，正负中性分别保留',()=>{
 const {E,box}=load();const b=E.calculate(1990,6,15,3,'male',6),j=E.getYongJi(b);
 for(const verdict of ['偏吉','偏凶','中性']){
  box.window.BaZiChain={analyzeLiuNian(){return {verdict,verifiedScore:verdict==='偏吉'?2:verdict==='偏凶'?-2:0};}};
  const fortune=E.analyzeFortune(b,'male',j),annual=E.analyzeThisYear(b,'male',j);
  const expected=verdict==='中性'?null:verdict==='偏吉';
  assert.equal(fortune.years[0].isFavorable,expected);assert.equal(annual.isFavorable,expected);
  assert.equal(fortune.years[0].verificationVerdict,annual.verificationVerdict);
 }
});

test('未起运、超出排运范围和纯四柱数据不冒用第一步大运',()=>{
 const {E,box}=load();box.window.BaZiChain={analyzeLiuNian(){throw Error('不应调用');}};
 for(const b of [E.calculate(2035,6,15,3,'male',6),E.calculate(1800,6,15,3,'male',6),chart(E,'甲子 丁卯 己未 庚午')]){
  const f=E.analyzeFortune(b,'male',E.getYongJi(b));
  assert.equal(f.currentDaYun,null);assert.equal(f.dyInfo,'');
  assert.ok(f.years.every(y=>y.verificationDaYun===null&&y.verificationVerdict==='待复核'));
 }
});

test('真实岁运引擎与个人年度摘要保持同一裁决',()=>{
 const {E}=load(true);
 for(const date of [[1990,6,15],[1984,11,11],[1961,9,3],[2004,10,5]]){
  const b=E.calculate(...date,3,'male',6),j=E.getYongJi(b);
  const f=E.analyzeFortune(b,'male',j).years[0],y=E.analyzeThisYear(b,'male',j);
  assert.equal(f.verificationVerdict,y.verificationVerdict);assert.equal(f.isFavorable,y.isFavorable);
  assert.equal(f.fortuneVerificationScore,y.verificationScore);
 }
});

test('伤官配印必须有实际印根，无根不领取制伤奖励，有根正例保留',()=>{
 const {E,box}=load();
 for(const text of ['辛丑 丙申 己亥 乙亥','丙申 丙申 己酉 乙丑','丙戌 癸巳 乙巳 乙酉']){
  const b=chart(E,text),p=E.getPattern(b),j=E.getYongJi(b);
  assert.equal(p.name,'伤官配印格');assert.equal(p.status,'破格');
  assert.ok(p.breakReasons.includes('配印之印虚透无根'));
  assert.equal(p.establishConditions.find(c=>c.condition==='印星有力').met,false);
  assert.ok(j.functionalTasks.every(t=>t.type!=='印星制伤护格'));
  assert.ok(box.calcCandidateScores(b,E.calcDayMasterStrength(b),p).l3Details.some(d=>d.val===0&&/配印之印无有效根气/.test(d.note)));
 }
 const j=E.getYongJi(chart(E,'辛丑 辛卯 壬申 庚子'));
 assert.equal(j.patternStatus.status,'成格');assert.ok(j.functionalTasks.some(t=>t.type==='印星制伤护格'));
});

test('财生杀的浮透食伤或印不认已制化，补根对照保留成格',()=>{
 const {E}=load();
 for(const text of ['己亥 乙亥 己未 辛未','甲申 癸酉 丁巳 庚戌','己未 辛未 乙巳 壬午']){
  const p=E.getPattern(chart(E,text));assert.equal(p.name,'财生杀格');assert.equal(p.status,'破格');
  assert.equal(p.establishConditions.find(c=>c.condition==='七杀有制化').met,false);
 }
 const p=E.getPattern(chart(E,'己亥 乙亥 己未 辛酉'));assert.equal(p.status,'成格');
 assert.equal(p.establishConditions.find(c=>c.condition==='七杀有制化').met,true);
});

test('制杀无效撤销成格奖励，独立通关救应仍保留',()=>{
 const {E,box}=load(),b=chart(E,'丙申 庚寅 戊辰 丁巳'),j=E.getYongJi(b);
 assert.equal(j.dayMasterScore,56);assert.equal(j.yongShen.join(''),'水');
 assert.equal(E.getPattern(b).establishConditions.find(c=>c.condition==='制神有效制杀').met,false);
 const metal=j.candidateScores.find(c=>c.wx==='金'),water=j.candidateScores.find(c=>c.wx==='水');
 assert.equal(metal.L3,0);assert.ok(Math.abs(water.L3-1.8)<1e-9);
 assert.ok(box.calcCandidateScores(b,E.calcDayMasterStrength(b),E.getPattern(b)).l3Details.some(d=>d.val===0&&/制神有效性未通过/.test(d.note)));
});
