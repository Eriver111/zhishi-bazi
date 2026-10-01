const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const Report=require('../js/deep-report');

const sections=['thisYearSection','wealthSection','marriageSection','careerSection','studySection','fortuneSection'];
const states=['unknown','single','dating','married','other'];
const defaultLife={status:'working',age:30,asOfYear:2026};
function fixture(life={}){
 return {
  core:{strength:{level:'中和'},pattern:{},yongJi:{yongShen:['木'],xiShen:['火'],jiShen:['金']},actionChains:[],relationEvents:[],structuralRisks:[]},
  lifeContext:{...defaultLife,...life},
  wealth:{resource:{visibleCount:1,hiddenCount:1,quality:{}},capacity:{state:'可承接'},pathways:[],retention:{risks:[]},storage:{storages:[]}},
  relationship:{interaction:{direction:'命主生夫妻宫'},palace:{zhi:'寅',elementRole:'用神',hiddenTenGods:[{gan:'甲',role:'偏印',layer:'本气'}],dayInvolvingEvents:[{type:'六冲'},{type:'刑'},{type:'六害'},{type:'六合'}]},spouseStar:{exposed:[{gan:'戊'}],occurrences:[{gan:'戊',pillar:'month'}],quality:{visibility:'透藏并见',rooted:true,rolePurity:'单一口径'}}},
  study:{relevant:true,absorption:{state:'有承接'},profile:{key:'composite'},limitations:[]},
  fiveYear:{years:[]}
 };
}
const relationship=life=>Report.buildNarratives(fixture(life)).relationship;
const visible=n=>[n.headline,...n.verdicts.filter(v=>!v.detailOnly).map(v=>(v.displayTitle||v.title)+' '+v.outcomeText)].join(' ');
const landing=n=>n.verdicts.find(v=>v.semanticKey==='relationship:relationship-follow-through');
function yearWith(records,year=2026,triggers=[{type:'六合',target:'day'}],life={}){
 const context={...defaultLife,...life};
 return {year,pillar:{gan:'甲',zhi:'子'},lifeContext:context,dynamic:{triggers},eventAdjudication:{lifeContext:context,age:context.age,domainRecords:records,primaryEvent:records[0],secondaryEvent:records[1]}};
}
const record=(domain,extra={})=>({domain,direction:'偏有利',hasIndependentAnnualTrigger:true,activationScore:8,scenarioCandidates:[],evidence:['合成独立年度依据'],...extra});

test('optional reading context is normalized with strict whitelists and at most two priorities',()=>{
 const input={status:'working',relationshipStatus:'single',priorities:['bad','career','career','relationship','wealth','family']};
 const before=JSON.stringify(input),context=Report.resolveLifeContext(input,1996,2026);
 assert.equal(context.relationshipStatus,'single');
 assert.deepEqual(context.priorities,['career','relationship']);
 assert.equal(JSON.stringify(input),before);
 for(const state of states)assert.equal(Report.resolveLifeContext({relationshipStatus:state},1996,2026).relationshipStatus,state);
 for(const value of [undefined,null,'',false,{},['single'],'Single','divorced','__proto__'])assert.equal(Report.resolveLifeContext({relationshipStatus:value},1996,2026).relationshipStatus,'unknown');
 for(const priorities of [undefined,null,'wealth,relationship',{},false])assert.deepEqual(Report.resolveLifeContext({priorities},1996,2026).priorities,[]);
 assert.deepEqual(Report.resolveLifeContext({priorities:['__proto__',{},'family','study']},1996,2026).priorities,['family','study']);
});

test('section preferences reorder safely and always retain every default section exactly once',()=>{
 assert.deepEqual(Report.reportSectionOrder(),sections);
 assert.deepEqual(Report.reportSectionOrder({priorities:['relationship','career']}),['marriageSection','careerSection','thisYearSection','wealthSection','studySection','fortuneSection']);
 assert.deepEqual(Report.reportSectionOrder({priorities:['family','wealth']}),sections);
 const input={priorities:['__proto__','study','study','family','career']},before=JSON.stringify(input);
 const actual=Report.reportSectionOrder(input);
 assert.deepEqual(actual.slice(0,2),['studySection','thisYearSection']);
 assert.deepEqual(actual.slice().sort(),sections.slice().sort());
 assert.equal(new Set(actual).size,6);
 assert.equal(JSON.stringify(input),before);
});

