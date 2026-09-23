const test=require('node:test'),assert=require('node:assert/strict');
const Imagery=require('../js/report-imagery.js'),Model=require('../js/calibration-model.js'),Report=require('../js/deep-report.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const m=(name,extra={})=>({name,sourcePillar:'month',targetPillar:'day',sourceWx:'木',targetWx:'火',sourceShiShen:'食神',targetShiShen:'七杀',evidence:['合成实际边'],dominanceScore:2,...extra});
function context(mechanisms=[],extra={}){return {triggers:[{type:'六冲',target:'month',detail:'合成流年引动月柱'}],reportMechanismContext:{chain:{mechanisms,paths:[],factGraph:{nodes:[],edges:[]}},yongJi:{xiShen:['木'],jiShen:['火']},...extra}};}
const ctx=a=>a.reportMechanismContext;
function route(first='七杀',full=false){const a=context([m('官杀生印',{sourceShiShen:first}),m('印生身',{sourceWx:'火',targetWx:'土'})]);ctx(a).yongJi={xiShen:['火']};ctx(a).chain.paths=[{name:full?'财官印身连续流通':'官杀经印通关',steps:['官杀生印','印生身']}];return a;}
function peers(){const a=context([m('官杀克身',{sourceShiShen:'七杀'})]);ctx(a).yongJi={xiShen:['土'],jiShen:['木'],weaknessCause:{type:'七杀攻身',peerElement:'土'}};ctx(a).chain.factGraph.nodes=[{family:'比劫',wx:'土',depth:'本气',weight:1,effectiveCoefficient:1}];return a;}
function pattern(name){const a=context([m('食伤制杀',{targetShiShen:'七杀'})]);ctx(a).pattern={status:'条件待定',relatedPatterns:[{name:name+'格',status:'成格'}]};return a;}
function edge(fromFamily,toFamily){const a=context();ctx(a).chain.factGraph.edges=[{type:'生',strength:1,evidence:'合成连续生边',fromNode:{family:fromFamily,pillar:'month'},toNode:{family:toFamily,pillar:'day',wx:'木'}}];return a;}
function sealOutput(){const a=context([m('印制食伤',{sourceShiShen:'正印',targetShiShen:'伤官'})]);ctx(a).yongJi.functionalTasks=[{type:'印星制伤护格'}];return a;}
const explicit=name=>({triggers:[{type:name,detail:'合成明确年度触发'}]});
const fixtures={
 'wealth-breaks-seal':()=>explicit('财破印'),
 'peer-takes-wealth':()=>explicit('比劫夺财'),
 'output-controls-officer':()=>explicit('伤官见官'),
 'seal-restrains-output':()=>explicit('枭夺食'),
 'officer-pressure':()=>explicit('官杀混杂'),
 'peer-resists-kill':peers,
 'peer-carries-wealth':()=>{const a=context([m('比劫制财')]);ctx(a).yongJi.weaknessCause={type:'财多耗身'};return a;},
 'seal-transforms-kill':()=>route(),
 'officer-seal-support':()=>route('正官'),
 'food-controls-kill':()=>{const a=context([m('食神制杀')]);ctx(a).yongJi.weaknessCause={foodGodControlsKill:true};return a;},
 'output-controls-kill':()=>context([m('食伤制杀')]),
 'hurt-combines-kill':()=>pattern('伤官合杀'),
 'blade-joins-kill':()=>pattern('羊刃驾杀'),
 'seal-guides-output':sealOutput,
 'output-generates-wealth':()=>{const a=context([m('食伤生财')]);ctx(a).yongJi={xiShen:['木','火']};return a;},
 'wealth-generates-officer':()=>{const a=context([m('财生官杀',{targetShiShen:'正官'})]);ctx(a).yongJi={xiShen:['木','火']};return a;},
 'wealth-feeds-kill':()=>context([m('财生官杀',{targetShiShen:'七杀'})]),
 'officer-protects-wealth':()=>{const a=context();ctx(a).yongJi={xiShen:['木','金']};ctx(a).chain.factGraph.edges=[{type:'克',strength:1,evidence:'官制比劫',fromNode:{id:'o',family:'官杀',wx:'木',pillar:'month'},toNode:{id:'p',family:'比劫',pillar:'day'}},{type:'克',strength:1,evidence:'比劫争财',fromNode:{id:'p',family:'比劫',pillar:'day'},toNode:{id:'w',family:'财',wx:'金',pillar:'hour'}}];return a;},
 'wealth-regulates-seal':()=>context([m('财破印')]),
 'seal-supports-self':()=>context([m('印生身')]),
 'seal-overrestricts-output':()=>{const a=context([m('印制食伤')]);ctx(a).yongJi={xiShen:['火'],jiShen:['木']};return a;},
 'output-drains-self':()=>{const a=edge('日主','食伤');ctx(a).yongJi.weaknessCause={type:'食伤泄身'};return a;},
 'peer-through-output':()=>edge('比劫','食伤'),
 'officer-regulates-peers':()=>context([m('官杀克身')]),
 'output-regulates-officer':()=>context([m('食伤制官',{targetShiShen:'正官'})]),
 'wealth-officer-seal-flow':()=>route('正官',true),
 'clash-releases-obstruction':()=>({triggers:[{type:'六冲',isGood:true,targetRole:'忌神'}]}),
 'clash-damages-support':()=>({triggers:[{type:'六冲',isGood:false,targetRole:'喜神'}]}),
 'combine-connects':()=>({triggers:[{type:'流年合日支'}]}),
 'punishment-rework':()=>({triggers:[{type:'刑',target:'month'}]}),
 'recurrence-revisits':()=>({triggers:[{type:'伏吟',target:'month'}]})
};
for(const rule of Imagery.rules)test('imagery pathway: '+rule.name+' requires its existing evidence and preserves inputs',()=>{
 assert.equal(typeof fixtures[rule.id],'function',rule.id+' missing a reachability fixture');
 const a=fixtures[rule.id](),before=JSON.stringify(a);
 for(const domain of new Set(rule.outcomes.map(o=>o.domain))){
  const found=Imagery.candidates(domain,a).filter(c=>c.mechanism_key==='rule:'+rule.id);
  assert.equal(found.length,rule.outcomes.filter(o=>o.domain===domain).length,rule.id);
  assert.ok(found.every(c=>c.evidence.length===3&&c.reportBaseline));
 }
 assert.equal(JSON.stringify(a),before);
 a.triggers=[];a.reportTriggeredRisks=[];
 assert.equal(Imagery.candidates(rule.outcomes[0].domain,a).filter(c=>c.mechanism_key==='rule:'+rule.id).length,0,'natal mechanism alone is not an annual event');
});

test('registry has distinct rule identities, conditions, counterexamples and six mechanism groups',()=>{
 assert.equal(new Set(Imagery.rules.map(r=>r.id)).size,Imagery.rules.length);
 assert.equal(new Set(Imagery.rules.map(r=>r.group)).size,6);
 assert.ok(Imagery.rules.length>=30);
 assert.ok(Imagery.rules.every(r=>r.condition&&r.counterexample&&r.outcomes.length));
 assert.ok(Imagery.rules.every(r=>r.outcomes.every(o=>o.domain!=='family')));
});
test('bare positive rule names without proof do not activate support or rescue',()=>{
 for(const name of ['比劫抗杀','食神制杀','羊刃驾杀','伤官配印'])assert.equal(Imagery.candidates('career',explicit(name)).length,0);
});
test('peer resistance requires usable rooted peers and never applies to a following chart',()=>{
 for(const mutate of [a=>ctx(a).congGe=true,a=>ctx(a).congGe={isCong:true},a=>ctx(a).yongJi.xiShen=[],a=>ctx(a).chain.factGraph.nodes[0].effectiveCoefficient=0,a=>ctx(a).chain.factGraph.nodes[0].depth='余气',a=>ctx(a).chain.factGraph.nodes=[]]){
  const a=peers();mutate(a);assert.ok(!Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:peer-resists-kill'));
 }
 const a=peers();ctx(a).congGe={isCong:false};assert.ok(Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:peer-resists-kill'));
});
test('food control, seal transformation and peer endurance stay separate and require their own conditions',()=>{
 const a=fixtures['food-controls-kill']();ctx(a).yongJi.weaknessCause={type:'七杀攻身',foodGodControlsKill:false};
 assert.ok(!Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:food-controls-kill'));
 const b=route();ctx(b).chain.paths=[];assert.ok(!Imagery.candidates('career',b).some(c=>c.mechanism_key==='rule:seal-transforms-kill'));
 const c=fixtures['blade-joins-kill']();ctx(c).pattern.relatedPatterns[0].status='破格';assert.ok(!Imagery.candidates('career',c).some(c=>c.mechanism_key==='rule:blade-joins-kill'));
});
test('wealth controlling seal reverses interpretation only when seal usefulness actually differs',()=>{
 const a=context([m('财破印')]);assert.ok(Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:wealth-regulates-seal'));
 ctx(a).yongJi={xiShen:['火'],jiShen:['木']};assert.ok(Imagery.candidates('wealth',a).some(c=>c.mechanism_key==='rule:wealth-breaks-seal'));
 assert.ok(!Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:wealth-regulates-seal'));
});
test('decade-only, unrelated-pillar and unnamed generic annual triggers do not activate a natal route',()=>{
 for(const triggers of [[{type:'六冲',target:'hour'}],[{type:'六冲',target:'month',source:'大运'}],[{type:'普通变化'}]]){
  const a=fixtures['output-generates-wealth']();a.triggers=triggers;
  assert.ok(!Imagery.candidates('wealth',a).some(c=>c.mechanism_key==='rule:output-generates-wealth'));
 }
});

const engine={window:{},console};vm.createContext(engine);
for(const file of ['bazi.js','structural.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),engine);
const calculator=engine.window.BaZiCalculator;
function report(){const b=calculator.calculate(1986,6,15,6,'male',12);const f=Report.buildFacts(b,'male',{anchorYear:2026,lifeContext:{status:'working'},deps:{calculator,structural:engine.window.StructuralAnalysis,chain:engine.window.BaZiChain}});
 const r={domain:'career',label:'事业',activationScore:8,hasIndependentAnnualTrigger:true,direction:'条件性',evidence:['合成年度独立触发']};
 const a={domainRecords:[r],primaryEvent:r,lifeStage:{key:'development'}};f.currentYear.eventAdjudication=a;f.currentYear.dynamic.eventAdjudication=a;return f;}
const peerOptions=()=>Imagery.candidates('career',peers()).filter(c=>c.mechanism_key==='rule:peer-resists-kill').map(c=>({...c,year:2026,hasIndependentAnnualTrigger:true}));

function inScene(id,status,domain){const a=fixtures[id]();a.reportLifeContext={status,age:25};return Imagery.candidates(domain,a).filter(c=>c.mechanism_key==='rule:'+id);}
function confirmed(option,year=2024,extra={}){return {event_key:'confirmed-'+year,event_year:year,answer:'yes',selected_option:option.key,match_level:'exact',options:[option],...extra};}
const futureOptions=options=>options.map(c=>({...c,year:2026,hasIndependentAnnualTrigger:true}));

test('every imagery rule owns an explicit common process and validates its contextual identity',()=>{
 for(const rule of Imagery.rules){assert.ok(rule.commonProcess&&rule.commonProcess.length>10);for(const o of rule.outcomes){
  const descriptor=Imagery.describeOption({domain:o.domain,manifestation:o.manifestation+':e2',mechanism_key:'rule:'+rule.id});assert.equal(descriptor.commonProcess,rule.commonProcess);assert.equal(descriptor.scene,'unspecified');
 }}
 assert.equal(Imagery.describeOption({domain:'career',manifestation:'invented:work',mechanism_key:'rule:output-controls-officer'}),null);
 assert.equal(Imagery.describeOption({domain:'family',manifestation:'authority-conflict:work',mechanism_key:'rule:output-controls-officer'}),null);
});

test('authority friction links school and work at common-process level without validating job events',()=>{
 const school=inScene('output-controls-officer','student','study')[0],work=futureOptions(inScene('output-controls-officer','working','career'));
 const r=Model.buildReportReview([confirmed(school)],work,{currentYear:2026});
 assert.equal(r.adjustments.length,0);assert.equal(r.processReferences.length,1);assert.match(r.processReferences[0].commonProcess,/自主表达与权威要求/);
 assert.equal(r.processReferences[0].scope,'common_process_only');assert.equal(r.processReferences[0].sources[0].scene,'student');assert.equal(r.processReferences[0].futureConfirmed,false);
 const f=report(),core=JSON.stringify(f.core),score=f.currentYear.eventAdjudication.primaryEvent.activationScore;
 Report.applyReportReview(f,r);assert.match(f.currentYear.narrative.painPoint,/往事可参考的共同作用方式/);assert.equal(f.currentYear.reportReconciliation.changes.length,0);
 assert.equal(f.currentYear.eventAdjudication.primaryEvent.activationScore,score);assert.equal(JSON.stringify(f.core),core);
});

test('all 31 common processes support cross-setting references, rather than only the authority example',()=>{
 for(const rule of Imagery.rules){const domain=rule.outcomes.find(o=>o.domain!=='study')?.domain||'study';
  const source=inScene(rule.id,domain==='study'?'student':'home',domain)[0];
  const target=futureOptions(inScene(rule.id,domain==='study'?'exam':'retired',domain));
  assert.ok(source&&target.length,rule.id);const r=Model.buildReportReview([confirmed(source)],target,{currentYear:2026});
  assert.ok(r.processReferences.length,rule.id);assert.equal(r.adjustments.length,0,rule.id);
 }
});

test('shared processes still require target annual evidence and reject partial or unsure feedback',()=>{
 const school=inScene('output-controls-officer','student','study')[0],work=futureOptions(inScene('output-controls-officer','working','career'));
 for(const event of [confirmed(school,2024,{match_level:'partial'}),confirmed(school,2024,{answer:'unsure'})])assert.equal(Model.buildReportReview([event],work,{currentYear:2026}).processReferences.length,0);
 assert.equal(Model.buildReportReview([confirmed(school)],work.map(c=>({...c,hasIndependentAnnualTrigger:false})),{currentYear:2026}).processReferences.length,0);
 assert.equal(Model.buildReportReview([confirmed(school,2027)],work,{currentYear:2026}).processReferences.length,0);
});

test('same-setting full matches keep their existing interpretation and are not counted twice',()=>{
 const work=inScene('output-controls-officer','working','career'),r=Model.buildReportReview([confirmed(work[0])],futureOptions(work),{currentYear:2026});
 assert.equal(r.adjustments.length,1);assert.equal(r.processReferences.length,0);
});

test('contradictory feedback is visible in process references and denying an event alone cannot refute a disposition',()=>{
 const school=inScene('output-controls-officer','student','study')[0],work=futureOptions(inScene('output-controls-officer','working','career'));
 const negative=confirmed(school,2023,{answer:'no'}),r=Model.buildReportReview([negative,confirmed(school)],work,{currentYear:2026});
 assert.equal(r.adjustments.length,0);assert.equal(r.processReferences[0].state,'mixed-reference');assert.deepEqual(r.processReferences[0].counterYears,[2023]);
 assert.equal(Model.buildReportReview([negative],work,{currentYear:2026}).processReferences.length,0);
});

test('process references use actual years and never infer a missing historical identity',()=>{
 const legacy=Imagery.candidates('career',fixtures['output-controls-officer']())[0],target=futureOptions(inScene('output-controls-officer','working','career'));
 const r=Model.buildReportReview([confirmed(legacy,2023,{actual_year:2024}),confirmed(legacy,2024)],target,{currentYear:2026});
 assert.deepEqual(r.processReferences[0].sourceYears,[2024]);assert.equal(r.processReferences[0].sources[0].scene,'unspecified');
});

test('common processes never transfer between different rules or fabricate specific outcomes',()=>{
 const school=inScene('output-controls-officer','student','study')[0];
 assert.equal(Model.buildReportReview([confirmed(school)],futureOptions(inScene('output-regulates-officer','working','career')),{currentYear:2026}).processReferences.length,0);
 const past=inScene('peer-resists-kill','student','study')[0],target=futureOptions(inScene('peer-resists-kill','working','career'));
 const r=Model.buildReportReview([confirmed(past)],target,{currentYear:2026}),f=report();Report.applyReportReview(f,r);
 assert.equal(r.adjustments.length,0);assert.equal(r.processReferences.length,2);assert.equal(f.currentYear.eventAdjudication.secondaryEvent,null);
 assert.doesNotMatch(f.currentYear.narrative.painPoint,/最终完成了|主要目标仍未完成/);
 Report.applyReportReview(f,Model.buildReportReview([],target,{currentYear:2026}));assert.doesNotMatch(f.currentYear.narrative.painPoint,/往事可参考/);
});

test('all 31 rules have non-employment scenes with stable normalized identifiers',()=>{
 for(const status of ['student','exam','transition','home','retired','unknown'])for(const rule of Imagery.rules){
  const rows=rule.outcomes.flatMap(o=>Imagery.sceneOutcomes(rule,o.domain,{status,age:status==='student'?22:45}));
  assert.ok(rows.length,rule.id+' '+status);
  for(const row of rows){assert.doesNotMatch(row.detail,/领导|岗位|客户|订单|入职|晋升|工作中|项目交付/);assert.doesNotMatch(row.detail,/\{\w+\}/);}
  const a=fixtures[rule.id]();a.reportLifeContext={status,age:22};
  for(const domain of ['career','study','wealth','relationship','change'])for(const c of Imagery.candidates(domain,a)){
   const normalized=Model.normalizeCalibrationOptions([c])[0];assert.equal(normalized.key,c.key);assert.equal(normalized.manifestation,c.manifestation);
  }
 }
});
test('student, exam, employment and non-working peer resistance have different concrete landings',()=>{
 const rows={};for(const status of ['student','exam','working','transition','home','retired','unknown']){
  const a=peers();a.reportLifeContext={status,age:28};rows[status]=Imagery.candidates(['student','exam'].includes(status)?'study':'career',a).filter(c=>c.mechanism_key==='rule:peer-resists-kill');assert.equal(rows[status].length,2);
 }
 assert.match(rows.student[0].detail,/课程作业/);assert.match(rows.exam[0].detail,/复习练习/);assert.match(rows.transition[0].detail,/投递申请或面试/);assert.match(rows.home[0].detail,/证件办理或照料/);assert.match(rows.retired[0].detail,/兴趣活动/);
 assert.equal(new Set(Object.values(rows).map(r=>r[0].manifestation)).size,7);
});
test('school feedback does not confirm a job result and exact same setting remains usable',()=>{
 const a=peers();a.reportLifeContext={status:'student',age:20};const school=Imagery.candidates('study',a).filter(c=>c.mechanism_key==='rule:peer-resists-kill');
 const event={event_key:'school',event_year:2024,answer:'yes',selected_option:school[0].key,match_level:'exact',options:school};
 a.reportLifeContext={status:'working',age:22};const work=Imagery.candidates('career',a).map(c=>({...c,year:2026,hasIndependentAnnualTrigger:true}));
 assert.equal(Model.buildReportReview([event],work,{currentYear:2026}).adjustments.length,0);
 assert.equal(Model.buildReportReview([event],school.map(c=>({...c,year:2026,hasIndependentAnnualTrigger:true})),{currentYear:2026}).adjustments.length,1);
});
test('scene choice obeys stated status and does not guess employment or retirement from age',()=>{
 assert.equal(Imagery.resolveScene({status:'student',age:42}),'student');assert.equal(Imagery.resolveScene({status:'working',age:20}),'working');
 assert.equal(Imagery.resolveScene({status:'unknown',age:68}),'daily');assert.equal(Imagery.resolveScene({status:'unknown',age:19}),'daily');assert.equal(Imagery.resolveScene({status:'unknown',age:14}),'student');assert.equal(Imagery.resolveScene({status:'unknown',age:null}),'daily');
});
test('historical study remains conditional and never borrows current occupation',()=>{
 const a=peers();a.reportLifeContext={status:'unknown',age:38,historical:true};
 const rows=Imagery.candidates('study',a);assert.ok(rows.length);assert.ok(rows.every(c=>c.detail.startsWith('如果当年在读、学习或备考：')));
 a.reportLifeContext={status:'working',age:38};assert.equal(Imagery.candidates('study',a).length,0);
});
test('minors are not given earned-income imagery and school finance is actual discretionary loss',()=>{
 const a=fixtures['output-generates-wealth']();a.reportLifeContext={status:'student',age:12};assert.equal(Imagery.candidates('wealth',a).length,0);
 const b=fixtures['wealth-breaks-seal']();b.reportLifeContext={status:'student',age:12};const c=Imagery.candidates('wealth',b)[0];assert.match(c.detail,/可支配费用/);assert.match(c.detail,/正常购买资料/);assert.doesNotMatch(c.detail,/回款|投资|工资/);
});
test('generic report timing also follows non-working context before old job scenarios',()=>{
 const record={domain:'career',direction:'偏有利',scenarioCandidates:['职位晋升、客户认可']};
 for(const status of ['student','exam','transition','home','retired','unknown']){
  const s=Report.__test.selectTimingScenario(record,{lifeContext:{status,age:24},lifeStage:{key:'development'}});assert.doesNotMatch(s,/职位|客户|晋升/);assert.ok(s.length>10);
 }
 assert.equal(Report.resolveLifeContext({status:'home'},1986,2026).studyRelevant,false);
});

test('actual annual report candidates adapt across seven states without changing core, grade or parents',()=>{
 for(const birth of [1986,2006,2012]){
  const b=calculator.calculate(birth,6,15,6,'male',12),parent=JSON.stringify(calculator.analyzeParents(b,'male'));let core,grade;
  for(const status of ['student','exam','working','transition','home','retired','unknown']){
   const f=Report.buildFacts(b,'male',{anchorYear:2026,lifeContext:{status},deps:{calculator,structural:engine.window.StructuralAnalysis,chain:engine.window.BaZiChain}});
   if(!core){core=JSON.stringify(f.core);grade=f.wealth.narrative.grade;}
   const candidates=[];
   for(const row of f.fiveYear.years){const a={...row.dynamic,reportLifeContext:row.lifeContext,reportTriggeredRisks:row.triggeredRisks,reportMechanismContext:{chain:f.core.chain,yongJi:f.core.yongJi,pattern:f.core.pattern,congGe:f.core.congGe}};
    for(const r of row.eventAdjudication.domainRecords.filter(r=>r.hasIndependentAnnualTrigger))for(const c of Imagery.candidates(r.domain,a))candidates.push({...c,year:row.year,hasIndependentAnnualTrigger:true});
   }
   Report.applyReportReview(f,Model.buildReportReview([],candidates,{currentYear:2026}));
   assert.equal(JSON.stringify(f.core),core);assert.equal(f.wealth.narrative.grade,grade);assert.equal(JSON.stringify(calculator.analyzeParents(b,'male')),parent);
   for(const row of f.fiveYear.years)for(const r of row.eventAdjudication.domainRecords.filter(r=>r.domain!=='family')){
    if(status!=='working')assert.doesNotMatch(Report.__test.selectTimingScenario(r,row.eventAdjudication),/领导|客户|订单|晋升|项目交付/);
   }
  }
 }
});
test('without answers the report uses mechanism process text, not both contradictory outcomes',()=>{
 const f=report();Report.applyReportReview(f,Model.buildReportReview([],peerOptions(),{currentYear:2026}));
 assert.match(f.currentYear.narrative.painPoint,/过程较为耗力/);
 assert.doesNotMatch(f.currentYear.narrative.headline,/结合往事反馈/);
 assert.equal(f.currentYear.eventAdjudication.secondaryEvent,null);
 assert.equal(f.currentYear.reportReconciliation.changes.length,0);
});
test('denying costly completion does not automatically assert failure; another supported mechanism is required',()=>{
 const opts=peerOptions(),f=report(),event={event_key:'past',event_year:2024,answer:'no',options:[opts[0]]};
 Report.applyReportReview(f,Model.buildReportReview([event],opts,{currentYear:2026}));
 assert.equal(f.currentYear.eventAdjudication.primaryEvent,null);
 assert.doesNotMatch(f.currentYear.narrative.painPoint,/仍未完成/);
});
test('confirming high effort with stalled outcome never validates the completed-goal interpretation',()=>{
 const opts=peerOptions(),event={event_key:'past',event_year:2024,answer:'yes',selected_option:opts[1].key,match_level:'exact',options:opts};
 const review=Model.buildReportReview([event],opts,{currentYear:2026}),f=report();
 assert.equal(review.adjustments.length,1);assert.equal(review.adjustments[0].manifestation,'costly-stalled:e2');
 Report.applyReportReview(f,review);assert.equal(f.currentYear.eventAdjudication.primaryEvent.reportManifestation,'costly-stalled:e2');assert.equal(f.currentYear.eventAdjudication.secondaryEvent,null);
});
test('partial agreement with effort does not validate completed-goal claims even across two years',()=>{
 const opts=peerOptions(),events=[2021,2024].map(year=>({event_key:'partial-'+year,event_year:year,answer:'yes',selected_option:opts[0].key,match_level:'partial',options:opts}));
 const review=Model.buildReportReview(events,opts,{currentYear:2026});
 assert.equal(review.adjustments.length,0);assert.equal(review.history.length,2);assert.ok(review.history.every(h=>h.matchLevel==='partial'));
 const f=report();Report.applyReportReview(f,review);assert.doesNotMatch(f.currentYear.narrative.painPoint,/最终完成了/);
});

test('64 generated charts exercise the registry through real annual evidence without changing core or parents',()=>{
 const covered=new Set();let activeYears=0;
 for(const year of [1958,1966,1974,1982,1990,1998,2006,2010])for(const month of [2,5,8,11])for(const gender of ['male','female']){
  const b=calculator.calculate(year,month,15,6,gender,12),f=Report.buildFacts(b,gender,{anchorYear:2026,lifeContext:{status:year>=2010?'student':'working'},deps:{calculator,structural:engine.window.StructuralAnalysis,chain:engine.window.BaZiChain}});
  const original=JSON.stringify(f.core),parents=JSON.stringify(calculator.analyzeParents(b,gender)),grade=f.wealth.narrative.grade;
  const candidates=[];
  for(const row of f.fiveYear.years){
   const analysis={...row.dynamic,reportTriggeredRisks:row.triggeredRisks,reportMechanismContext:{chain:f.core.chain,yongJi:f.core.yongJi,pattern:f.core.pattern,congGe:f.core.congGe}};
   for(const r of row.eventAdjudication.domainRecords.filter(r=>r.hasIndependentAnnualTrigger)){
    for(const c of Imagery.candidates(r.domain,analysis)){covered.add(c.mechanism_key);candidates.push({...c,year:row.year,hasIndependentAnnualTrigger:true});}
   }
  }
  Report.applyReportReview(f,Model.buildReportReview([],candidates,{currentYear:2026}));
  assert.equal(JSON.stringify(f.core),original);assert.equal(f.wealth.narrative.grade,grade);assert.equal(JSON.stringify(calculator.analyzeParents(b,gender)),parents);
  for(const row of f.fiveYear.years){if(row.reportReconciliation)activeYears++;const a=row.eventAdjudication;
   if(a.primaryEvent?.reportMechanismKey&&a.secondaryEvent?.reportMechanismKey)assert.notEqual(a.primaryEvent.reportMechanismKey,a.secondaryEvent.reportMechanismKey,'unconfirmed variants must not become two predictions');
  }
 }
 assert.ok(covered.size>=8,'actual engines should exercise several mechanism families');assert.ok(activeYears>30);
});
