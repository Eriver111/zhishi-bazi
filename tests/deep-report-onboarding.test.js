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
   assert.equal(f.wealth.narrative.grade,baseline.wealth.narrative.grade);
   assert.deepEqual(f.wealth.resource,baseline.wealth.resource);
   assert.notEqual(f.wealth.narrative.headline,baseline.wealth.narrative.headline);
   assert.match(baseline.wealth.narrative.headline,/在读/);
   assert.doesNotMatch(f.wealth.narrative.headline,/在读期间/);
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
 const withdrawn=f.currentYear.narrative.verdicts.find(v=>v.title==='本轮修正');
 assert.ok(withdrawn&&withdrawn.detailOnly);
 assert.match(withdrawn.outcomeText,/与已答经历不符.*不再列为重点/);
 assert.notEqual(row.eventAdjudication.primaryEvent&&row.eventAdjudication.primaryEvent.domain,record.domain);
 assert.equal(record.eventCandidate,original);
 assert.ok(f.currentYear.narrative.verdicts.filter(v=>!v.detailOnly).every(v=>!v.basis.includes('ANNUAL_EVENT:'+record.domain)));
});


test('unknown status advances age per future year instead of freezing the school stage',()=>{
 const f=build(2010,'unknown');
 assert.equal(f.currentYear.lifeContext.age,16);assert.equal(f.currentYear.lifeContext.studyRelevant,true);
 const last=f.fiveYear.years[4];assert.equal(last.lifeContext.age,20);assert.equal(last.lifeContext.studyRelevant,false);
 // Adult unknown status is not proof that schooling ended. Only independently
 // triggered study evidence remains, and its reading stays conditional.
 const study=last.eventAdjudication.domainRecords.filter(r=>r.domain==='study');
 assert.ok(study.every(r=>r.hasIndependentAnnualTrigger));
 study.forEach(r=>assert.match(Report.__test.describeTimingEvent(r,last.eventAdjudication,last.lifeContext,last).scenario,/若当时在读或备考/));
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

test('optional priorities are labelled, skippable, de-duplicated and never persisted with life status',()=>{
 const {box,node,storage}=client();let ready=0;
 box.ZhishiCalibration.beforeReport(()=>ready++);
 const html=node('calibrationBody').innerHTML;
 assert.match(html,/最多两项/);assert.match(html,/完整报告内容不减少/);
 for(const id of ['reportPriority0','reportPriority1'])assert.match(html,new RegExp('label for="'+id+'"'));
 for(const priority of ['wealth','relationship','career','study','family'])assert.match(html,new RegExp('value="'+priority+'"'));
 node('reportLifeStatus').value='working';node('reportPriority0').value='wealth';node('reportPriority1').value='wealth';
 node('reportLifeSkip').onclick();assert.equal(ready,1);
 assert.deepEqual(Array.from(box.ZhishiCalibration.reportContext().priorities),['wealth']);
 assert.deepEqual(JSON.parse(storage.get('zhishi_report_life_v1:guest:synthetic')),{status:'working'});
 assert.equal(box.ZhishiCalibration.reportContext().relationshipStatus,'unknown');
});

test('both empty preferences can skip immediately without reducing report access',()=>{
 const {box,node}=client();let ready=0;
 box.ZhishiCalibration.beforeReport(()=>ready++);node('reportPriority0').value='';node('reportPriority1').value='';
 node('reportLifeSkip').onclick();node('reportLifeSkip').onclick();
 assert.equal(ready,1);assert.equal(box.ZhishiCalibration.beforeReport(()=>assert.fail('already ready')),true);
 assert.deepEqual(Array.from(box.ZhishiCalibration.reportContext().priorities),[]);
});

test('public context updates accept only allowlisted fields and do not finish a pending preflight',()=>{
 const {box,node,storage}=client();const api=box.ZhishiCalibration;let ready=0;
 assert.equal(api.updateReportContext({priorities:['wealth']}),false);
 api.beforeReport(()=>ready++);
 assert.equal(api.updateReportContext({priorities:['invalid','relationship','wealth','career','relationship'],relationshipStatus:'dating',status:'working',done:true,pending:false,scope:'other'}),true);
 const context=api.reportContext();
 assert.deepEqual(Array.from(context.priorities),['relationship','wealth']);assert.equal(context.relationshipStatus,'dating');assert.equal(context.status,'unknown');
 assert.equal(api.reportPending(),true);assert.equal(ready,0);assert.equal(storage.size,0);
 assert.equal(api.updateReportContext({done:true,status:'retired'}),false);
 assert.equal(api.updateReportContext(null),false);assert.equal(api.updateReportContext([]),false);
 node('reportLifeSkip').onclick();assert.equal(ready,1);
});

test('bad optional values normalize to empty choices and cannot inject arbitrary context fields',()=>{
 const {box}=client();const api=box.ZhishiCalibration;api.beforeReport(()=>{});
 api.updateReportContext({priorities:'wealth',relationshipStatus:'<script>bad</script>'});
 let context=api.reportContext();assert.deepEqual(Array.from(context.priorities),[]);assert.equal(context.relationshipStatus,'unknown');
 api.updateReportContext({priorities:['family',{},'family','__proto__','study','wealth'],relationshipStatus:'other'});
 context=api.reportContext();assert.deepEqual(Array.from(context.priorities),['family','study']);assert.equal(context.relationshipStatus,'other');
 assert.deepEqual(Object.keys(context).sort(),['priorities','relationshipStatus','status']);
});

test('caller-owned patches and returned context objects cannot mutate stored report preferences',()=>{
 const {box}=client();const api=box.ZhishiCalibration;api.beforeReport(()=>{});
 const patch={priorities:['career'],relationshipStatus:'single'};api.updateReportContext(patch);
 patch.priorities.push('wealth');patch.relationshipStatus='married';
 const context=api.reportContext();context.priorities.push('family');context.relationshipStatus='other';context.status='retired';
 const actual=api.reportContext();assert.deepEqual(Array.from(actual.priorities),['career']);assert.equal(actual.relationshipStatus,'single');assert.equal(actual.status,'unknown');
});

test('force reopening keeps only this page session preferences and persists only status after capture',()=>{
 const {box,node,storage}=client();const api=box.ZhishiCalibration;
 api.beforeReport(()=>{});node('reportLifeStatus').value='working';node('reportPriority0').value='career';node('reportPriority1').value='relationship';node('reportLifeSkip').onclick();
 api.updateReportContext({relationshipStatus:'married'});
 assert.equal(api.beforeReport(()=>{},true),false);
 assert.deepEqual(Array.from(api.reportContext().priorities),['career','relationship']);assert.equal(api.reportContext().relationshipStatus,'married');
 const html=node('calibrationBody').innerHTML;assert.match(html,/<option value="career" selected/);assert.match(html,/<option value="relationship" selected/);
 node('reportLifeSkip').onclick();assert.equal(api.reportContext().relationshipStatus,'married');
 assert.deepEqual(JSON.parse(storage.get('zhishi_report_life_v1:guest:synthetic')),{status:'working'});
});

test('old account skip and next callbacks cannot save status, preferences or open history under a new account',()=>{
 const {box,node,storage}=client();let ready=0,opened=0;box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:'a'});
 box.ZhishiCalibration.beforeReport(()=>ready++);const skip=node('reportLifeSkip').onclick,next=node('reportLifeNext').onclick;
 box.Auth.getUser=()=>({id:'b'});box.ZhishiCalibration.beforeReport(()=>ready++);
 box.ZhishiCalibration.open=()=>opened++;node('reportLifeStatus').value='retired';node('reportPriority0').value='family';node('reportPriority1').value='wealth';
 skip();next.call({disabled:false});assert.equal(ready,0);assert.equal(opened,0);assert.equal(storage.size,0);
 assert.deepEqual(Array.from(box.ZhishiCalibration.reportContext().priorities),[]);
 assert.equal(box.ZhishiCalibration.updateReportContext({priorities:['wealth'],relationshipStatus:'dating'}),true);
 box.Auth.getUser=()=>({id:'a'});assert.deepEqual(Array.from(box.ZhishiCalibration.reportContext().priorities),[]);assert.equal(box.ZhishiCalibration.reportContext().relationshipStatus,'unknown');
});