test('unknown and other relationship context preserve the previous narrative without inventing a history',()=>{
 const original=relationship({});
 for(const relationshipStatus of ['unknown','other','forged'])assert.deepEqual(relationship({relationshipStatus}),original);
 assert.doesNotMatch(visible(relationship({relationshipStatus:'other'})),/离异|丧偶|复婚|分居/);
});

test('single, dating and married readers see the same evidence in an appropriate current context',()=>{
 const original=relationship({}),single=relationship({relationshipStatus:'single'}),dating=relationship({relationshipStatus:'dating'}),married=relationship({relationshipStatus:'married'});
 assert.match(single.headline,/目前单身|认识/);
 assert.match(landing(single).outcomeText,/认识到互有好感的人以后/);
 assert.equal(single.verdicts[0].semanticKey,'relationship:relationship-follow-through');
 single.verdicts.filter(v=>/give-and-decide|daily-friction:|event:/.test(v.semanticKey)).forEach(v=>assert.match(v.outcomeText,/^开始与有好感的人相处后/));
 assert.doesNotMatch(visible(single),/现有婚姻|已有交往对象|已有稳定对象/);
 assert.match(landing(dating).outcomeText,/这段交往/);
 assert.match(landing(married).outcomeText,/现有关系|婚姻/);
 assert.doesNotMatch(visible(married),/认识到|认识有好感|互有好感|有好感之后|走向明确交往|关系已经确定/);
 for(const adapted of [single,dating,married]){
  assert.deepEqual(adapted.verdicts.map(v=>v.semanticKey).sort(),original.verdicts.map(v=>v.semanticKey).sort());
  for(const v of adapted.verdicts){
   const source=original.verdicts.find(row=>row.semanticKey===v.semanticKey);
   assert.deepEqual(v.basis,source.basis);
   assert.equal(v.sourceText,source.sourceText);
  }
  assert.doesNotMatch(visible(adapted),/必定|一定结婚|必然离婚|闪婚|多婚|出轨|医院|治疗|心脏|肝脏/);
 }
});

test('relationship status neither overrides the minor boundary nor creates missing spouse evidence',()=>{
 const minorBase=relationship({status:'student',age:16});
 for(const relationshipStatus of states){
  const n=relationship({status:'student',age:16,relationshipStatus});
  assert.deepEqual(n,minorBase);
  assert.equal(n.sectionTitle,'相处与沟通');
  assert.ok(landing(n).detailOnly);
 }
 for(const age of [null,undefined,'',NaN,Infinity])assert.deepEqual(relationship({age,relationshipStatus:'married'}),relationship({age}));
 const f=fixture({relationshipStatus:'single'});f.relationship.spouseStar={quality:{},occurrences:[]};
 const n=Report.buildNarratives(f).relationship;
 assert.ok(landing(n).detailOnly);assert.equal(landing(n).outcomeText,'');
});

test('annual wording adapts only a supported current-year relationship outcome, preserving its type and direction',()=>{
 const rec=record('relationship');
 for(const triggers of [[{type:'六合',target:'day'}],[{type:'六冲',target:'day'}]]){
  const unknown=yearWith([rec],2026,triggers),baseline=Report.__test.describeTimingEvent(rec,unknown.eventAdjudication,unknown.lifeContext,unknown);
  for(const relationshipStatus of ['single','dating','married']){
   const y=yearWith([rec],2026,triggers,{relationshipStatus});
   const before=JSON.stringify(y),event=Report.__test.describeTimingEvent(rec,y.eventAdjudication,y.lifeContext,y);
   assert.equal(event.eventType,baseline.eventType);assert.equal(event.supportLevel,baseline.supportLevel);assert.equal(event.outcomeScope,baseline.outcomeScope);
   assert.equal(JSON.stringify(y),before);
   if(relationshipStatus==='single')assert.match(event.scenario,/^若(?:认识|开始)/);
   if(relationshipStatus==='married'){assert.match(event.scenario,/现有婚姻/);assert.doesNotMatch(event.scenario,/互有好感|明确交往|交往对象|刚开始接触/);}
  }
 }
 const noTrigger=yearWith([rec],2026,[],{relationshipStatus:'married'});
 const weak=Report.__test.describeTimingEvent(rec,noTrigger.eventAdjudication,noTrigger.lifeContext,noTrigger);
 assert.equal(weak.outcomeScope,'process');assert.doesNotMatch(weak.scenario,/现有婚姻/);
 const future=yearWith([rec],2027,[{type:'六合',target:'day'}],{relationshipStatus:'married'});
 assert.doesNotMatch(Report.__test.describeTimingEvent(rec,future.eventAdjudication,future.lifeContext,future).scenario,/现有婚姻/);
});

