const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),root=path.join(__dirname,'..'),Report=require('../js/deep-report.js');
const engine={window:{},console};vm.createContext(engine);
for(const f of ['bazi.js','structural.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),engine);
const calc=engine.window.BaZiCalculator,deps={calculator:calc,structural:engine.window.StructuralAnalysis,chain:engine.window.BaZiChain};
function build(year,status){const b=calc.calculate(year,6,15,6,'male',12);return Report.buildFacts(b,'male',{anchorYear:2026,currentYear:2026,lifeContext:{status},deps});}
function visible(n){return n?JSON.stringify([n.headline,n.painPoint,n.paragraphs,(n.verdicts||[]).map(v=>[v.title,v.outcomeText]),(n.years||[]).map(y=>y.summary)]):'';}
test('life stage uses explicit status over age and does not invent schooling for an unknown adult',()=>{
 assert.equal(Report.resolveLifeContext({status:'working'},2006,2026).studyRelevant,false);
 assert.equal(Report.resolveLifeContext({status:'student'},1986,2026).studyRelevant,true);
 assert.equal(Report.resolveLifeContext({status:'exam'},1996,2026).studyRelevant,true);
 assert.equal(Report.resolveLifeContext({},2012,2026).studyRelevant,true);
 assert.equal(Report.resolveLifeContext({},2006,2026).studyRelevant,false);
 assert.equal(Report.resolveLifeContext({},null,2026).age,null);
 assert.equal(Report.resolveLifeContext({status:'forged'},2000,2026).status,'unknown');
});
test('working and retired reports remove future study domains and chapter without changing frozen core or A grade',()=>{
 for(const year of [1960,1986,2006]){
  const baseline=build(year,'student');
  for(const status of ['working','transition','retired']){
   const f=build(year,status);
   assert.equal(f.study.relevant,false);assert.equal(f.study.narrative,null);
   assert.equal(JSON.stringify(f.core),JSON.stringify(baseline.core));
   assert.equal(f.wealth.narrative.headline,baseline.wealth.narrative.headline);
   for(const row of f.fiveYear.years){
    assert.ok(!row.eventAdjudication.domainRecords.some(r=>r.domain==='study'));
    assert.ok(!row.interactions.some(r=>(r.domains||[]).includes('study')));
   }
   assert.doesNotMatch(visible(f.currentYear.narrative)+visible(f.fiveYear.narrative),/考试[^。]{0,30}(出成绩|遇到阻力|更容易|主要变量)|升学或证照|学费、培训/);
  }
 }
});
test('older students and exam candidates retain study while a young graduate does not',()=>{
 for(const status of ['student','exam']){const f=build(1986,status);assert.ok(f.study.narrative);assert.ok(f.study.relevant);}
 assert.equal(build(2006,'working').currentYear.eventAdjudication.lifeStage.key,'launch');
});
function client(){
 const nodes={},storage=new Map(),node=id=>nodes[id]||(nodes[id]={innerHTML:'',value:'unknown',disabled:false,style:{},classList:{add(){},remove(){}},appendChild(){}});
 const box={window:null,document:{readyState:'loading',addEventListener(){},getElementById:node,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}},appendChild(){}},createElement(){return {set textContent(v){this.innerHTML=String(v);}};}},console,URLSearchParams,location:{search:'?year=2006'},Date,Promise,setTimeout(){},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Auth:{getToken:()=>'',getUser:()=>null},ChatPersistence:{chartIdentity:()=> 'synthetic'},ZhishiAIContext:{buildChartData:()=>({birthInfo:{year:2006}})},DeepReport:Report};
 box.window=box;vm.runInNewContext(fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8'),box);return {box,node,storage};
}
test('paid preflight opens before report, duplicate unlocks do not reopen, and explicit skip carries status',()=>{
 const {box,node}=client();let count=0;
 assert.equal(box.ZhishiCalibration.beforeReport(()=>count++),false);
 node('reportLifeStatus').value='working';
 const html=node('calibrationBody').innerHTML;
 assert.equal(box.ZhishiCalibration.beforeReport(()=>count++),false);assert.equal(node('calibrationBody').innerHTML,html);
 node('reportLifeSkip').onclick();assert.equal(count,1);
 assert.equal(box.ZhishiCalibration.beforeReport(()=>count++),true);assert.equal(count,1);
 assert.equal(box.ZhishiCalibration.reportContext().status,'working');
 assert.equal(box.ZhishiCalibration.beforeReport(()=>count++,true),false);
});
test('changing account never completes an earlier account preflight',()=>{
 const {box,node}=client();let count=0;box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:'a'});
 box.ZhishiCalibration.beforeReport(()=>count++);node('reportLifeStatus').value='working';
 box.Auth.getUser=()=>({id:'b'});node('reportLifeSkip').onclick();assert.equal(count,0);
 assert.equal(box.ZhishiCalibration.beforeReport(()=>count++),false);
});
test('missing past years have an explicit continuation rather than a blocked paid report',()=>{
 const {box,node}=client();let count=0;box.ZhishiCalibration.beforeReport(()=>count++);
 node('reportLifeNext').onclick();assert.match(node('calibrationBody').innerHTML,/没有可定位/);
 node('calibrationContinue').onclick();assert.equal(count,1);
});
test('negative matched feedback withdraws the selected annual interpretation while retaining the original record',()=>{
 const f=build(1986,'working'),row=f.currentYear,record=row.eventAdjudication.primaryEvent;
 record.hasIndependentAnnualTrigger=true;
 const original=record.eventCandidate;
 Report.applyReportReview(f,{adjustments:[{year:2026,domain:record.domain,state:'deprioritized',outcome:'往事反馈不支持这一解释，本年降低其优先级。'}]});
 assert.match(visible(f.currentYear.narrative),/原解释与已答经历不符/);
 assert.notEqual(row.eventAdjudication.primaryEvent&&row.eventAdjudication.primaryEvent.domain,record.domain);
 assert.equal(record.eventCandidate,original);
 assert.doesNotMatch(f.currentYear.narrative.verdicts.find(v=>v.title==='结合往事反馈看今年').outcomeText,/最值得优先/);
});