test('account and chart scopes keep optional report preferences isolated and unresolved identities cannot update',()=>{
 const {box}=client();const api=box.ZhishiCalibration;box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:'a'});
 api.beforeReport(()=>{});api.updateReportContext({priorities:['family'],relationshipStatus:'married'});
 box.ChatPersistence.chartIdentity=()=> 'second-chart';assert.equal(api.updateReportContext({priorities:['wealth']}),false);api.beforeReport(()=>{});
 assert.deepEqual(Array.from(api.reportContext().priorities),[]);api.updateReportContext({priorities:['career'],relationshipStatus:'single'});
 box.ChatPersistence.chartIdentity=()=> 'synthetic';assert.deepEqual(Array.from(api.reportContext().priorities),['family']);assert.equal(api.reportContext().relationshipStatus,'married');
 box.Auth.getUser=()=>null;assert.equal(api.updateReportContext({relationshipStatus:'dating'}),false);assert.deepEqual(Array.from(api.reportContext().priorities),[]);assert.equal(api.reportContext().relationshipStatus,'unknown');
});

test('legacy storage and page reload restore status but never optional priorities or relationship status',()=>{
 const {box,node,storage}=client();storage.set('zhishi_report_life_v1:guest:synthetic',JSON.stringify({status:'working',priorities:['family'],relationshipStatus:'married'}));
 assert.equal(box.ZhishiCalibration.reportContext().status,'working');assert.deepEqual(Array.from(box.ZhishiCalibration.reportContext().priorities),[]);assert.equal(box.ZhishiCalibration.reportContext().relationshipStatus,'unknown');
 box.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 box.ZhishiCalibration.beforeReport(()=>{});node('reportLifeStatus').value='working';node('reportPriority0').value='wealth';node('reportPriority1').value='relationship';node('reportLifeSkip').onclick();
 box.ZhishiCalibration.updateReportContext({relationshipStatus:'dating'});
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8'),box);
 assert.equal(box.ZhishiCalibration.beforeReport(()=>assert.fail('status session is ready')),true);
 const restored=box.ZhishiCalibration.reportContext();assert.equal(restored.status,'working');assert.deepEqual(Array.from(restored.priorities),[]);assert.equal(restored.relationshipStatus,'unknown');
});

