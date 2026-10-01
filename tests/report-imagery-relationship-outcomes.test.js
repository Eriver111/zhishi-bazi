const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Imagery=require('../js/report-imagery');

const states=['student','exam','working','transition','home','retired','unknown'];
const daySignal={type:'合的牵引',target:'day',source:'流年',detail:'合成日支联结依据'};
const report=(life,signals=[daySignal],domain='relationship')=>Imagery.getReportScenario('combine-connects',domain,life,{signals});
const futureClaims=/结婚|婚嫁|领证|离婚|闪婚|多婚|复婚|出轨|必定|一定|保证|医院|治疗|疾病|肝脏|心脏/;

test('adult relationship reports use day-palace evidence across work and study identities',()=>{
 for(const status of states){
  const row=report({status,age:26});
  assert.equal(row.reportEventType,'relationship-bond-closer',status);
  assert.match(row.reportLabel,/感情/);
  assert.match(row.reportBaseline,/^若已有互有好感或正在交往的人/);
  assert.match(row.reportBaseline,/关系如何继续|认真相处/);
  assert.match(row.reportBaseline,/已有稳定关系时/);
  assert.doesNotMatch(row.reportBaseline,/交接|任务|提交|核对答案|备考同伴|同学|作品/);
  assert.doesNotMatch(row.reportBaseline,futureClaims);
  assert.equal(row.meaningKey,`combine-connects:${row.scene}:relationship`);
 }
 assert.equal(report({status:'student',age:18}).reportEventType,'relationship-bond-closer');
});

test('unknown ages and minors do not acquire adult romance or marriage predictions',()=>{
 for(const age of [undefined,null,'','unknown',NaN,Infinity,17,0]){
  const row=report({status:'working',age});
  assert.equal(row.reportEventType,'regular-coordination-started',String(age));
  assert.doesNotMatch(row.reportBaseline,/互有好感|正在交往|稳定关系/);
  assert.doesNotMatch(row.reportBaseline,futureClaims);
 }
 const minor=report({status:'student',age:16});
 assert.match(minor.reportBaseline,/同学|伙伴/);
});

test('generic cooperation and unrelated or inactive evidence cannot be relabeled as romance',()=>{
 const rejected=[
  [],
  [{type:'合的牵引',target:'month',detail:'也提及日支，但此合发生在月柱'}],
  [{type:'合的牵引',detail:'没有日支联结依据'}],
  [{type:'合的牵引',detail:'合作关系接近，日支另有变化'}],
  [{type:'六冲',target:'day'}],
  [{...daySignal,source:'大运'}],
  [{...daySignal,active:false}],
  [{...daySignal,strengthensRisk:false}],
  [{...daySignal,layer:'天干'}]
 ];
 for(const signals of rejected)assert.equal(report({status:'working',age:30},signals).reportEventType,'regular-coordination-started');
 assert.equal(report({status:'working',age:30},[daySignal],'career').reportEventType,'regular-coordination-started');
 const original=Imagery.getReportScenario('combine-connects','relationship',{status:'working',age:30});
 assert.match(original.reportBaseline,/合作对象|固定交接/);
 assert.equal(original.reportEventType,'regular-coordination-started');
});

test('structured day positions and the existing annual-day-combination signal carry report scope',()=>{
 const signals=[
  {type:'合的牵引',targetPillar:'day'},
  {type:'合的牵引',targetPositions:['month','day']},
  {type:'流年合日支'},
  {type:'合的牵引',detail:'流年亥合日支寅，表示关系议题被牵动'}
 ];
 for(const signal of signals)assert.equal(report({status:'exam',age:29},[signal]).reportEventType,'relationship-bond-closer');
 // Explicit target metadata outranks prose that mentions a different palace.
 assert.equal(report({status:'exam',age:29},[{type:'流年合日支',target:'month'}]).reportEventType,'regular-coordination-started');
});

test('candidate pipeline passes only matching mechanism signals and preserves question identity',()=>{
 for(const status of ['working','exam','student']){
  const analysis={reportLifeContext:{status,age:26},triggers:[{type:'六合',target:'day',source:'流年',detail:'合成年度日支联结'}]};
  const before=JSON.stringify(analysis),candidate=Imagery.candidates('relationship',analysis)[0];
  assert.ok(candidate);
  assert.equal(candidate.reportEventType,'relationship-bond-closer');
  const rule=Imagery.rules.find(r=>r.id==='combine-connects');
  const question=Imagery.sceneOutcomes(rule,'relationship',analysis.reportLifeContext)[0];
  assert.equal(candidate.manifestation,question.manifestation.replace('@',':'));
  assert.equal(candidate.label,question.label);
  assert.equal(candidate.detail,question.detail);
  assert.equal(candidate.mechanism_key,'rule:combine-connects');
  assert.equal(JSON.stringify(analysis),before);
 }
 const withoutTarget=Imagery.candidates('relationship',{reportLifeContext:{status:'working',age:30},triggers:[{type:'流年合日支',detail:'流年亥合日支寅，表示关系议题被牵动'}]})[0];
 assert.equal(withoutTarget.reportEventType,'relationship-bond-closer');
 const unrelated=Imagery.candidates('relationship',{reportLifeContext:{status:'working',age:30},triggers:[{type:'合的牵引',target:'month'},{type:'六冲',target:'day'}]});
 assert.equal(unrelated.length,0,'no new mechanism or relationship candidate is manufactured');
});

test('all historical question rows and option identities remain byte-for-byte unchanged',()=>{
 const questions=states.flatMap(status=>Imagery.rules.flatMap(rule=>[...new Set(rule.outcomes.map(o=>o.domain))].flatMap(domain=>Imagery.sceneOutcomes(rule,domain,{status,age:26}))));
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(questions)).digest('hex'),'d399b2a2bf9ce86b0beff6c452996c63c09496eb5840b495a30b675c19d3be44');
});
