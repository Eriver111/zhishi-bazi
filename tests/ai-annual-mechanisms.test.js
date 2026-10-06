'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {annualMechanismContext}=require('../lib/ai-annual-mechanisms');
const {enrichRequestedYear}=require('../lib/ai-requested-year');
const {chartEvidenceContext}=require('../lib/ai-chart-evidence');
const {buildConversationEvidence}=require('../lib/ai-conversation-evidence');

function data(words,decade,start,end,birthYear=1981){return {type:'bazi',birthInfo:{year:birthYear},
 fourPillars:Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:words[i][0],zhi:words[i][1]}])),
 daYun:{cycles:[{gan:decade[0],zhi:decade[1],startYear:start,endYear:end}]}};}
const first=data(['癸亥','甲寅','丙子','甲午'],'戊午',2018,2027,1983);
const adjacent=data(['辛酉','乙未','丙午','丙申'],'壬辰',2008,2017);
const graph=(d,year)=>enrichRequestedYear(d,year).timingAdjudication.requestedYear.annualMechanismGraph;

// Run the real message-construction prefix and pure prompt functions in an
// isolated VM. API initialization, authentication, datastore modules and the
// model/network tail are never imported or executed.
const apiSource=fs.readFileSync(path.join(__dirname,'../api/ai-chat.js'),'utf8');
const pureStart=apiSource.indexOf('function validateFrozenYongSelection(');
const pureEnd=apiSource.indexOf('function buildHepanDaYunFactFallback(',pureStart);
const messageStart=apiSource.indexOf('async function callAI(');
const messageEnd=apiSource.indexOf('  // 模拟模式',messageStart);
const chartStart=apiSource.indexOf('function buildChartContext(');
const chartEnd=apiSource.indexOf('function buildLiurenContext(',chartStart);
assert.ok(pureStart>=0&&pureEnd>pureStart&&messageStart>=0&&messageEnd>messageStart&&chartStart>=0&&chartEnd>chartStart);
const sandbox={annualMechanismContext,Date,Intl,
 SYSTEM_PROMPT:'test bazi system',ZIWEI_SYSTEM_PROMPT:'test ziwei system',LIUREN_SYSTEM_PROMPT:'test liuren system',MEDICAL_BOUNDARY:'',
 buildZiweiContext:()=>'',buildLiurenContext:()=>'',buildConversationEvidence,chartEvidenceContext,
 require:name=>{assert.equal(name,'../lib/ai-requested-year.js','unexpected module access');return {enrichRequestedYear};},
 fetch:()=>{throw new Error('network access is not permitted in this pure test');}};
vm.createContext(sandbox);
vm.runInContext(apiSource.slice(pureStart,pureEnd),sandbox);
vm.runInContext(apiSource.slice(chartStart,chartEnd),sandbox);
vm.runInContext(apiSource.slice(messageStart,messageEnd)+'return messages;\n}',sandbox);

test('real annual graph resolves exact roles and prioritizes the yearly competing edge rather than an old natal one',()=>{
 const g=graph(first,2020),before=JSON.stringify(g),text=annualMechanismContext(g);
 const line=text.split('\n').find(line=>line.includes('财→官杀→印→日主'));
 assert.match(line,/流年庚（偏财） → 年柱癸（正官） → 月柱甲（偏印） → 日柱丙（比肩）/);
 assert.match(line,/链内相克：流年庚（偏财）克月柱甲（偏印）/);
 assert.match(line.match(/链内相克：[^；。]*/g)[0],/^链内相克：流年庚/);
 assert.match(line,/未见同五行藏根：流年庚/);assert.match(line,/仅关系存在/);
 assert.match(text,/不是已成立的格局或已发生的事件/);
 assert.equal(JSON.stringify(g),before);
});

