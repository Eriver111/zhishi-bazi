'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,'js',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const box={console};box.window=box;box.self=box;
for(const f of ['bazi.js','hepan-core.js','liuyao-core.js','iztro.min.js'])vm.runInNewContext(read(f),box);
const E=box.BaZiCalculator;
function chart(text){const p=text.split(' ').map(s=>({gan:s[0],zhi:s[1]}));return E.buildFromPillars({year:p[0],month:p[1],day:p[2],hour:p[3]},'male');}

test('调候与扶抑冲突时，个人、候选表与合盘保持同一首用及辅助边界',()=>{
 for(const [text,primary] of [['丙申 己亥 丁卯 壬寅','木'],['丁亥 丁未 辛未 戊戌','水'],['己巳 庚午 甲辰 庚午','水'],['壬子 丁未 辛丑 戊子','土']]){
  const b=chart(text),j=E.getYongJi(b),p={name:'机制样本',_professionalFacts:{yongJi:j}};
  const pair=box._hepanHelpers.analyzeXiyong(p,p);
  assert.equal(j.yongShen[0],primary);
  for(const k of ['yongShen','xiShen','jiShen','tiaoHouYongShen'])assert.deepEqual(plain(pair.p1[k]),plain(j[k]));
  for(const c of j.candidateScores||[])assert.equal(c.role,j.elementClassification[c.wx]);
  assert.ok(j.yongShen.every(w=>j.xiShen.includes(w)));assert.ok(!j.xiShen.some(w=>j.jiShen.includes(w)));
 }
});

test('1024日期覆盖旺衰四条分档边界，财运与合盘不另造等级或取用',()=>{
 let seed=0x92328;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
 const near={30:0,40:0,60:0,80:0};
 for(let i=0;i<1024;i++){
  const hour=rand(24),b=E.calculate(1930+rand(100),1+rand(12),1+rand(28),Math.floor((hour+1)%24/2),'male',hour);
  const s=E.calcDayMasterStrength(b,{audit:true}),j=E.getYongJi(b),w=E.analyzeWealth(b,'male',j);
  assert.equal(w.wangScore,s.score);assert.equal(w.wangStatus,s.level);assert.equal(j.dayMasterLevel,s.level);assert.equal(s.audit.sumMatches,true);
  const person={name:'样本'+i,_professionalFacts:{strength:s,yongJi:j}},pair=box._hepanHelpers.analyzeXiyong(person,person);
  assert.deepEqual(plain(pair.p1.yongShen),plain(j.yongShen));assert.deepEqual(plain(pair.p1.jiShen),plain(j.jiShen));
  for(const boundary of Object.keys(near))if(Math.abs(s.score-Number(boundary))<=1)near[boundary]++;
 }
 for(const [boundary,count] of Object.entries(near))assert.ok(count>0,'缺少边界覆盖 '+boundary);
});

test('六爻64本卦×64动爻组合：变卦六亲始终沿用本宫，世应间隔与伏神不串卦',()=>{
 const L=box.LIUYAO,WX=['木','火','土','金','水'];
 const relative=(palace,element)=>['兄弟','子孙','妻财','官鬼','父母'][(WX.indexOf(element)-WX.indexOf(palace)+5)%5];
 for(let n=0;n<64;n++){
  const lines=Array.from({length:6},(_,i)=>(n>>i)&1),original=L.zhuangGua(lines,0,'寅'),snapshot=JSON.stringify(original);
  assert.equal((original.yingYao-original.shiYao+6)%6,3);
  for(const f of L.getFuShen(original.guaName,original.liuqin,original.yaoWX))assert.ok(!original.liuqin.includes(f.qin));
  for(let moving=0;moving<64;moving++){
   const changed=lines.map((v,i)=>v^((moving>>i)&1));
   const out=L.zhuangGua(changed,0,'寅',{liuQinGongWX:original.gongWX});
   assert.deepEqual(plain(out.liuqin),plain(out.yaoWX.map(wx=>relative(original.gongWX,wx))));
   assert.equal(JSON.stringify(original),snapshot);
  }
 }
});

test('紫微跨年、闰月与十二时辰：浏览器和服务端排盘及四化消费一致',()=>{
 const official=require('iztro'),input=require('../js/ziwei-input.js'),P=require('../js/ziwei-professional.js');
 const dates=['1999-12-31','2000-1-1','2012-5-21','2020-6-20','2023-3-22','2023-4-5','2023-4-19','2024-2-9','2024-2-10','2025-7-25','2025-8-8','2025-8-22'];
 const facts=z=>plain({lunarDate:z.lunarDate,chineseDate:z.chineseDate,soul:z.earthlyBranchOfSoulPalace,body:z.earthlyBranchOfBodyPalace,ju:z.fiveElementsClass,palaces:z.palaces});
 for(const date of dates)for(let time=0;time<12;time++)for(const gender of ['male','female']){
  const [year,month,day]=date.split('-').map(Number),hour=time===0?23:time*2;
  const normalized=input.normalizeBirth({year,month,day,hour,minute:30,calculator:E,useTrueSolarTime:false,ziHourNextDay:true});
  const browser=box.iztro.astro.bySolar(normalized.solarDate,normalized.timeIndex,gender,true,'zh-CN');
  const server=official.astro.bySolar(normalized.solarDate,normalized.timeIndex,gender,true,'zh-CN');
  assert.deepEqual(facts(browser),facts(server));
  P.applyWenmoAuxiliaryConvention(browser);const once=facts(browser);P.applyWenmoAuxiliaryConvention(browser);assert.deepEqual(facts(browser),once);
  const data=P.buildChatData(browser,{y:year,m:month,d:day,h:hour,isMale:gender==='male'},normalized,null);
  assert.equal(data.palaces.length,12);assert.equal(new Set(data.palaces.map(p=>p.index)).size,12);
  assert.deepEqual(data.sihua.map(x=>x.star+':'+x.hua),P.collectMutagens(browser).map(x=>x.star+':'+x.hua));
  assert.equal(data.mingGong,browser.earthlyBranchOfSoulPalace);assert.equal(data.bodyPalaceZhi,browser.earthlyBranchOfBodyPalace);
 }
});
