'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Imagery=require('../js/report-imagery');
const env={console,Date,Math};env.window=env;vm.createContext(env);
for(const file of ['bazi.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),env);
function node(id,wx,extra={}){return {id,pillar:id.split('.')[0],layer:'gan',char:{木:'乙',火:'丁',土:'己',金:'辛',水:'癸'}[wx],wx,weight:1,effectiveCoefficient:1,...extra};}
function connect(name,a,b,extra={}){const id=name+':'+a.id+'>'+b.id,edgeId='edge:'+id;
 return {mechanism:{id,name,sourceNodeId:a.id,targetNodeId:b.id,sourcePillar:a.pillar,targetPillar:b.pillar,sourceWx:a.wx,targetWx:b.wx,sourceShiShen:a.shiShen,targetShiShen:b.shiShen,
  actionStage:'effective',nodeIds:[a.id,b.id],edgeIds:[edgeId],evidence:['synthetic exact edge'],...extra},
  edge:{id:edgeId,from:a.id,to:b.id,fromNode:a,toNode:b,strength:1,type:/制|克|破|见官/.test(name)?'克':'生'}};}
function reinforce(id){return {source:'流年',type:'天干生',relation:'生',targetLayer:'stem',targetNodeId:id,fromNodeId:'annual.gan',toNodeId:id,detail:'annual actor generates the exact source node'};}
function fixture(){
 const a=node('year.gan','土',{shiShen:'正财'}),b=node('month.gan','木',{shiShen:'正印'}),root=node('month.hidden.0','木',{layer:'hidden',branch:'卯',char:'乙',depth:'本气'});
 const route=connect('财破印',a,b);
 return {triggers:[reinforce('year.gan')],reportLifeContext:{status:'student',age:17},
  reportMechanismContext:{yongJi:{yongShen:['木'],jiShen:['土']},chain:{mechanisms:[],fullMechanisms:[route.mechanism],paths:[],factGraph:{nodes:[a,b,root],edges:[route.edge]}}}};
}
const count=a=>Imagery.candidates('study',a).filter(c=>c.mechanism_key==='rule:wealth-breaks-seal').length;
test('blocked, partial, relation and absent action stages cannot inherit an effective annual event',()=>{
 for(const stage of ['blocked','partial','relation','absent']){const a=fixture();a.reportMechanismContext.chain.fullMechanisms[0].actionStage=stage;assert.equal(count(a),0,stage);}
 assert.equal(count(fixture()),1);
});
test('raw named risks remain auditable but cannot bypass effective node-bound annual evidence',()=>{
 const a={triggers:[{type:'财破印',detail:'legacy named risk'}],reportTriggeredRisks:[{type:'枭夺食',confidence:'high'}]};
 assert.ok(Imagery.collectSignals(a).some(s=>s.type==='财破印'));
 assert.deepEqual(Imagery.candidates('wealth',a),[]);assert.deepEqual(Imagery.candidates('study',a),[]);
 const b=fixture();b.reportMechanismContext.chain.fullMechanisms[0].actionStage='blocked';b.reportTriggeredRisks=[{type:'财破印',active:true}];assert.equal(count(b),0);
});
test('branch trigger must touch the mechanism node or its actual root, not just the same pillar',()=>{
 const a=fixture();a.triggers=[{type:'六冲',target:'month',targetBranch:'卯',source:'流年'}];assert.equal(count(a),0,'disruption alone cannot prove reinforcement');
 const effects=()=>Imagery.auditActivations(a).flatMap(r=>r.activationEffects);assert.ok(effects().some(e=>e.nodeId==='month.gan'&&e.nodeEffect==='disrupts'));
 const root=a.reportMechanismContext.chain.factGraph.nodes[2];root.wx='火';root.char='丁';root.branch='巳';a.triggers[0].targetBranch='巳';assert.equal(effects().length,0,'fire in the same pillar is not a wood root');
 root.wx='木';root.effectiveCoefficient=0;assert.equal(effects().length,0,'destroyed root cannot supply activation');
 root.effectiveCoefficient=1;a.triggers[0].targetBranch='午';assert.equal(effects().length,0,'wrong branch identity');
});
test('actual annual stem identity activates an existing effective mechanism without requiring branch impact',()=>{
 const a=fixture();a.triggers=[];a.annualStemInteractions=[{...reinforce('year.gan'),target:'year',targetStem:'己'}];assert.equal(count(a),1);
 a.annualStemInteractions[0].targetNodeId='hour.gan';assert.equal(count(a),0,'another exposed stem is not the target');
 delete a.annualStemInteractions[0].targetNodeId;assert.equal(count(a),1,'verified target layer and actual stem support older callers');
 a.annualStemInteractions[0].targetStem='甲';assert.equal(count(a),0,'same element is not the same exposed stem');
});
test('decade alone and no annual trigger preserve natal facts without manufacturing the event',()=>{
 const a=fixture();a.triggers[0].source='大运';assert.equal(count(a),0);a.triggers=[];assert.equal(count(a),0);
 a.annualStemInteractions=[{source:'大运',type:'天干克',targetLayer:'stem',targetNodeId:'month.gan'}];assert.equal(count(a),0);
});
test('full evidence is independent of presentation truncation, but requires real graph identities',()=>{
 const a=fixture();assert.equal(a.reportMechanismContext.chain.mechanisms.length,0);assert.equal(count(a),1);
 a.reportMechanismContext.chain.fullMechanisms[0].edgeIds=['not-a-real-edge'];assert.equal(count(a),0);
 const b=fixture();b.reportMechanismContext.chain.fullMechanisms[0].nodeIds=['year.gan','missing'];assert.equal(count(b),0);
});
function pathFixture(){
 const officer=node('year.gan','金',{shiShen:'正官'}),kill=node('hour.gan','金',{shiShen:'七杀'}),seal=node('month.gan','水',{shiShen:'正印'}),self=node('day.gan','木',{shiShen:'比肩'});
 const unrelated=connect('官杀生印',officer,seal),first=connect('官杀生印',kill,seal),last=connect('印生身',seal,self);
 const path={id:'actual-kill-path',name:'官杀经印通关',mechanismIds:[first.mechanism.id,last.mechanism.id],nodeIds:[kill.id,seal.id,self.id],edgeIds:[first.edge.id,last.edge.id],actionStage:'effective',steps:['官杀生印','印生身']};
 return {triggers:[],annualStemInteractions:[reinforce(kill.id)],
  reportMechanismContext:{yongJi:{xiShen:['水']},chain:{mechanisms:[],fullMechanisms:[unrelated.mechanism,first.mechanism,last.mechanism],paths:[path],factGraph:{nodes:[officer,kill,seal,self],edges:[unrelated.edge,first.edge,last.edge]}}}};
}
test('path activation follows its mechanism identities instead of the first officer-seal row',()=>{
 const a=pathFixture(),signals=Imagery.collectSignals(a);
 assert.ok(signals.some(s=>s.type==='杀印相生'));assert.ok(!signals.some(s=>s.type==='官印相生'));
 const chain=a.reportMechanismContext.chain;chain.fullMechanisms.reverse();assert.ok(Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
 chain.fullMechanisms.find(m=>m.name==='印生身').actionStage='partial';assert.ok(!Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
});
test('non-contiguous, missing and decade-only paths cannot borrow another path support',()=>{
 for(const mutate of [a=>a.reportMechanismContext.chain.paths[0].mechanismIds=['missing'],a=>a.reportMechanismContext.chain.fullMechanisms.find(m=>m.name==='印生身').sourceNodeId='year.gan',a=>a.annualStemInteractions[0].source='大运']){
  const a=pathFixture();mutate(a);assert.ok(!Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
 }
});
test('reinforcement, disruption, touching and competing bindings remain distinct for the same actual mechanism',()=>{
 const a=fixture();assert.equal(count(a),1);
 a.triggers[0]={...reinforce('year.gan'),relation:'克',type:'天干克'};assert.equal(count(a),0,'the bad controller is controlled, not reinforced');
 assert.ok(Imagery.auditActivations(a).some(r=>r.activationEffects.some(e=>e.effect==='disrupts')));
 a.triggers[0]={...reinforce('year.gan'),relation:undefined,type:'天干五合'};assert.equal(count(a),0,'bare combination is not reinforcement');
 assert.ok(Imagery.auditActivations(a).some(r=>r.activationEffects.some(e=>e.effect==='touches')));
 a.triggers=[reinforce('year.gan'),{...reinforce('year.gan'),type:'天干五合',relation:undefined,competingTargetNodeIds:['day.gan']}];assert.equal(count(a),0,'competing binding cannot be erased by a favorable contact');
 a.triggers=[reinforce('month.gan')];assert.equal(count(a),0,'strengthening the seal cannot count as strengthening wealth breaking it');
});
test('positive path loses event eligibility when a supporting node is controlled or a real root is disturbed',()=>{
 const a=pathFixture();assert.ok(Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
 a.annualStemInteractions.push({...reinforce('month.gan'),type:'天干克',relation:'克'});assert.ok(!Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
 a.annualStemInteractions.pop();a.reportMechanismContext.chain.factGraph.nodes.push(node('month.hidden.0','水',{layer:'hidden',branch:'子',depth:'本气'}));
 a.triggers=[{source:'流年',type:'六冲',target:'month',targetBranch:'子'}];assert.ok(!Imagery.collectSignals(a).some(s=>s.type==='杀印相生'));
});

test('a named whole-chart pattern cannot relabel a kill-to-seal edge as blade balance, combining or wealth protection',()=>{
 for(const name of ['羊刃驾杀','伤官合杀','官护财','伤官配印']){
  const a=pathFixture();a.reportMechanismContext.pattern={name:name+'格',status:'成格'};
  const chain=a.reportMechanismContext.chain;chain.paths=[];
  chain.fullMechanisms=chain.fullMechanisms.filter(m=>m.name==='官杀生印');
  const signals=Imagery.collectSignals(a);
  assert.ok(!signals.some(s=>s.type===name),name+' must not borrow the kill-to-seal node pair');
 }
});

test('calendar production chart retains its kill-seal path without borrowing it for blade-kill annual outcomes',()=>{
 const words=['辛亥','甲午','丙寅','壬辰'];
 const b=env.BaZiCalculator.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((pos,i)=>[pos,{gan:words[i][0],zhi:words[i][1]}])),'female');
 const yongJi=env.BaZiCalculator.getYongJi(b),chain=env.BaZiChain.analyze(b),pattern=env.BaZiCalculator.getPattern(b);
 const a=env.BaZiChain.analyzeLiuNian(b,{gan:'丙',zhi:'申'},{gan:'乙',zhi:'亥',year:1995},yongJi,{age:24});
 a.reportMechanismContext={chain,yongJi,pattern};
 assert.ok(chain.fullMechanisms.some(m=>m.name==='官杀生印'&&m.sourceNodeId==='hour.gan'&&m.targetNodeId==='month.gan'&&m.actionStage==='effective'));
 assert.ok(chain.paths.some(p=>p.name==='官杀经印通关'));
 assert.ok(!Imagery.collectSignals(a).some(s=>s.origin==='activated-natal'&&s.type==='羊刃驾杀'));
 assert.ok(!Imagery.candidates('career',a).some(c=>c.mechanism_key==='rule:blade-joins-kill'));
});
test('the same effective mechanism changes scene actors without claiming an occupation or changing its evidence',()=>{
 for(const [status,domain] of [['student','study'],['working','wealth'],['retired','wealth']]){const a=fixture();a.reportLifeContext={status,age:35};const before=JSON.stringify(a.reportMechanismContext);
  const rows=Imagery.candidates(domain,a).filter(c=>c.mechanism_key==='rule:wealth-breaks-seal');assert.ok(rows.length,status);assert.equal(JSON.stringify(a.reportMechanismContext),before);}
});
test('120 calendar-generated charts keep full node-bound evidence while presentation stays at six',()=>{
 let beyondSix=0,effectivePaths=0;
 for(let i=0;i<120;i++){
  const b=env.BaZiCalculator.calculate(1970+i%40,1+i%12,1+i*7%27,i%12,i%2?'male':'female');
  const core=JSON.stringify({strength:env.BaZiCalculator.calcDayMasterStrength(b),yongJi:env.BaZiCalculator.getYongJi(b)}),before=JSON.stringify(b);
  const c=env.BaZiChain.analyze(b);assert.ok(c.mechanisms.length<=6);assert.equal(JSON.stringify(b),before);
  assert.equal(JSON.stringify({strength:env.BaZiCalculator.calcDayMasterStrength(b),yongJi:env.BaZiCalculator.getYongJi(b)}),core);
  if(c.fullMechanisms.length>6)beyondSix++;
  for(const m of c.fullMechanisms){assert.ok(c.factGraph.nodes.some(n=>n.id===m.sourceNodeId));assert.ok(c.factGraph.nodes.some(n=>n.id===m.targetNodeId));assert.ok(c.factGraph.edges.some(e=>e.id===m.edgeIds[0]&&e.from===m.sourceNodeId&&e.to===m.targetNodeId));}
  for(const p of c.paths){effectivePaths++;const rows=p.mechanismIds.map(id=>c.fullMechanisms.find(m=>m.id===id));assert.ok(rows.every(m=>m&&m.actionStage==='effective'));assert.ok(rows.every((m,j)=>j===0||rows[j-1].targetNodeId===m.sourceNodeId));}
 }
 assert.ok(beyondSix>0);assert.ok(effectivePaths>0);
});