test('existing decade routes and additional annual carriers keep separate labels and never become first appearances',()=>{
 const d=data(['丙寅','丁酉','丁卯','丙午'],'庚子',2012,2021,1986),text=annualMechanismContext(graph(d,2020));
 assert.match(text,/已有同类路径，本年增加载体｜官杀→印→日主/);
 assert.match(text,/大运已有背景｜官杀→印→日主/);
 assert.doesNotMatch(text,/本年新增关系路径｜官杀→印→日主/);
 assert.match(text,/岁运根效力尚未结算/);
});

test('counteraction summaries retain incomplete original stages and explain annual status without a relief guarantee',()=>{
 const d=data(['壬申','癸卯','己酉','丁卯'],'辛丑',2011,2020,1992),text=annualMechanismContext(graph(d,2018));
 assert.match(text,/本年新见对原控制源的制约/);
 assert.match(text,/原作用：财破印（条件未齐）/);
 assert.match(text,/触及原控制源，解除未证实/);
 assert.doesNotMatch(text,/annual-counteraction-contact|annual-additional-counteractor/);
});

test('root locations stay literal and are not promoted to fully adjudicated annual carrying power',()=>{
 const text=annualMechanismContext(graph(first,2020));
 assert.match(text,/流年庚（偏财）字面藏根见无（原局0处达根系账本承载条件）/);
 assert.match(text,/字面藏根见/);assert.match(text,/岁运根效力尚未结算/);
 assert.match(text,/现有效力字段为未证实/);
});

test('summary is bounded while disclosing omitted path variants and the complete ledger count',()=>{
 const g=graph(first,2020),p=g.paths[0];
 const many={...g,paths:Array.from({length:17},(_,i)=>({...p,id:'projection-'+i,kind:'projection-'+i})),counteractions:[]};
 const text=annualMechanismContext(many);
 assert.equal(text.split('\n').filter(line=>line.includes('｜')).length,10);
 assert.match(text,/完整审计有17条路径\/制约候选，本段按类型和年度来源摘要10条/);
 assert.match(text,/未展示变体不能当作不存在/);
 assert.match(text,/数量不是独立证据票数或事件概率/);
 assert.ok(text.length<12000);
});

test('malformed graphs and broken path references cannot turn unresolved IDs into factual prompt prose',()=>{
 for(const input of [null,{}, {scope:'temporal-structure-audit',paths:[null],edges:[],nodes:{}}, {scope:'another-graph',paths:[],edges:[]}])
  assert.equal(annualMechanismContext(input),'');
 const g=graph(first,2020),p=g.paths[0];
 assert.equal(annualMechanismContext({...g,paths:[{...p,nodeIds:['missing','also-missing']}],counteractions:[]}),'');
 const mixed=annualMechanismContext({...g,paths:[p,{...p,id:'bad',edgeIds:['missing-edge']}],counteractions:[]});
 assert.match(mixed,/1条缺少有效节点或连续边，未用作依据/);
 assert.doesNotMatch(mixed,/missing-edge/);
});

test('missing constraint references are reported as missing rather than silently proving an unobstructed route',()=>{
 const g=graph(first,2020),p=g.paths[0];
 const text=annualMechanismContext({...g,paths:[{...p,constraintIds:['missing']}],counteractions:[]});
 assert.match(text,/部分制约引用缺失，不能按没有制约处理/);
 assert.match(text,/本图未列竞争关系，不等于证明畅通/);
});

test('requested-year recomputation reaches the actual final system message without importing the API runtime',async()=>{
 const before=JSON.stringify(first),question='回看2020年，最突出的具体事件是什么？';
 const messages=await sandbox.callAI(question,first,null,[],'simple','simple',{},null,null);
 const final=messages.find(m=>m.role==='system'&&m.content.startsWith('本轮最终依据'));
 assert.ok(final);assert.match(final.content,/本轮年份强制锚点.*2020年/);
 assert.match(final.content,/岁运补入后的节点通路/);
 assert.match(final.content,/流年庚（偏财）生年柱癸（正官）/);
 assert.match(final.content,/流年庚（偏财）克月柱甲（偏印）/);
 assert.match(final.content,/未见同五行藏根：流年庚/);
 assert.equal(messages.at(-1).role,'user');assert.equal(messages.at(-1).content,question);
 assert.equal(JSON.stringify(first),before);
});

