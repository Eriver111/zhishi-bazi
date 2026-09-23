const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),model=require('../lib/calibration-model.js');
const option={key:'wealth:peer-loss',label:'合作支出',detail:'合作或人情使留存减少',domain:'wealth',manifestation:'loss',mechanism_key:'peer-wealth',evidence:['流年比劫作用'],followup_options:[{key:'borrow',label:'朋友借款'}]};
const event=(year,extra={})=>({event_key:'year:'+year,event_year:year,domain:'wealth',prompt:year+'年实际更接近哪项？',options:[option],answer:'yes',match_level:'exact',selected_option:option.key,...extra});
const future=(extra={})=>({...option,year:2027,hasIndependentAnnualTrigger:true,...extra});
const review=(events,candidates=[future()])=>model.buildReportReview(events,candidates,{currentYear:2026});

test('shared browser and server profiles are byte-for-byte equivalent',()=>{
  const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/calibration-model.js'),'utf8'),box);
  const events=[event(2021),event(2024)];
  assert.equal(JSON.stringify(box.window.ZhishiCalibrationModel.buildReportReview(events,[future()],{currentYear:2026})),JSON.stringify(review(events)));
});
test('repeating a record or actual year never upgrades it to repeated historical support',()=>{
  assert.equal(review([event(2024),event(2024)]).profile.patterns.length,0);
  const r=review([event(2023,{actual_year:2024}),event(2024)]);
  assert.equal(r.profile.patterns.length,0);assert.equal(r.profile.tentativePatterns[0].count,1);
  assert.equal(r.adjustments[0].state,'tentative');
});
test('different mechanisms with the same manifestation are not merged',()=>{
  const other={...option,mechanism_key:'other-path'};
  const r=review([event(2021),event(2024,{options:[other]})]);
  assert.equal(r.profile.patterns.length,0);assert.equal(r.profile.tentativePatterns.length,2);
});
test('contradictory feedback stays mixed and does not erase the original judgment',()=>{
  const input=[event(2021),event(2024,{answer:'no'})],f=[future()],before=JSON.stringify({input,f});
  const r=review(input,f);assert.equal(r.adjustments[0].state,'mixed');
  assert.equal(r.history[1].answer,'no');assert.equal(r.history[1].originalOptions[0],option.detail);
  assert.equal(r.adjustments[0].futureConfirmed,false);assert.equal(JSON.stringify({input,f}),before);
});
test('negative feedback lowers only the matching mechanism and domain',()=>{
  const r=review([event(2024,{answer:'no'})],[future(),future({domain:'family'}),future({mechanism_key:'different'})]);
  assert.equal(r.adjustments.length,1);assert.equal(r.adjustments[0].state,'deprioritized');
  assert.match(r.adjustments[0].outcome,/不因此排除整个领域/);
});
test('future adjustments require their own trigger and compatible manifestation',()=>{
  assert.equal(review([event(2021),event(2024)],[future({hasIndependentAnnualTrigger:false})]).adjustments.length,0);
  assert.equal(review([event(2021),event(2024)],[future({manifestation:'growth'})]).adjustments.length,0);
  assert.equal(review([event(2021),event(2024)]).adjustments[0].state,'repeated');
});
test('unknown, forged, and future answers do not become historical confirmation',()=>{
  const r=review([event(2027),event(2025,{actual_year:2026}),event(2024,{answer:'unsure'}),event(2023,{selected_detail:'forged'})]);
  assert.equal(r.answered,0);assert.equal(r.skipped,1);assert.equal(r.adjustments.length,0);
});
test('Chinese mechanism names remain distinct through normalization',()=>{
  const options=model.normalizeCalibrationOptions([{...option,mechanism_key:'parent-mother:六冲'},{...option,mechanism_key:'parent-mother:六合'}]);
  assert.notEqual(options[0].mechanism_key,options[1].mechanism_key);
});
function clientFixture({authenticated=false,stored=[],post}={}){
  const storage=new Map([['zhishi_calibration_data:chart-key',JSON.stringify(stored)]]),nodes={};
  const node=id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){}}});
  const document={readyState:'loading',body:{appendChild(){},classList:{add(){},remove(){}}},addEventListener(){},
    getElementById:node,querySelectorAll(){return [];},querySelector(){return null;},
    createElement(){return {set textContent(s){this.innerHTML=String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}};}};
  const box={window:null,document,console,URLSearchParams,location:{search:''},Promise,Date,setTimeout(){},alerts:[],
    alert(s){box.alerts.push(s);},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    Auth:{getToken:()=>authenticated?'mock-token':''},ChatPersistence:{chartIdentity:()=> 'chart-key'},
    ZhishiAIContext:{buildChartData:()=>({fourPillars:{},birthInfo:{}})},ZhishiCalibrationModel:model,
    fetch(url,opts){if(opts.method==='POST')return post(JSON.parse(opts.body));return Promise.resolve({ok:true,json:async()=>({ready:true,calibration:{candidate_version:'bazi-cal-v9'},events:stored})});}};
  box.window=box;
  let src=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8').replace('root.ZhishiCalibration.beforeAI = inspectFirstClick;','root.ZhishiCalibration.beforeAI = inspectFirstClick;root.__save=saveAnswer;');
  vm.runInNewContext(src,box);return {box,node,storage};
}
test('guest report opening reuses answers and returning to report invokes the callback',async()=>{
  const {box,node,storage}=clientFixture({stored:[event(2024)]});let done=0;
  box.ZhishiCalibration.open({finishLabel:'完成复核，返回报告',onComplete(){done++;}});
  assert.match(node('calibrationBody').innerHTML,/完成复核，返回报告/);
  node('calibrationFinish').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(done,1);assert.equal(JSON.parse(storage.get('zhishi_calibration_data:chart-key'))[0].answer,'yes');
  assert.equal((await box.ZhishiCalibration.getReportReview({})).answered,1);
});
test('report bridge uses the frozen annual trigger without recalculating or changing facts',async()=>{
  const picked=model.professionalCandidates('wealth',{triggers:[{type:'比肩夺财'}],reportLifeContext:{status:'unknown',age:34}})[0];
  const {box}=clientFixture({stored:[event(2021,{options:[picked],selected_option:picked.key}),event(2024,{options:[picked],selected_option:picked.key})]});
  box._bazi={day:{gan:'甲'}};
  box.ZhishiAIContext.buildChartData=()=>({fourPillars:{},birthInfo:{year:1990,gender:'male'}});
  box.BaZiCalculator={analyzeParents:()=>null,getShiShen:()=> '比肩'};
  box.BaZiChain={analyzeLiuNian(){throw Error('Must not recalculate');}};
  const facts={fiveYear:{years:[{year:2027,daYunStatus:'active',daYun:{gan:'甲',zhi:'子'},pillar:{gan:'丁',zhi:'未'},
    dynamic:{triggers:[{type:'比肩夺财',detail:'财星受比劫牵动',isGood:false}],eventAdjudication:{domainRecords:[{domain:'wealth',hasIndependentAnnualTrigger:true}]}}}]}};
  const before=JSON.stringify(facts),r=await box.ZhishiCalibration.getReportReview(facts);
  assert.equal(r.adjustments.length,1);assert.equal(r.adjustments[0].state,'repeated');assert.equal(JSON.stringify(facts),before);
  facts.fiveYear.years[0].dynamic.eventAdjudication.domainRecords[0].hasIndependentAnnualTrigger=false;
  assert.equal((await box.ZhishiCalibration.getReportReview(facts)).adjustments.length,0);
});
function legacyCard(){
  const attrs={'data-event':'year:2024'},followup={classList:{toggle(){}},querySelector(s){return s==='select'?{value:'2024'}:{value:''};}};
  return {classList:{contains:()=>false},getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,
    querySelectorAll:()=>[],querySelector:()=>followup};
}
test('completion waits for server saves and a failed save cannot claim completion',async()=>{
  let release;const pending=new Promise(resolve=>release=resolve);
  const {box,node}=clientFixture({authenticated:true,stored:[event(2024)],post:()=>pending});let done=0;
  box.ZhishiCalibration.open({onComplete(){done++;}});await new Promise(resolve=>setImmediate(resolve));
  box.__save('chart-key',legacyCard(),'yes',false);node('calibrationFinish').onclick();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(done,0);
  release({ok:false,json:async()=>({error:'mock failure'})});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(done,0);assert.match(node('calibrationFinish').textContent,/未保存/);
});
test('rapid answer changes are saved in order instead of racing',async()=>{
  const calls=[],releases=[];
  const {box}=clientFixture({authenticated:true,post:body=>{calls.push(body.answer);return new Promise(r=>releases.push(r));}});
  const card=legacyCard();box.__save('chart-key',card,'yes',false);box.__save('chart-key',card,'no',false);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['yes']);
  releases[0]({ok:true,json:async()=>({success:true})});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['yes','no']);
  releases[1]({ok:true,json:async()=>({success:true})});await new Promise(resolve=>setImmediate(resolve));
});
test('report review escapes user text and keeps confirmed history distinct from future adjustments',()=>{
  const ctx={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),ctx);
  const r=review([event(2021),event(2024,{note:'<img onerror=alert(1)>'})]);
  const html=ctx.reportReviewHTML(r);
  assert.match(html,/原判断与调整依据/);assert.match(html,/你的补充：&lt;img/);assert.doesNotMatch(html,/<img/);
  assert.match(html,/2027年/);assert.match(html,/2024年原问题/);
});
test('identical headline, pain point and paragraphs appear once, while supporting details remain',()=>{
  const ctx={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),ctx);
  const html=ctx.reportNarrative({headline:'同一个判断。',painPoint:'同一个判断。',paragraphs:['同一个判断。','另一个判断。','另一个判断。'],verdicts:[{title:'重复标题',claimKey:'x',outcomeText:'同一个判断。',sourceText:'独立依据',conditions:[]}]});
  assert.equal((html.match(/同一个判断/g)||[]).length,1);assert.equal((html.match(/另一个判断/g)||[]).length,1);
  assert.match(html,/独立依据/);assert.doesNotMatch(html,/重复标题/);
});
test('the same review adjustment in multiple future years is grouped without losing year evidence',()=>{
  const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),ctx);
  const r=review([event(2021),event(2024)],[future(),future({year:2029})]);
  const html=ctx.reportReviewHTML(r);
  assert.match(html,/2027、2029年/);assert.equal((html.match(/相同机制曾在不同年份/g)||[]).length,1);
  assert.match(html,/2027年：流年比劫作用/);assert.match(html,/2029年：流年比劫作用/);
});

test('common-process review explains cross-setting references, groups windows and escapes source text',()=>{
  const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),ctx);
  const school=model.professionalCandidates('study',{triggers:[{type:'伤官见官'}],reportLifeContext:{status:'student',age:20}})[0];
  school.detail+='<img src=x onerror=alert(1)>';
  const work=model.professionalCandidates('career',{triggers:[{type:'伤官见官'}],reportLifeContext:{status:'working',age:30}})[0];
  const r=review([event(2024,{options:[school],selected_option:school.key})],[{...work,year:2027,hasIndependentAnnualTrigger:true},{...work,year:2029,hasIndependentAnnualTrigger:true}]);
  const html=ctx.reportReviewHTML(r);assert.match(html,/可跨场景参考/);assert.match(html,/2027、2029年/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|当前未找到/);assert.equal((html.match(/伤官见官 · 共同作用方式/g)||[]).length,1);
});