test('optional report context is absent from AI summary and causes no network or persistent writes',()=>{
 const {box,storage}=client();const api=box.ZhishiCalibration;box.fetch=()=>assert.fail('report preferences must not be sent');
 api.beforeReport(()=>{});const initial=JSON.stringify(api.summary());
 api.updateReportContext({priorities:['wealth','family'],relationshipStatus:'married'});
 assert.equal(JSON.stringify(api.summary()),initial);assert.equal(storage.size,0);
});

for(const switchKind of ['account','chart'])test('switching '+switchKind+' A → B → A reopens unfinished preflight and invalidates every replaced callback',()=>{
 const {box,node,storage}=client();const api=box.ZhishiCalibration;let current='a',readyA=0,readyB=0,newReadyA=0,opened=0;
 box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:switchKind==='account'?current:'owner'});
 box.ChatPersistence.chartIdentity=()=>switchKind==='chart'?current:'synthetic';
 api.beforeReport(()=>readyA++);api.updateReportContext({priorities:['family'],relationshipStatus:'married'});
 const oldASkip=node('reportLifeSkip').onclick,oldANext=node('reportLifeNext').onclick;
 current='b';api.beforeReport(()=>readyB++);api.updateReportContext({priorities:['career'],relationshipStatus:'single'});
 const oldBSkip=node('reportLifeSkip').onclick,oldBNext=node('reportLifeNext').onclick;
 current='a';assert.equal(api.beforeReport(()=>newReadyA++),false);
 assert.notEqual(node('reportLifeSkip').onclick,oldASkip);
 assert.deepEqual(Array.from(api.reportContext().priorities),['family']);assert.equal(api.reportContext().relationshipStatus,'married');
 box.ZhishiCalibration.open=()=>opened++;node('reportLifeStatus').value='working';node('reportPriority0').value='wealth';node('reportPriority1').value='relationship';
 oldASkip();oldANext.call({disabled:false});oldBSkip();oldBNext.call({disabled:false});
 assert.equal(readyA+readyB+newReadyA,0);assert.equal(opened,0);assert.equal(storage.size,0);assert.equal(api.reportPending(),true);
 node('reportLifeSkip').onclick();assert.equal(newReadyA,1);assert.equal(readyA+readyB,0);assert.equal(api.reportPending(),false);
 assert.deepEqual(Array.from(api.reportContext().priorities),['wealth','relationship']);
 current='b';assert.equal(api.beforeReport(()=>readyB++),false);
 assert.deepEqual(Array.from(api.reportContext().priorities),['career']);assert.equal(api.reportContext().relationshipStatus,'single');
 node('reportLifeStatus').value='retired';node('reportPriority0').value='career';node('reportPriority1').value='';node('reportLifeSkip').onclick();assert.equal(readyB,1);
 current='a';assert.equal(api.beforeReport(()=>assert.fail('completed A must stay ready')),true);assert.equal(api.reportContext().status,'working');
});

test('an old history response cannot revive after switching A → B → A to a fresh preflight',async()=>{
 const {box,node}=client();const api=box.ZhishiCalibration;let current='a',resolveOld,ready=0;
 box.Auth.getToken=()=> 'synthetic-token';box.Auth.getUser=()=>({id:current});box.fetch=()=>new Promise(resolve=>resolveOld=resolve);
 api.beforeReport(()=>assert.fail('replaced A request must not complete'));node('reportLifeStatus').value='working';node('reportPriority0').value='family';node('reportPriority1').value='';node('reportLifeNext').onclick();
 current='b';api.beforeReport(()=>{});current='a';assert.equal(api.beforeReport(()=>ready++),false);
 const newHtml=node('calibrationBody').innerHTML;
 resolveOld({ok:true,json:async()=>({ready:true,events:[{event_key:'old-account-request',event_year:2024,prompt:'A旧请求返回的题目',evidence:[]}]})});
 await new Promise(setImmediate);assert.equal(node('calibrationBody').innerHTML,newHtml);assert.equal(ready,0);assert.equal(api.reportPending(),true);
 node('reportLifeSkip').onclick();assert.equal(ready,1);
});