test('adjacent requested years carry their actual different binding targets all the way to the final message',async()=>{
 const messages2010=await sandbox.callAI('回看2010年具体发生什么事？',adjacent,null,[],'simple','simple',{},null,null);
 const messages2011=await sandbox.callAI('回看2011年具体发生什么事？',adjacent,null,[],'simple','simple',{},null,null);
 const final=list=>list.find(m=>m.role==='system'&&m.content.startsWith('本轮最终依据')).content;
 assert.match(final(messages2010),/流年庚与月柱乙五合/);
 assert.match(final(messages2011),/流年辛与日柱丙五合/);
 assert.match(final(messages2010),/已有同类路径，本年增加载体｜财→官杀→印→日主/);
 assert.match(final(messages2011),/已有同类路径，本年增加载体｜财→官杀→印→日主/);
 assert.doesNotMatch(final(messages2010),/流年辛与日柱丙五合/);
 assert.doesNotMatch(final(messages2011),/流年庚与月柱乙五合/);
});

test('out-of-range requests cannot reuse another year graph, and non-bazi modes do not run this reconstruction',async()=>{
 const stale=enrichRequestedYear(first,2020);
 const wrong=sandbox.buildTimingAdjudicationBrief('回看2010年发生什么事？',stale);
 assert.doesNotMatch(wrong,/岁运补入后的节点通路/);
 const messages=await sandbox.callAI('回看2010年发生什么事？',stale,null,[],'simple','simple',{},null,null);
 assert.doesNotMatch(messages.map(m=>m.content).join('\n'),/流年庚（偏财）生年柱癸（正官）/);
 for(const mode of ['ziwei','liuren']){
  const list=await sandbox.callAI('回看2020年发生什么事？',{...first,type:mode},null,[],mode,'simple',{},null,null);
  assert.doesNotMatch(list.map(m=>m.content).join('\n'),/岁运补入后的节点通路/);
 }
});

test('real-case summaries remain small without dropping the distinction between relations and realized events',()=>{
 for(const [d,years] of [[first,[2019,2020,2021]],[adjacent,[2009,2010,2011,2012]]])for(const year of years){
  const text=annualMechanismContext(graph(d,year));
  assert.ok(text.length>300&&text.length<8000,year+': '+text.length);
  assert.match(text,/财生官印不是必然录用/);
  assert.match(text,/不得把候选通路写成已经解除风险/);
 }
});

test('complete graph enrichment does not serialize the raw audit through ordinary chart context or actual message construction',async()=>{
 const enriched=enrichRequestedYear(first,2020);
 const full=enriched.timingAdjudication.requestedYear.annualMechanismGraph;
 assert.ok(JSON.stringify(full).length>10000,'fixture contains a substantial complete graph');
 const without=JSON.parse(JSON.stringify(enriched));
 delete without.timingAdjudication.requestedYear.annualMechanismGraph;
 assert.equal(sandbox.buildChartContext(enriched),sandbox.buildChartContext(without));
 const messages=await sandbox.callAI('回看2020年发生什么事？',enriched,null,[],'simple','simple',{},null,null);
 const text=messages.map(m=>m.content).join('\n');
 assert.match(text,/岁运补入后的节点通路/);
 assert.equal(text.split('岁运补入后的节点通路').length-1,1,'one final evidence summary, not duplicated before history');
 assert.doesNotMatch(text,/annualMechanismGraph|carrierEvidenceById|constraintsById|preAnnualEquivalentPathIds|"scope":"temporal-structure-audit"/);
 assert.ok(!text.includes(JSON.stringify(full)),'the audit is never copied as raw JSON');
});
