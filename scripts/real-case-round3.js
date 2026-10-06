'use strict';
// Inputs contain no event labels. Persist predictions before opening feedback.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { engine, payload, chartFor, birth, reportFor } = require('./real-case-audit-utils');
const { renderFacts } = require('./real-case-report-render');
const root = path.resolve(__dirname, '..');
function cleanInput(c) {
  if (!c.id || !Array.isArray(c.pillars) || c.pillars.length !== 4 || !['male','female'].includes(c.gender)) throw new Error('Incomplete case input');
  return { id:c.id, pillars:c.pillars, gender:c.gender, birthYear:c.birthYear,
    birth:c.birth ? { date:c.birth.date, clock:c.birth.clock, trueSolarClock:c.birth.trueSolarClock } : null,
    cycles:(c.cycles || []).map(({gan,zhi,ganZhi,startYear,endYear}) => ({gan:gan || ganZhi?.[0],zhi:zhi || ganZhi?.[1],startYear,endYear})) };
}
async function applyEmptyReview(e,c,chart,facts,year) {
  const context=e.context, code=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8');
  e.hashes['chart-calibration.js']=crypto.createHash('sha256').update(code).digest('hex');
  const originalDate=context.Date;
  context.Date=class extends Date { constructor(...args){super(...(args.length?args:[Date.UTC(year,6,1)]));} static now(){return Date.UTC(year,6,1);} };
  context.document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  context.localStorage={getItem(){return null;},setItem(){throw new Error('No storage writes in report audit');}};
  context.fetch=()=>{throw new Error('No network in report review audit');};
  context.URLSearchParams=URLSearchParams;context.location={search:'?year='+(c.birthYear||birth(c)?.year||'')};
  context._bazi=chart;
  context.ZhishiAIContext={buildChartData:()=>payload(e,c,year,'offline').chartData};
  context.ChatPersistence={chartIdentity:()=>c.id};
  try {
    vm.runInContext(code,context,{filename:'chart-calibration.js'});
    const review=await context.ZhishiCalibration.getReportReview(facts);
    e.report.applyReportReview(facts,review);
    return review;
  } finally {context.Date=originalDate;}
}
async function main(options = {}) {
  const dir = path.resolve(root, options.outputDirectory || 'audits/real-cases/2026-10-06-round3');
  if (!dir.startsWith(path.join(root, 'audits', 'real-cases') + path.sep)) throw new Error('Audit output must remain in audits/real-cases');
  const [mode, sourceFile, sessionFile, filter, yearFilter] = options.args || process.argv.slice(2);
  if (!['ai','report'].includes(mode) || !sourceFile) throw new Error('Usage: real-case-round3.js ai|report blind-inputs.json [test-session.json]');
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const cases = (Array.isArray(source) ? source : source.cases).filter(c=>!filter || filter.split(',').includes(c.id));
  const live = mode === 'ai', e = await engine(live, {cacheTag:options.releaseCommit});
  if (options.expectedHashes) for (const [file,hash] of Object.entries(e.hashes)) {
    if (options.expectedHashes[file] !== hash) throw new Error('Release engine mismatch: '+file);
  }
  if (live && options.expectedPolicy) {
    const probe=await fetch('https://zhishi.online/api/ai-chat',{method:'OPTIONS',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (probe.headers.get('x-zhishi-ai-policy') !== options.expectedPolicy) throw new Error('Release API policy mismatch; no AI request sent');
  }
  if (!live) for (const file of ['report-imagery.js','calibration-model.js']) {
    const code=fs.readFileSync(path.join(root,'js',file),'utf8');
    e.hashes[file]=crypto.createHash('sha256').update(code).digest('hex');
    vm.runInContext(code,e.context,{filename:file});
  }
  const runId = new Date().toISOString().replace(/[^0-9]/g, '');
  const output = { runId, mode:live ? (options.expectedPolicy ? 'production-post-release' : 'production-api-baseline') : 'local-actual-report',
    releaseCommit:options.releaseCommit||null,expectedPolicy:options.expectedPolicy||null,
    modelInputExcludesFeedback:true, independentEventVerification:false, hashes:e.hashes, results:[] };
  fs.mkdirSync(dir, {recursive:true});
  const target = path.join(dir, mode+'-'+runId+'.json');
  const session = live ? JSON.parse(fs.readFileSync(sessionFile, 'utf8')) : null;
  if (!live) output.hashes['result.js'] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/result.js'))).digest('hex');
  let requests = 0;
  for (const raw of cases) {
    const c = cleanInput(raw);
    for (const year of raw.probeYears || raw.targetYears || raw.auditYears || [raw.probeYear || raw.blindProbeYear]) {
      if (yearFilter && !yearFilter.split(',').map(Number).includes(year)) continue;
      if (!Number.isInteger(year) || c.cycles.filter(d=>year>=d.startYear && year<=d.endYear).length !== 1) throw new Error(c.id+': missing or ambiguous source cycle at '+year);
      if (live) {
        if (requests++) await new Promise(resolve=>setTimeout(resolve,11000));
        const request = payload(e,c,year,runId), start = Date.now();
        try {
          const response = await fetch('https://zhishi.online/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
          const data = await response.json(),policy=response.headers.get('x-zhishi-ai-policy');
          output.results.push({id:c.id,year,input:c,question:request.question,chartKey:request.chart_key,
            httpStatus:response.status,policy,elapsedMs:Date.now()-start,reply:data.reply||null,error:data.error||null});
          console.log(JSON.stringify({id:c.id,year,httpStatus:response.status,length:(data.reply||'').length}));
          if (options.expectedPolicy && policy !== options.expectedPolicy) { output.stoppedReason='release changed during test'; fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n'); console.log(target); return; }
          if ([401,403,429].includes(response.status)) { output.stoppedReason='authentication or rate limit; no bypass'; fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n'); console.log(target); return; }
        } catch(error) {
          output.results.push({id:c.id,year,error:error.message});
          console.log(JSON.stringify({id:c.id,year,error:error.message}));
        }
      } else {
        const chart = chartFor(e,c), facts = reportFor(e,c,year);
        const beforeReviewNarrative=JSON.parse(JSON.stringify(facts.currentYear.narrative));
        const review=await applyEmptyReview(e,c,chart,facts,year),sections = renderFacts(facts,chart,c.gender);
        const cycle = c.cycles.find(d=>year>=d.startYear && year<=d.endYear);
        const index = ((year-4)%60+60)%60, gan='甲乙丙丁戊己庚辛壬癸'[index%10], zhi='子丑寅卯辰巳午未申酉戌亥'[index%12];
        const age = c.birthYear ? year-c.birthYear : birth(c) ? year-birth(c).year : null;
        const annual = e.chain.analyzeLiuNian(chart,cycle,{gan,zhi,year},e.calculator.getYongJi(chart),{age});
        const core=facts.core||{},analysis=Object.assign({},annual,{reportLifeContext:{status:'unknown',age,historical:true},reportMechanismContext:{chain:core.chain||e.chain.analyze(chart),yongJi:core.yongJi||e.calculator.getYongJi(chart),pattern:core.pattern||{},congGe:core.congGe}});
        const calibration=Object.fromEntries(['study','career','wealth','relationship','family','change'].map(domain=>[domain,e.context.ZhishiCalibrationModel.professionalCandidates(domain,analysis)]));
        const partial = !birth(c) || !facts.fiveYear.hasDaYun;
        output.results.push({id:c.id,year,input:c,partial,hasDaYun:facts.fiveYear.hasDaYun,
          grade:facts.wealth.narrative.grade,annual,calibration,review,beforeReviewNarrative,narrative:facts.currentYear.narrative,sections});
        const reportDir=path.join(dir,'rendered-reports');fs.mkdirSync(reportDir,{recursive:true});
        fs.writeFileSync(path.join(reportDir,c.id+'-'+year+'.html'),'<!doctype html><meta charset="utf-8"><title>'+c.id+'</title><style>body{max-width:900px;margin:auto;padding:24px;background:#f5eddf;line-height:1.8}section{background:#fffaf2;padding:24px;margin:20px 0}</style><h1>'+c.id+' · '+year+'</h1><p>离线实际报告。'+(partial?'缺少完整生日，大运仅在独立年度引擎审计中使用，报告是部分结果。':'已纳入来源大运。')+'</p>'+Object.values(sections).map(s=>'<section>'+s.html+'</section>').join(''));
        console.log(JSON.stringify({id:c.id,year,partial,primary:annual.eventAdjudication?.primaryEvent?.domain}));
      }
      fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');
    }
  }
  console.log(target);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={cleanInput,applyEmptyReview,main};
