'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Imagery=require('../js/report-imagery');
const c={console,Date,Math};c.window=c;vm.createContext(c);
for(const file of ['bazi.js','bazi-chain.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),c);
function chart(words){return c.BaZiCalculator.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:words[i][0],zhi:words[i][1]}])),'male');}
function graph(words,decade,annual,year=2020){return c.BaZiChain.buildAnnualMechanismGraph(chart(words),{gan:decade[0],zhi:decade[1]},{gan:annual[0],zhi:annual[1],year});}
const route=(g,ids)=>g.paths.find(p=>p.nodeIds.join('>')===ids);
const constraints=(g,p)=>p.constraintIds.map(id=>g.constraintsById[id]);
const career=['丁丑','辛亥','丁巳','戊申'],wealth=['丁卯','丁未','丙戌','戊子'];

test('a yearly stem and its actual branch carrier can form a missing kill-seal-self relation without proving an event',()=>{
 const g=graph(career,'戊申','癸卯',2023),p=route(g,'annual.gan>annual.hidden.0>day.gan');
 assert.ok(p);assert.equal(p.kind,'officer-seal-self');assert.equal(p.temporalStatus,'annual-new-route');
 assert.equal(p.eventEstablished,false);assert.equal(p.effectEstablished,false);assert.notEqual(p.stage,'effective');
 assert.ok(constraints(g,p).some(x=>x.type==='stem-binding-contact'),'癸与实际戊合，不得漏掉争合/牵制');
 assert.ok(!route(graph(career,'戊申','癸酉',2023),'annual.gan>annual.hidden.0>day.gan'),'换掉印的载体不能保留原通路');
});

test('year-to-decade-to-natal direction uses the exact decade, never the first matching global role',()=>{
 const g=graph(wealth,'甲辰','壬寅',2022),p=route(g,'annual.gan>dayun.gan>day.gan');
 assert.ok(p);assert.deepEqual(Array.from(p.participantScopes),['annual','dayun','natal']);
 assert.ok(!route(graph(wealth,'庚申','壬寅',2022),'annual.gan>dayun.gan>day.gan'));
 assert.ok(g.edges.some(e=>e.type==='生'&&e.fromNodeId==='annual.gan'&&e.toNodeId==='dayun.gan'));
});

test('an annual carrier repeating a decade route is additional evidence, not a newly invented yearly route',()=>{
 const words=['丙寅','丁酉','丁卯','丙午'];
 const g=graph(words,'庚子','庚子'),p=route(g,'annual.hidden.0>day.hidden.0>day.gan');
 assert.ok(p);assert.equal(p.temporalStatus,'annual-additional-carrier');
 assert.ok(p.preAnnualEquivalentPathIds.length);
 assert.ok(p.preAnnualEquivalentPathIds.every(id=>g.preAnnualPaths.some(x=>x.id===id)));
 assert.equal(route(g,'dayun.hidden.0>day.hidden.0>day.gan').temporalStatus,'decade-background');
 assert.equal(route(graph(words,'戊戌','庚子'),'annual.hidden.0>day.hidden.0>day.gan').temporalStatus,'annual-new-route');
});

test('annual counteraction retains the original incomplete stage rather than declaring a past conflict resolved',()=>{
 const words=['壬申','癸卯','己酉','丁卯'];
 const g=graph(words,'辛丑','戊戌',2018),p=g.counteractions.find(p=>p.nodeIds.join('>')==='annual.gan>month.gan>hour.gan');
 assert.ok(p);assert.equal(p.mechanismName,'财破印');assert.equal(p.originalActionStage,'partial');
 assert.equal(p.stage,'counteraction-contact');assert.equal(p.effectEstablished,false);assert.equal(p.eventEstablished,false);
 assert.ok(!graph(words,'辛丑','乙亥',2018).counteractions.some(x=>x.nodeIds.join('>')==='annual.gan>month.gan>hour.gan'));
 assert.ok(p.constraintIds.length,'不能漏掉同时五合、受克或根载体受动等竞争关系');
});

test('main-qi branch aliases and repeated literal branches never multiply carrier weight',()=>{
 const g=graph(['壬子','庚子','甲子','壬子'],'庚子','癸子');
 for(const p of g.paths.concat(g.counteractions))for(const id of p.carrierEvidenceIds){
  const evidence=g.carrierEvidenceById[id];
  assert.equal(new Set(evidence.rootIds).size,evidence.rootIds.length);
  assert.ok(evidence.rootIds.every(id=>g.nodes.find(n=>n.id===id)?.layer==='hidden'));
  assert.equal(evidence.rootPowerSummed,false);
 }
 assert.ok(g.nodes.some(n=>n.id==='year.hidden.0'));assert.ok(g.nodes.some(n=>n.id==='month.hidden.0'));
 assert.ok(!g.paths.some(p=>p.nodeIds.some(id=>id.endsWith('.zhi'))));
 assert.equal(g.scoreImpact,0);
});

