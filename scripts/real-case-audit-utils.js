'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files=['bazi.js','bazi-chain.js','structural.js','deep-report.js'];
async function engine(live=false, options={}) {
  const context={console,Date,Math,setTimeout,clearTimeout};context.window=context;vm.createContext(context);const hashes={};
  for(const file of files) {
    let source;
    if(live){const response=await fetch('https://zhishi.online/js/'+file+(options.cacheTag?'?v='+encodeURIComponent(options.cacheTag):''),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('engine HTTP '+response.status);source=Buffer.from(await response.arrayBuffer()).toString('utf8');}
    else source=fs.readFileSync(path.join(root,'js',file),'utf8');
    hashes[file]=crypto.createHash('sha256').update(source).digest('hex');vm.runInContext(source,context,{filename:file,timeout:10000});
  }
  return {context,hashes,calculator:context.BaZiCalculator,chain:context.BaZiChain,structural:context.StructuralAnalysis,report:context.DeepReport};
}
function birth(caseData) {
  const b=caseData.birth||{},date=/^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date||''),time=/^(\d{2}):(\d{2})(?::[0-5]\d(?:\.\d+)?)?$/.exec(b.trueSolarClock||b.clock||'');
  if(!date||!time)return null;
  const clock=Number(time[1]),minute=Number(time[2]);
  return {year:Number(date[1]),month:Number(date[2]),day:Number(date[3]),hour:Math.floor(((clock+1)%24)/2),clock,minute};
}
function chartFor(e,c) {
  const raw=Object.fromEntries(['year','month','day','hour'].map((pos,i)=>[pos,{gan:c.pillars[i][0],zhi:c.pillars[i][1]}]));
  return e.calculator.buildFromPillars(raw,c.gender,birth(c));
}
function payload(e,c,year,runId) {
  const calc=e.calculator,chart=chartFor(e,c),date=birth(c);
  const chartData={type:'bazi',birthInfo:{gender:c.gender,mode:'pillars',...(date||{}),...(c.birthYear?{year:c.birthYear}:{})},fourPillars:{},dayMaster:{gan:chart.day.gan,wuXing:chart.day.wuXing.gan},wuXingCount:chart.wuXingCount};
  for(const pos of ['year','month','day','hour']) {const p=chart[pos];chartData.fourPillars[pos]={gan:p.gan,zhi:p.zhi,ganWX:p.wuXing.gan,zhiWX:p.wuXing.zhi,shiShenGan:p.shiShen.gan,shiShenZhi:p.shiShen.zhi,cangGan:p.cangGan.map(gan=>({gan,shiShen:calc.getShiShen(chart.day.gan,gan)}))};}
  chartData.dayMasterStrength=calc.calcDayMasterStrength(chart);chartData.yongJi=calc.getYongJi(chart);chartData.pattern=chartData.yongJi.resolvedPattern||calc.getPattern(chart);
  chartData.parentAnalysis=calc.analyzeParents(chart,c.gender);chartData.dayBranchAnalysis=calc.analyzeDayBranch(chart);chartData.chainAnalysis=e.chain.analyze(chart);
  chartData.daYun={cycles:(c.cycles||[]).map(({gan,zhi,startYear,endYear})=>({gan,zhi,startYear,endYear}))};
  return {question:'回看'+year+'年，请判断当年最突出的具体事件，最多两件，先说事情再说依据。不要把压力大、付出多、事情有变化当成事件，也不要列多种备选让我挑。',chartData,mode:'simple',chat_type:'bazi',chart_key:'case-audit-'+runId+'-'+c.id+'-'+year,history:[]};
}
function reportFor(e,c,year) {
  const chart=chartFor(e,c),calculator=Object.assign({},e.calculator);
  // Source cycles are independent input; never fabricate a birthday to unlock timing.
  if(c.cycles?.length)calculator.calculateDaYun=()=>({list:c.cycles});
  return e.report.buildFacts(chart,c.gender,{anchorYear:year,currentYear:year,lifeContext:{status:'unknown'},deps:{calculator,chain:e.chain,structural:e.structural}});
}
module.exports={engine,birth,chartFor,payload,reportFor};