test('specialized combined-and-conflicting relationship outcomes retain both signals after status adaptation',()=>{
 const rec=record('relationship',{direction:'偏不利',reportScenario:'联系加深的原解释',reportLabel:'联系加深',reportEventType:'relationship-bond-closer',reportMechanismKey:'rule:combine-connects'});
 for(const relationshipStatus of ['single','dating','married']){
  const y=yearWith([rec],2026,[{type:'六合',target:'day'},{type:'六冲',target:'day'}],{relationshipStatus});
  const event=Report.__test.describeTimingEvent(rec,y.eventAdjudication,y.lifeContext,y);
  assert.equal(event.eventType,'relationship-bond-with-conflict');
  assert.match(event.scenario,/联系加深|靠近|牵连增加/);
  assert.match(event.scenario,/反复|不稳|分歧/);
 }
});

const engine={window:{},console};vm.createContext(engine);
for(const name of ['bazi.js','structural.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name),'utf8'),engine);
const calc=engine.window.BaZiCalculator;
const deps={calculator:calc,structural:engine.window.StructuralAnalysis,chain:engine.window.BaZiChain};
const chart=calc.calculate(1996,6,15,6,'male',12);
const build=(lifeContext,anchorYear=2026)=>Report.buildFacts(chart,'male',{anchorYear,currentYear:2026,lifeContext:{status:'working',...lifeContext},deps});
const ledger=facts=>facts.fiveYear.years.map(y=>({year:y.year,triggers:y.dynamic.triggers,primary:y.eventAdjudication.primaryEvent,secondary:y.eventAdjudication.secondaryEvent,records:y.eventAdjudication.domainRecords}));

test('current status is not applied to past or future years and does not become a history answer',()=>{
 const facts=build({relationshipStatus:'married',priorities:['relationship','career']},2024);
 assert.equal(facts.lifeContext.relationshipStatus,'married');
 for(const y of facts.fiveYear.years){
  assert.equal(y.lifeContext.relationshipStatus,y.year===2026?'married':'unknown');
  assert.equal(y.eventAdjudication.lifeContext.relationshipStatus,y.year===2026?'married':'unknown');
 }
 assert.equal(facts.reportReview,undefined);
});

test('relationship status and priorities leave core, A, parent analysis and original annual ranking unchanged',()=>{
 const baseline=build({}),core=JSON.stringify(baseline.core),grade=baseline.wealth.narrative.grade;
 const parents=JSON.stringify(calc.analyzeParents(chart,'male')),originalLedger=JSON.stringify(ledger(baseline));
 for(const relationshipStatus of states){
  const f=build({relationshipStatus,priorities:['relationship','career']});
  assert.equal(JSON.stringify(f.core),core);
  assert.equal(f.wealth.narrative.grade,grade);
  assert.equal(JSON.stringify(f.wealth.resource),JSON.stringify(baseline.wealth.resource));
  assert.equal(JSON.stringify(calc.analyzeParents(chart,'male')),parents);
  assert.equal(JSON.stringify(ledger(f)),originalLedger);
  assert.deepEqual(Object.keys(Report.buildNarratives(f)),Object.keys(Report.buildNarratives(baseline)));
 }
});

test('preferences never remove content or resurrect an excluded annual explanation',()=>{
 const ordinary=fixture(),preferred=fixture({relationshipStatus:'single',priorities:['relationship','family']});
 assert.deepEqual(Object.keys(Report.buildNarratives(preferred)),Object.keys(Report.buildNarratives(ordinary)));
 const denied=record('relationship',{reportExcluded:true,reportScenario:'已否认的交往解释'});
 const money=record('wealth',{reportScenario:'已有收入兑现线索',reportEventType:'delivery-paid'});
 const y=yearWith([denied,money],2026,[{type:'六合',target:'day'}],preferred.lifeContext);
 preferred.currentYear=y;preferred.fiveYear.years=[y];
 const n=Report.buildNarratives(preferred);
 assert.doesNotMatch(visible(n.currentYear),/已否认的交往解释|现有婚姻|明确交往/);
 assert.match(visible(n.currentYear),/收入/);
 assert.equal(denied.reportExcluded,true);
});

test('career city fallback invites only broad work direction and candidate cities',()=>{
 const n=Report.buildNarratives(fixture()).career;
 const row=n.verdicts.find(v=>v.meaningKey==='career-choice:city-criteria');
 assert.match(row.outcomeText,/工作或专业方向与候选城市/);
 assert.doesNotMatch(row.outcomeText,/按生活偏好|填写收入|日常账单/);
});