test('a new wealth entry can connect to the natal officer-seal-self sequence while keeping its competing control edge',()=>{
 const words=['癸亥','甲寅','丙子','甲午'],g=graph(words,'戊午','庚子',2020);
 const p=route(g,'annual.gan>year.gan>month.gan>day.gan');
 assert.ok(p);assert.equal(p.kind,'wealth-officer-seal-self');assert.equal(p.temporalStatus,'annual-new-route');
 assert.ok(constraints(g,p).some(x=>x.type==='intra-path-control-contact'&&g.edges.find(e=>e.id===x.edgeId)?.toNodeId==='month.gan'));
 assert.equal(p.effectEstablished,false);assert.equal(p.stage,'relation');
 assert.ok(constraints(g,p).some(x=>x.type==='no-literal-root'&&x.nodeId==='annual.gan'),'庚金无原局或岁运根，不可把顺生关系标为作用已成立');
 assert.ok(!route(graph(words,'戊午','壬子',2020),'annual.gan>year.gan>month.gan>day.gan'));
});

test('adjacent public case years retain different binding targets without turning them into hiring or dismissal labels',()=>{
 const words=['辛酉','乙未','丙午','丙申'];
 const a=graph(words,'壬辰','庚寅',2010),b=graph(words,'壬辰','辛卯',2011);
 const p=route(a,'annual.gan>dayun.gan>month.gan>day.gan'),q=route(b,'annual.gan>dayun.gan>month.gan>day.gan');
 assert.ok(p&&q);assert.equal(p.temporalStatus,'annual-additional-carrier');assert.equal(q.temporalStatus,'annual-additional-carrier');
 const combines=g=>g.edges.filter(e=>e.type==='天干五合'&&(e.fromNodeId==='annual.gan'||e.toNodeId==='annual.gan'));
 assert.ok(combines(a).some(e=>[e.fromNodeId,e.toNodeId].includes('month.gan')));
 assert.ok(combines(b).some(e=>[e.fromNodeId,e.toNodeId].includes('day.gan')));
 assert.equal(p.eventEstablished,false);assert.equal(q.eventEstablished,false);
});

test('each reported path owns a contiguous directed edge sequence and all references resolve',()=>{
 for(const g of [graph(career,'戊申','癸卯'),graph(wealth,'甲辰','壬寅'),graph(['壬申','癸卯','己酉','丁卯'],'辛丑','戊戌')]){
  const ids=new Set(g.nodes.map(n=>n.id));assert.equal(ids.size,g.nodes.length);
  assert.equal(new Set(g.edges.map(e=>e.id)).size,g.edges.length);
  for(const p of g.paths.concat(g.counteractions,g.preAnnualPaths)){
   assert.equal(p.nodeIds.length,p.edgeIds.length+1);
   p.edgeIds.forEach((id,i)=>{const e=g.edges.find(e=>e.id===id);assert.ok(e);assert.equal(e.fromNodeId,p.nodeIds[i]);assert.equal(e.toNodeId,p.nodeIds[i+1]);});
   assert.ok(p.nodeIds.every(id=>ids.has(id)));
  }
 }
});

test('new structure is visible to audits but cannot by itself produce a professional episode',()=>{
 const g=graph(career,'戊申','癸卯'),analysis={annualMechanismGraph:g};
 assert.ok(Imagery.auditAnnualStructure(analysis).length);
 assert.ok(Imagery.auditActivations(analysis).every(a=>a.activated===false));
 for(const domain of ['career','wealth','study','relationship','family'])assert.deepEqual(Imagery.candidates(domain,analysis),[]);
 assert.deepEqual(Imagery.collectSignals(analysis),[]);
});

