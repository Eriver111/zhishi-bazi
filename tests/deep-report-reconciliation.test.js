const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),Report=require('../js/deep-report.js');
const box={window:{},console};vm.createContext(box);
for(const f of ['bazi.js','structural.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),box);
const calc=box.window.BaZiCalculator,deps={calculator:calc,structural:box.window.StructuralAnalysis,chain:box.window.BaZiChain};
const bazi=calc.calculate(1986,6,15,6,'male',12);
const build=()=>Report.buildFacts(bazi,'male',{anchorYear:2026,currentYear:2026,lifeContext:{status:'working'},deps});
const publicText=n=>JSON.stringify([n.headline,n.painPoint,n.paragraphs,(n.verdicts||[]).map(v=>[v.title,v.outcomeText]),(n.years||[]).map(y=>[y.primaryEventLabel,y.summary])]);
function ledger(f,records){for(const row of f.fiveYear.years){row.eventAdjudication={lifeStage:{key:'development',label:'成年'},triggerStrength:5,domainRecords:records.map(r=>({...r})),primaryEvent:records[0],secondaryEvent:records[1]};row.dynamic={...row.dynamic,eventAdjudication:row.eventAdjudication};}}
const record=(domain,score,independent=true)=>({domain,label:domain,activationScore:score,direction:'偏不利',hasIndependentAnnualTrigger:independent,eventCandidate:domain+'原候选',scenarioCandidates:[domain+'合成独立场景'],evidence:[domain+'合成独立结构']});
const feedback=(domain,state='deprioritized',year=2026)=>({year,domain,state,label:domain,mechanismKey:'synthetic-mechanism',outcome:'合成复核原因',original:domain+'合成解释',sourceEvidence:['合成结构依据'],confirmedYears:state==='repeated'?[2021,2024]:[],deniedYears:[2024]});
const Model=require('../js/calibration-model.js');

test('denied primary is withdrawn; next independent event replaces it everywhere without raw fallback',()=>{
 const f=build(),core=JSON.stringify(f.core),grade=f.wealth.narrative.grade;
 ledger(f,[record('wealth',10),record('career',8),record('relationship',7,false)]);
 for(const row of f.fiveYear.years){row.interactions=[{domains:['wealth'],source:'大运',type:'冲',sourceText:'合成旧路径',outcomeText:'不得复活旧财富解释'}];}
 const raw=JSON.stringify(f.currentYear.interactions);
 Report.applyReportReview(f,{adjustments:f.fiveYear.years.map(row=>feedback('wealth','deprioritized',row.year))});
 for(const row of f.fiveYear.years){assert.equal(row.eventAdjudication.primaryEvent.domain,'career');assert.equal(row.eventAdjudication.secondaryEvent,null);assert.equal(row.dynamic.eventAdjudication,row.eventAdjudication);}
 assert.doesNotMatch(publicText(f.currentYear.narrative)+publicText(f.fiveYear.narrative)+publicText(f.wealth.narrative),/wealth合成独立场景|不得复活旧财富解释/);
 assert.match(publicText(f.currentYear.narrative),/career合成独立场景/);
 assert.match(f.storyline.focus,/事业工作/);assert.doesNotMatch(f.storyline.focus,/收入资金/);
 assert.equal(JSON.stringify(f.currentYear.interactions),raw);assert.equal(JSON.stringify(f.core),core);assert.equal(f.wealth.narrative.grade,grade);
 assert.equal(f.currentYear.reportOriginalAdjudication.primaryEvent.domain,'wealth');
});
test('all rejected or mixed candidates leave no fabricated opposite, fallback or triggerless replacement',()=>{
 const f=build();ledger(f,[record('wealth',10),record('career',9),record('relationship',8,false)]);
 Report.applyReportReview(f,{adjustments:f.fiveYear.years.flatMap(row=>[feedback('wealth','deprioritized',row.year),feedback('career','mixed',row.year)])});
 for(const row of f.fiveYear.years){assert.equal(row.eventAdjudication.primaryEvent,null);assert.equal(row.eventAdjudication.secondaryEvent,null);}
 assert.match(f.currentYear.narrative.headline,/没有足够依据指定替代/);
 assert.doesNotMatch(publicText(f.currentYear.narrative)+publicText(f.fiveYear.narrative),/合成独立场景|没有发现.*强引动/);
 assert.equal(f.storyline.focus,'');
});
test('repeated support only breaks a score tie; one answer cannot override stronger evidence or create a trigger',()=>{
 const f=build();ledger(f,[record('career',8),record('wealth',8),record('family',20,false)]);
 Report.applyReportReview(f,{adjustments:[feedback('wealth','repeated'),feedback('family','repeated')]});
 assert.equal(f.currentYear.eventAdjudication.primaryEvent.domain,'wealth');
 assert.equal(f.currentYear.reportReconciliation.changes.length,1);
 Report.applyReportReview(f,{adjustments:[feedback('wealth','tentative')]});
 assert.equal(f.currentYear.eventAdjudication.primaryEvent.domain,'career');
});
test('feedback edits and clearing restore the original ranking without changing the original snapshot',()=>{
 const f=build();ledger(f,[record('wealth',10),record('career',8)]);
 Report.applyReportReview(f,{adjustments:[feedback('wealth')]});const original=JSON.stringify(f.currentYear.reportOriginalAdjudication);
 Report.applyReportReview(f,{adjustments:[feedback('career')]});assert.equal(f.currentYear.eventAdjudication.primaryEvent.domain,'wealth');
 assert.equal(JSON.stringify(f.currentYear.reportOriginalAdjudication),original);
 Report.applyReportReview(f,{adjustments:[]});assert.equal(f.currentYear.reportReconciliation,undefined);
 assert.equal(f.currentYear.eventAdjudication.primaryEvent.domain,'wealth');
 assert.equal(f.currentYear.eventAdjudication.domainRecords.some(r=>r.reportExcluded),false);
});
test('unmatched year, domain, unknown state and ambiguous same-domain mechanisms do not override candidates',()=>{
 const f=build();ledger(f,[record('wealth',10),record('career',8)]);
 Report.applyReportReview(f,{adjustments:[feedback('wealth','unknown'),feedback('family'),feedback('wealth','deprioritized',2025)]});
 assert.equal(f.currentYear.reportReconciliation,undefined);
 Report.applyReportReview(f,{adjustments:[feedback('wealth'),{...feedback('wealth'),mechanismKey:'different'}]});
 assert.equal(f.currentYear.reportReconciliation,undefined);
});
test('revision HTML escapes original text and keeps it inside foldable PDF-compatible details',()=>{
 const context={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},console,URLSearchParams,location:{search:''}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),context);
 const html=context.reportNarrative({headline:'新结论',revisions:[{label:'母亲',original:'<img src=x onerror=1>',reason:'用户反馈',sourceEvidence:[]}]});
 assert.match(html,/<details class="report-claim-details">/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
 assert.match(html,/仅供追溯/);
});

test('professional candidates require activated named mechanisms, not just wealth or seal ten-gods',()=>{
 assert.deepEqual(Model.professionalCandidates('wealth',{triggers:[],stemRole:'财'}),[]);
 assert.deepEqual(Model.professionalCandidates('wealth',{triggers:[{type:'财制印',detail:'无财坏印'}]}),[]);
 const candidates=Model.professionalCandidates('wealth',{reportTriggeredRisks:[{type:'财破印'}],triggers:[{type:'比肩夺财'}]});
 assert.equal(candidates.length,2);assert.notEqual(candidates[0].mechanism_key,candidates[1].mechanism_key);
 assert.match(candidates[0].detail,/正常消费.*不算损失/);
 assert.equal(Model.professionalCandidates('family',{triggers:[{type:'财破印'}]}).length,0);
});

test('rejecting wealth-breaks-seal loss retains peer-loss as a separate supported mechanism in the same domain',()=>{
 const f=build(),family=JSON.stringify(calc.analyzeParents(bazi,'male'));ledger(f,[record('wealth',10),record('career',8)]);
 const options=Model.professionalCandidates('wealth',{triggers:[{type:'财破印'},{type:'比肩夺财'}]});
 const events=[{event_key:'synthetic-2024',event_year:2024,domain:'wealth',answer:'no',options:[options[0]]}];
 const review=Model.buildReportReview(events,f.fiveYear.years.flatMap(row=>options.map(c=>({...c,year:row.year,hasIndependentAnnualTrigger:true}))),{currentYear:2026});
 assert.equal(review.adjustments.length,5);
 Report.applyReportReview(f,review);
 for(const row of f.fiveYear.years){assert.equal(row.eventAdjudication.primaryEvent.reportMechanismKey,'rule:peer-takes-wealth');assert.equal(row.eventAdjudication.domainRecords.find(r=>r.reportMechanismKey==='rule:wealth-breaks-seal').reportExcluded,true);}
 assert.match(publicText(f.wealth.narrative),/借钱或代垫费用/);
 assert.doesNotMatch(publicText(f.currentYear.narrative)+publicText(f.fiveYear.narrative),/正常消费、储蓄转投资/);
 assert.equal(JSON.stringify(calc.analyzeParents(bazi,'male')),family);
});

test('a rejected manifestation does not disprove another manifestation or a different professional mechanism',()=>{
 const loss=Model.professionalCandidates('wealth',{triggers:[{type:'财破印'}]})[0];
 const events=[{event_key:'loss-2024',event_year:2024,domain:'wealth',answer:'no',options:[loss]}];
 const review=Model.buildReportReview(events,[{...loss,year:2027,hasIndependentAnnualTrigger:true},{...loss,manifestation:'normal-spending',year:2027,hasIndependentAnnualTrigger:true},{...loss,mechanism_key:'rule:peer-takes-wealth',year:2027,hasIndependentAnnualTrigger:true}],{currentYear:2026});
 assert.equal(review.adjustments.length,1);assert.equal(review.adjustments[0].manifestation,'unexpected-loss:e2');
});

test('old broad ten-god answers cannot silently validate a newly named professional rule',()=>{
 const fresh=Model.professionalCandidates('wealth',{triggers:[{type:'财破印'}]})[0];
 const old={...fresh,mechanism_key:'wealth:偏财',manifestation:'money-outflow'};
 const history=[2021,2024].map(year=>({event_key:'old-'+year,event_year:year,domain:'wealth',answer:'yes',selected_option:old.key,match_level:'exact',options:[old]}));
 assert.equal(Model.buildReportReview(history,[{...fresh,year:2027,hasIndependentAnnualTrigger:true}],{currentYear:2026}).adjustments.length,0);
});

test('report calibration has no family questionnaire or parent-rendering writeback',()=>{
 const client=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8'),result=fs.readFileSync(path.join(root,'js/result.js'),'utf8');
 assert.doesNotMatch(client,/familyReality|reportReality|attachReality|familyRealityForm/);
 const paid=result.slice(result.indexOf('function renderPaidContent('),result.indexOf('var _reportReviewRequest'));
 assert.doesNotMatch(paid,/renderParents\(/);
});
