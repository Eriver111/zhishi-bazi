const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Imagery=require('../js/report-imagery');
const Model=require('../js/calibration-model');
const states=['student','exam','working','transition','home','retired','unknown'];

test('report wording does not change historical questions or their stored event identities',()=>{
 const rows=states.flatMap(status=>Imagery.rules.flatMap(rule=>[...new Set(rule.outcomes.map(o=>o.domain))].flatMap(domain=>Imagery.sceneOutcomes(rule,domain,{status,age:26}))));
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'d399b2a2bf9ce86b0beff6c452996c63c09496eb5840b495a30b675c19d3be44');
});

test('all 31 mechanisms have separate readable report narratives in seven life settings',()=>{
 const keys=new Set(),allTexts=new Set();
 for(const rule of Imagery.rules){
  const variants=[];
  for(const status of states){
   const domain=rule.outcomes.some(o=>o.domain==='career')?'career':rule.outcomes[0].domain;
   const row=Imagery.getReportScenario(rule.id,domain,{status,age:26});
   assert.ok(row,rule.id+' '+status);assert.ok(row.reportLabel.length>=8);
   assert.ok(row.reportBaseline.length>=40&&row.reportBaseline.length<=200,rule.id+' '+status);
   assert.doesNotMatch(row.reportBaseline+row.reportLabel,/本年可核对|适用前提|不算|待复核|待核|条件性|规则候选|请选择|这一年是否|承载|格局|喜用|印星|食伤|比劫|流通性|\{\w+\}/);
   assert.doesNotMatch(row.reportBaseline,/医院|检查身体|治疗|药物|疾病|癌|肝脏|心脏|受伤|必定|一定能|保证成功/);
   assert.ok(!keys.has(row.meaningKey));keys.add(row.meaningKey);
   variants.push(row.reportBaseline);allTexts.add(row.reportBaseline);
  }
  // Financial manifestations deliberately share the same loss mechanism while
  // separate rules must never collapse into one generic disadvantage sentence.
  assert.ok(new Set(variants).size>=2,rule.id);
 }
 assert.ok(allTexts.size>200,'most settings need their own daily situation, not generic substitution');
 assert.equal(keys.size,31*7);
});

test('school rework, authority conflict and self-imposed delay describe different causes',()=>{
 const get=id=>Imagery.getReportScenario(id,'study',{status:'student',age:16});
 const rework=get('seal-restrains-output'),authority=get('output-controls-officer'),selfDelay=get('seal-overrestricts-output');
 assert.match(rework.reportBaseline,/途中又增加要求|换一种做法/);
 assert.match(authority.reportBaseline,/反驳老师/);
 assert.match(selfDelay.reportBaseline,/还没写完整|截止日期先到了/);
 assert.notEqual(rework.meaningKey,authority.meaningKey);assert.notEqual(rework.meaningKey,selfDelay.meaningKey);
});

test('home and retirement use real non-work scenes instead of relabelled job assessment',()=>{
 for(const status of ['home','retired','unknown'])for(const rule of Imagery.rules){
  const domain=rule.outcomes.some(o=>o.domain==='career')?'career':rule.outcomes[0].domain;
  const r=Imagery.getReportScenario(rule.id,domain,{status,age:55});
  assert.doesNotMatch(r.reportBaseline,/领导|客户|订单|转正|晋升|岗位|招聘方|面试|上司/);
 }
 assert.match(Imagery.getReportScenario('officer-regulates-peers','career',{status:'home'}).reportBaseline,/家务和照料|谁负责哪天/);
 assert.match(Imagery.getReportScenario('combine-connects','relationship',{status:'retired'}).reportBaseline,/共同活动|时间/);
});

test('opposite peer resistance outcomes share an unconfirmed process in the report',()=>{
 const rule=Imagery.rules.find(r=>r.id==='peer-resists-kill');
 const report=Imagery.getReportScenario(rule,'career',{status:'working',age:35});
 const options=Imagery.sceneOutcomes(rule,'career',{status:'working',age:35});
 assert.equal(options.length,2);assert.notEqual(options[0].manifestation,options[1].manifestation);
 assert.match(options[0].detail,/按期|约定期限前/);assert.match(options[1].detail,/超过约定期限|未能交齐/);
 assert.doesNotMatch(report.reportBaseline,/最终完成|最终仍超过|一定扛过|已经完成/);
 assert.match(report.reportBaseline,/负担|分工/);
});