test('unknown status advances age per future year instead of freezing the school stage',()=>{
 const f=build(2010,'unknown');
 assert.equal(f.currentYear.lifeContext.age,16);assert.equal(f.currentYear.lifeContext.studyRelevant,true);
 const last=f.fiveYear.years[4];assert.equal(last.lifeContext.age,20);assert.equal(last.lifeContext.studyRelevant,false);
 assert.ok(!last.eventAdjudication.domainRecords.some(r=>r.domain==='study'));
});
test('completed preflight is remembered within this browser session, scoped to chart and account',()=>{
 const {box,node,storage}=client();box.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 box.ZhishiCalibration.beforeReport(()=>{});node('reportLifeStatus').value='working';node('reportLifeSkip').onclick();
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8'),box);
 assert.equal(box.ZhishiCalibration.beforeReport(()=>assert.fail('must not reopen')),true);
 assert.equal(box.ZhishiCalibration.reportContext().status,'working');
 box.ChatPersistence.chartIdentity=()=> 'another-synthetic-chart';assert.equal(box.ZhishiCalibration.beforeReport(()=>{}),false);
});
test('an unavailable history read provides a continuation without losing paid access',async()=>{
 const {box,node}=client();box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:'a'});
 box.fetch=()=>Promise.reject(new Error('Synthetic offline'));let ready=0;
 box.ZhishiCalibration.beforeReport(()=>ready++);node('reportLifeNext').onclick();
 await new Promise(setImmediate);assert.match(node('calibrationBody').innerHTML,/Synthetic offline/);
 node('calibrationContinue').onclick();assert.equal(ready,1);
});
test('skipping an in-flight history request prevents a late response reopening the questionnaire',async()=>{
 const {box,node}=client();box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:'a'});
 let resolve;box.fetch=()=>new Promise(r=>resolve=r);let ready=0;
 box.ZhishiCalibration.beforeReport(()=>ready++);node('reportLifeNext').onclick();node('reportLifeSkip').onclick();
 resolve({ok:true,json:async()=>({ready:true,events:[{event_key:'late',event_year:2024,prompt:'Late response',evidence:[]}]})});
 await new Promise(setImmediate);assert.equal(ready,1);assert.doesNotMatch(node('calibrationBody').innerHTML,/Late response/);
});