test('a stale error continuation neither closes nor completes the current account preflight',()=>{
 const {box,node}=client();const api=box.ZhishiCalibration;let current='a',ready=0;
 box.Auth.getUser=()=>({id:current});
 api.beforeReport(()=>assert.fail('old account must not complete'));node('reportLifeNext').onclick();const oldContinue=node('calibrationContinue').onclick;
 current='b';api.beforeReport(()=>ready++);let closed=0;node('calibrationShell').classList.remove=()=>closed++;
 const body=node('calibrationBody').innerHTML;oldContinue();
 assert.equal(closed,0);assert.equal(ready,0);assert.equal(node('calibrationBody').innerHTML,body);assert.equal(api.reportPending(),true);
 node('reportLifeSkip').onclick();assert.equal(ready,1);
});

test('a repeated month branch without family disruption does not ask about a mother bodily condition',()=>{
 const {box}=client();
 const source=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8');
 vm.runInNewContext(source.replace('})(window);','window.__privacyPrompt={predictedPrompt:predictedPrompt,hasFamilyDisruption:hasFamilyDisruption,competingOptions:competingOptions};})(window);'),box);
 const analysis={triggers:[{type:'地支重复',target:'month',detail:'流年地支与月支重复'}],eventAdjudication:{domainRecords:[{domain:'family',direction:'条件性',hasIndependentAnnualTrigger:true}]}};
 assert.equal(box.__privacyPrompt.hasFamilyDisruption(analysis),false);
 const prompt=box.__privacyPrompt.predictedPrompt('family',analysis,30,'正印',{target:'mother',direction:'neutral'});
 assert.match(prompt,/母亲.*生活|母亲.*责任/);assert.doesNotMatch(prompt,/身体|疾病|健康|医院|部位/);
 const disrupted={triggers:[{type:'六冲',target:'month',detail:'流年冲月支'}],eventAdjudication:{domainRecords:[{domain:'family',direction:'偏不利',hasIndependentAnnualTrigger:true}]}};
 assert.equal(box.__privacyPrompt.hasFamilyDisruption(disrupted),true);
 const options=box.__privacyPrompt.competingOptions('family',disrupted,30,'正印',null);
 assert.ok(options.some(option=>(option.followup_options||[]).some(detail=>detail.key==='family_condition')));
});

test('event questions collect structured choices and years without soliciting private narratives',()=>{
 const {box,node,storage}=client();box.document.querySelector=()=>null;
 const source=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8');
 vm.runInNewContext(source.replace('})(window);','window.__privacyUI={renderEvents:renderEvents,saveAnswer:saveAnswer};})(window);'),box);
 const events=[{event_key:'structured',event_year:2024,prompt:'家庭安排变化',options:[{key:'family:test',label:'家人身体状况变化',detail:'家庭安排随之改变',followup_options:[]}],note:'SYNTHETIC_PRIVATE_DETAIL',answer:'yes',selected_option:'family:test'}, {event_key:'legacy',event_year:2022,prompt:'过去的事件',answer:'yes',note:'SYNTHETIC_PRIVATE_DETAIL'}];
 box.__privacyUI.renderEvents('synthetic',events,()=>{});
 assert.doesNotMatch(node('calibrationBody').innerHTML,/<input|textarea|SYNTHETIC_PRIVATE_DETAIL|补充真实情况|补充发生了什么/);
 assert.match(node('calibrationBody').innerHTML,/保存年份/);
 storage.set('zhishi_calibration_data:synthetic',JSON.stringify(events));
 const attrs={'data-event':'structured','data-selected-option':'family:test','data-match-level':'exact'},followup={querySelector(selector){if(selector==='select')return {value:'2024'};throw Error('Must not read private text');}};
 const card={classList:{contains:()=>true},getAttribute:key=>attrs[key],setAttribute(key,value){attrs[key]=value;},querySelectorAll:()=>[],querySelector:()=>followup};
 box.__privacyUI.saveAnswer('synthetic',card,'yes');
 const saved=JSON.parse(storage.get('zhishi_calibration_data:synthetic'));
 assert.equal(saved[0].actual_year,2024);assert.equal(saved[0].note,'');assert.equal(saved[1].note,'SYNTHETIC_PRIVATE_DETAIL');
});