test('unknown identity is not inferred from age and known working identity has no study narrative',()=>{
 const a=Imagery.getReportScenario('seal-supports-self','career',{status:'unknown',age:68});
 const b=Imagery.getReportScenario('seal-supports-self','career',{status:'unknown',age:30});
 assert.equal(a.scene,'daily');assert.equal(a.reportBaseline,b.reportBaseline);
 assert.equal(Imagery.getReportScenario('seal-supports-self','study',{status:'working',age:30}),null);
 assert.equal(Imagery.getReportScenario('seal-supports-self','career',{status:'unknown',age:12}).scene,'student');
 assert.equal(Imagery.getReportScenario('missing-rule','career',{status:'working'}),null);
 assert.ok(Imagery.getReportScenario('seal-supports-self','study',null),'legacy candidates with no life context retain a neutral report narrative');
});

test('historical learning context remains conditional and cannot borrow current employment',()=>{
 const a=Imagery.getReportScenario('output-controls-officer','study',{status:'unknown',age:38,historical:true});
 assert.equal(a.scene,'exam');assert.match(a.reportBaseline,/^若当时仍在学习或备考/);assert.doesNotMatch(a.reportBaseline,/负责人安排|工作/);
});

test('candidate report prose and calibration question are separate fields with stable mechanism keys',()=>{
 const a={triggers:[{type:'枭夺食',detail:'合成年度独立触发'}],reportLifeContext:{status:'student',age:16}};
 const before=JSON.stringify(a),row=Imagery.candidates('study',a)[0];
 assert.equal(row.mechanism_key,'rule:seal-restrains-output');
 assert.match(row.detail,/正常修改并按时完成不算/);
 assert.doesNotMatch(row.reportBaseline,/不算|前提|是否/);
 assert.equal(row.meaningKey,'seal-restrains-output:student:study');
 assert.notEqual(row.reportBaseline,row.detail);assert.equal(JSON.stringify(a),before);
});

test('wealth branches describe cash exposure separately from learning disruption',()=>{
 const life={status:'student',age:22};
 const learning=Imagery.getReportScenario('wealth-breaks-seal','study',life);
 const cash=Imagery.getReportScenario('wealth-breaks-seal','wealth',life);
 assert.match(learning.reportBaseline,/学业|复习/);assert.match(cash.reportBaseline,/退回|费用/);
 assert.notEqual(learning.reportBaseline,cash.reportBaseline);assert.notEqual(learning.meaningKey,cash.meaningKey);
});

test('direct report helper also respects the existing minor finance boundary',()=>{
 for(const id of ['output-generates-wealth','wealth-generates-officer','wealth-feeds-kill','officer-protects-wealth','peer-takes-wealth','peer-carries-wealth']){
  for(const domain of ['career','study','wealth'])assert.equal(Imagery.getReportScenario(id,domain,{status:'student',age:15}),null,id+' '+domain);
 }
 assert.ok(Imagery.getReportScenario('wealth-breaks-seal','wealth',{status:'student',age:15}));
});

test('review model retains report scene and meaning identity without changing event identity',()=>{
 const option=Imagery.candidates('study',{triggers:[{type:'枭夺食',detail:'合成独立触发'}],reportLifeContext:{status:'student',age:20}})[0];
 const candidate={...option,year:2027,hasIndependentAnnualTrigger:true};
 const review=Model.buildReportReview([], [candidate], {currentYear:2026});
 assert.equal(review.candidates.length,1);
 const saved=review.candidates[0];
 for(const key of ['meaningKey','scene','reportBaseline','reportLabel','key','manifestation','mechanism_key'])assert.equal(saved[key],candidate[key],key);
 assert.equal(review.adjustments.length,0);
});
