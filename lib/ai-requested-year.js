'use strict';
// Reuse the browser rule engine for a requested year missing from a saved chat.
// Only trusted repository code is evaluated; no user text is executable.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let engine;
function runtime() {
  if (!engine) {
    const c = { console }; c.window = c; vm.createContext(c);
    for (const file of ['bazi.js','bazi-chain.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c,{filename:file,timeout:5000});
    engine = c;
  }
  return engine;
}
function enrichRequestedYear(data, year) {
  if (!data || (data.type && data.type !== 'bazi') || !Number.isInteger(year) || year < 1800 || year > 2199) return data;
  const pillars=data.fourPillars, cycles=data.daYun && data.daYun.cycles;
  const valid=p=>p && /^[甲乙丙丁戊己庚辛壬癸]$/.test(p.gan) && /^[子丑寅卯辰巳午未申酉戌亥]$/.test(p.zhi);
  if (!pillars || !['year','month','day','hour'].every(k=>valid(pillars[k])) || !Array.isArray(cycles)) return data;
  const matching=cycles.filter(d=>valid(d)&&Number.isInteger(Number(d.startYear))&&Number.isInteger(Number(d.endYear))&&year>=Number(d.startYear)&&year<=Number(d.endYear));
  if(matching.length!==1)return data; // Never guess a decade before/after the supplied range.
  const c=runtime(), dy=matching[0], chart={};
  for(const key of ['year','month','day','hour']) chart[key]={gan:pillars[key].gan,zhi:pillars[key].zhi};
  const yongJi=data.yongJi || c.BaZiCalculator.getYongJi(chart);
  const ln=(c.BaZiCalculator.calculateLiuNian(dy,chart.day.gan)||[]).find(x=>Number(x.year)===year);
  if(!ln)return data;
  const period=c.BaZiChain.analyzeFortune(chart,[dy],yongJi).periods[0];
  const birth=Number(data.birthInfo&&data.birthInfo.year);
  const age=Number.isInteger(birth)&&birth>0&&birth<=year ? year-birth : null;
  const annual=c.BaZiChain.analyzeLiuNian(chart,dy,ln,yongJi,{birthYear:age===null?null:birth,age,daYunPeriod:period});
  const fortuneAnalysis=data.fortuneAnalysis && Array.isArray(data.fortuneAnalysis.periods)
    ? {...data.fortuneAnalysis, periods:data.fortuneAnalysis.periods.map(p=>Number(p.startYear)===Number(dy.startYear)&&p.gan===dy.gan&&p.zhi===dy.zhi ? period : p)}
    : data.fortuneAnalysis;
  return {...data, fortuneAnalysis, timingAdjudication:{...data.timingAdjudication, requestedYear:{
    year,daYun:{gan:dy.gan,zhi:dy.zhi},liuNian:{gan:ln.gan,zhi:ln.zhi},
    adjudication:annual.eventAdjudication,overallVerdict:annual.verdict,
    annualStemInteractions:annual.annualStemInteractions,
    annualMechanismGraph:annual.annualMechanismGraph,
    overallSummary:annual.summary,verifiedScore:annual.verifiedScore,source:'shared-engine-requested-year'
  }}};
}
module.exports={enrichRequestedYear};