test('existing imagery results and all core decisions stay identical when the new graph is merely attached',()=>{
 const b=chart(career),y=c.BaZiCalculator.getYongJi(b),before=JSON.stringify({b,y,strength:c.BaZiCalculator.calcDayMasterStrength(b)});
 const a=c.BaZiChain.analyzeLiuNian(b,{gan:'戊',zhi:'申'},{gan:'癸',zhi:'卯',year:2023},y,{age:26});
 a.reportMechanismContext={chain:c.BaZiChain.analyze(b),yongJi:y};
 const withGraph=JSON.stringify(Imagery.candidates('career',a)),without={...a};delete without.annualMechanismGraph;
 assert.equal(JSON.stringify(Imagery.candidates('career',without)),withGraph);
 assert.equal(JSON.stringify({b,y,strength:c.BaZiCalculator.calcDayMasterStrength(b)}),before);
 const rescored=c.BaZiChain.buildAnnualEventAdjudication(b,{gan:'戊',zhi:'申'},{gan:'癸',zhi:'卯',year:2023},without,{age:26});
 assert.equal(JSON.stringify(a.eventAdjudication),JSON.stringify(rescored));
});

test('across ten annual stems, roles and source directions come from the current stem rather than a case identifier',()=>{
 const b=chart(wealth),original=JSON.stringify(b);
 for(const gan of '甲乙丙丁戊己庚辛壬癸'){
  const g=c.BaZiChain.buildAnnualMechanismGraph(b,{gan:'甲',zhi:'辰'},{gan,zhi:'寅',year:2022});
  assert.equal(g.nodes.find(n=>n.id==='annual.gan').shiShen,c.BaZiCalculator.getShiShen(b.day.gan,gan));
  const p=route(g,'annual.gan>dayun.gan>day.gan');assert.equal(!!p,['壬','癸'].includes(gan));
  assert.ok(g.paths.every(p=>p.effectEstablished===false&&p.eventEstablished===false));
 }
 assert.equal(JSON.stringify(b),original);
});

test('full audits are lazy runtime data, while ordinary annual JSON and spreads keep their previous size contract',()=>{
 const b=chart(career),dy={gan:'戊',zhi:'申'},ln={gan:'癸',zhi:'卯',year:2023};
 const a=c.BaZiChain.analyzeLiuNian(b,dy,ln,c.BaZiCalculator.getYongJi(b));
 assert.equal(Object.getOwnPropertyDescriptor(a,'annualMechanismGraph').enumerable,false);
 assert.equal({...a}.annualMechanismGraph,undefined);
 assert.ok(!JSON.stringify(a).includes('annualMechanismGraph'));
 b.year.gan='壬';dy.gan='壬';ln.gan='壬';
 const g=a.annualMechanismGraph;assert.equal(g.nodes.find(n=>n.id==='year.gan').char,'丁');
 assert.equal(g.nodes.find(n=>n.id==='dayun.gan').char,'戊');assert.equal(g.nodes.find(n=>n.id==='annual.gan').char,'癸');
 assert.equal(a.annualMechanismGraph,g);assert.ok(JSON.stringify(g).includes('temporal-structure-audit'));
});

test('48 calendar-generated charts retain frozen core decisions and valid unscored temporal evidence',()=>{
 for(let i=0;i<48;i++){
  const b=c.BaZiCalculator.calculate(1968+i%48,1+i%12,1+(i*7)%27,i%12,i%2?'female':'male');
  const y=c.BaZiCalculator.getYongJi(b),before=JSON.stringify({b,y,strength:c.BaZiCalculator.calcDayMasterStrength(b)});
  const year=2010+i%12,index=(year-4)%60;
  const annual=c.BaZiChain.analyzeLiuNian(b,{gan:'甲乙丙丁戊己庚辛壬癸'[i%10],zhi:'子丑寅卯辰巳午未申酉戌亥'[i%12]},
   {gan:'甲乙丙丁戊己庚辛壬癸'[index%10],zhi:'子丑寅卯辰巳午未申酉戌亥'[index%12],year},y,{age:30});
  const raw=JSON.stringify(annual),g=annual.annualMechanismGraph;
  assert.equal(JSON.stringify(annual),raw);assert.equal(g.scoreImpact,0);
  assert.equal(JSON.stringify({b,y,strength:c.BaZiCalculator.calcDayMasterStrength(b)}),before);
  for(const p of g.paths.concat(g.counteractions)){
   assert.equal(p.effectEstablished,false);assert.equal(p.eventEstablished,false);
   assert.ok(p.carrierEvidenceIds.every(id=>g.carrierEvidenceById[id]));
   assert.ok(p.constraintIds.every(id=>g.constraintsById[id]));
   p.edgeIds.forEach((id,j)=>{const edge=g.edges.find(e=>e.id===id);assert.ok(edge);assert.equal(edge.fromNodeId,p.nodeIds[j]);assert.equal(edge.toNodeId,p.nodeIds[j+1]);});
  }
 }
});
