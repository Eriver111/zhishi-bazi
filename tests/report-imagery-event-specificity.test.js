const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Imagery=require('../js/report-imagery');

const states=['student','exam','working','transition','home','retired','unknown'];
const events={
 'wealth-breaks-seal':'preparation-suspended',
 'peer-takes-wealth':'shared-payment-delayed',
 'output-controls-officer':'authority-dispute',
 'seal-restrains-output':'submission-rework',
 'officer-pressure':'deadline-task-added',
 'peer-resists-kill':'extra-effort-shared',
 'peer-carries-wealth':'cost-shared',
 'seal-transforms-kill':'guided-resubmission',
 'officer-seal-support':'formal-eligibility-reviewed',
 'food-controls-kill':'difficult-step-completed',
 'output-controls-kill':'demonstration-reopens-discussion',
 'hurt-combines-kill':'terms-adjusted',
 'blade-joins-kill':'urgent-gap-taken-over',
 'seal-guides-output':'draft-structured',
 'output-generates-wealth':'delivery-paid',
 'wealth-generates-officer':'responsibility-assigned',
 'wealth-feeds-kill':'commitment-expanded',
 'officer-protects-wealth':'disputed-payment-settled',
 'wealth-regulates-seal':'first-submission-made',
 'seal-supports-self':'instruction-unblocks-step',
 'seal-overrestricts-output':'self-delayed-submission',
 'output-drains-self':'later-arrangement-postponed',
 'peer-through-output':'shared-delivery',
 'officer-regulates-peers':'division-adjusted',
 'output-regulates-officer':'repeated-step-removed',
 'wealth-officer-seal-flow':'supported-participation',
 'clash-releases-obstruction':'changed-arrangement-unblocks',
 'clash-damages-support':'agreed-support-cancelled',
 'combine-connects':'regular-coordination-started',
 'punishment-rework':'same-issue-rework',
 'recurrence-revisits':'earlier-item-reopened'
};
const get=(id,status='working',domain='career',age=32)=>Imagery.getReportScenario(id,domain,{status,age});
const domainFor=rule=>rule.outcomes.some(o=>o.domain==='career')?'career':rule.outcomes[0].domain;

test('report event taxonomy is complete and preserves old meaning, scene and question contracts',()=>{
 assert.deepEqual(Object.keys(events).sort(),Imagery.rules.map(r=>r.id).sort());
 const before=JSON.stringify(Imagery.rules);
 const eventTypes=new Set();
 for(const rule of Imagery.rules)for(const status of states){
  const domain=domainFor(rule),row=get(rule.id,status,domain);
  const expected=rule.id==='wealth-breaks-seal'?'money-loss-or-payment-impaired':events[rule.id];
  assert.equal(row.reportEventType,expected,rule.id+' '+status);
  assert.equal(row.meaningKey,`${rule.id}:${row.scene}:${domain}`);
  assert.ok(row.reportLabel&&row.reportBaseline);
  assert.match(row.reportBaseline,/容易|可能|有望|机会/,rule.id+' '+status+' remains a hypothesis');
  assert.doesNotMatch(row.reportLabel,/怎么|怎样|关键|要留|要防|能不能|几件急事|比.*有用/);
  assert.doesNotMatch(row.reportBaseline,/这里要|重点是|关键在|需要留意|要看|最需要防|不必每次|一定|必定|必然|保证/);
  eventTypes.add(row.reportEventType);
 }
 assert.equal(eventTypes.size,31);
 assert.equal(JSON.stringify(Imagery.rules),before);
 const questions=states.flatMap(status=>Imagery.rules.flatMap(rule=>[...new Set(rule.outcomes.map(o=>o.domain))].flatMap(domain=>Imagery.sceneOutcomes(rule,domain,{status,age:26}))));
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(questions)).digest('hex'),'d399b2a2bf9ce86b0beff6c452996c63c09496eb5840b495a30b675c19d3be44');
});

test('returned work rework, self-delayed draft, added deadline and exhausted follow-up are distinguishable events',()=>{
 const returned=get('seal-restrains-output');
 const held=get('seal-overrestricts-output');
 const added=get('officer-pressure');
 const drained=get('output-drains-self');
 assert.match(returned.reportBaseline,/方案|设计稿|成品/);
 assert.match(returned.reportBaseline,/新增审核要求被退回重做/);
 assert.match(returned.reportBaseline,/验收日期可能延后/);
 assert.match(held.reportBaseline,/自己手里|迟迟没有交出初稿/);
 assert.match(held.reportBaseline,/审核日期可能错过/);
 assert.doesNotMatch(held.reportBaseline,/被退回/);
 assert.match(added.reportBaseline,/临时追加任务|提高验收要求/);
 assert.match(added.reportBaseline,/原期限保持不变/);
 assert.match(added.reportBaseline,/加时|后面的交付/);
 assert.match(drained.reportBaseline,/连续赶交付/);
 assert.match(drained.reportBaseline,/已经答应的提交或约见可能延期/);
 assert.equal(new Set([returned,held,added,drained].map(r=>r.reportEventType)).size,4);
});

test('authority dispute names the dispute, affected submission and consequence across settings',()=>{
 const objects=[/作业|参赛/,/材料|报名/,/方案|交付/,/作品|申请/,/材料|证件/,/手续|活动/,/申请|材料/];
 states.forEach((status,i)=>{
  const row=get('output-controls-officer',status);
  assert.match(row.reportLabel,/争执/);
  assert.match(row.reportBaseline,/争执/);
  assert.match(row.reportBaseline,objects[i]);
  assert.match(row.reportBaseline,/卡住|搁下|暂缓|中断|停下|停住/);
  assert.doesNotMatch(row.reportBaseline,/开除|辞退|取消资格|失业/);
 });
});

test('pressure is an added deadline requirement and has setting-specific immediate costs',()=>{
 const objects=[/作业|考核/,/证明材料|练习/,/项目|验收/,/试做|面试/,/手续|照料/,/活动|手续/,/申请|补交/];
 states.forEach((status,i)=>{
  const row=get('officer-pressure',status);
  assert.match(row.reportBaseline,/新增|追加|多出|增加一轮/);
  assert.match(row.reportBaseline,objects[i]);
  assert.match(row.reportBaseline,/期限|限期|截止|放宽/);
  assert.match(row.reportBaseline,/减少|缩短|挤占|改期|延期|加时处理/);
  assert.doesNotMatch(row.reportBaseline,/几件急事|每件都说要优先|同时找上来|每一项都催得急/);
 });
});

test('same mechanism cash and task consequences have separate event types and unchanged domain keys',()=>{
 for(const status of states){
  const tasks=get('wealth-feeds-kill',status,'career');
  const cash=get('wealth-feeds-kill',status,'wealth');
  assert.equal(tasks.reportEventType,'commitment-expanded');
  assert.equal(cash.reportEventType,'additional-payment-required');
  assert.match(tasks.reportBaseline,/作业|材料|验收|手续|任务|提交|试做|证明/);
  assert.match(cash.reportBaseline,/追加|收费|增加.*费用/);
  assert.match(cash.reportBaseline,/预算|金额|付款/);
  assert.notEqual(tasks.meaningKey,cash.meaningKey);
  assert.notEqual(tasks.reportBaseline,cash.reportBaseline);
 }
 for(const status of ['student','exam']){
  const study=get('wealth-breaks-seal',status,'study');
  const cash=get('wealth-breaks-seal',status,'wealth');
  assert.equal(study.reportEventType,'preparation-suspended');
  assert.equal(cash.reportEventType,'money-loss-or-payment-impaired');
  assert.match(study.reportBaseline,/中断|停下/);
  assert.match(cash.reportBaseline,/未按约退回|少收|拖过约定日期/);
  assert.notEqual(study.reportBaseline,cash.reportBaseline);
 }
});

test('reopened matters and changed arrangements retain a prior-event premise without inventing past facts',()=>{
 const objects=[/作业|课程申请/,/报名|资格材料/,/项目|验收/,/申请|试做/,/手续|整理计划/,/报名|申请手续|兴趣作品/,/申请|材料/];
 states.forEach((status,i)=>{
  const old=get('recurrence-revisits',status),change=get('clash-releases-obstruction',status);
  assert.match(old.reportBaseline,/^若此前有/);
  assert.match(old.reportBaseline,objects[i]);
  assert.match(old.reportBaseline,/重新|再次/);
  assert.match(old.reportBaseline,/时间|工作量|分配/);
  assert.match(change.reportBaseline,/^若.*原先卡在/);
  assert.match(change.reportBaseline,/调整|换班|更换/);
  assert.doesNotMatch(old.reportBaseline+change.reportBaseline,/旧病|复发|官司|离婚|合同纠纷/);
 });
});

test('unexpected financial loss stays broader than a cancelled course or one invented business',()=>{
 for(const status of states){
  const cash=get('wealth-breaks-seal',status,'wealth');
  assert.equal(cash.reportEventType,'money-loss-or-payment-impaired');
  assert.match(cash.reportBaseline,/计划外损失/);
  assert.match(cash.reportBaseline,/若有|若已有/);
  assert.match(cash.reportBaseline,/减少|压缩|挤占/);
  assert.match(cash.reportLabel,/有应收款时/);
 }
 for(const status of ['working','home','retired','unknown']){
  const cash=get('wealth-breaks-seal',status,'wealth');
  assert.doesNotMatch(cash.reportBaseline,/课程|培训|考试|资格办理|贷款|经营|客户|订单/);
  assert.match(cash.reportBaseline,/应收|代垫|退款|待退/);
 }
 const school=get('wealth-breaks-seal','student','wealth',15);
 assert.ok(school);
 assert.doesNotMatch(school.reportBaseline,/借贷|经营|贷款|客户|订单|应收报酬/);
});

test('non-working settings and paid-service hypotheses do not manufacture a business, debt or partner',()=>{
 for(const status of ['home','retired','unknown'])for(const rule of Imagery.rules){
  const row=get(rule.id,status,domainFor(rule));
  assert.doesNotMatch(row.reportLabel+row.reportBaseline,/自营|创业|公司|贷款|客户|订单|老板|配偶|丈夫|妻子|伴侣|医院|治疗|确诊|检查身体/);
 }
 for(const status of states){
  const income=get('output-generates-wealth',status,'wealth');
  assert.match(income.reportBaseline,/^若/,'income premise '+status);
  assert.match(income.reportBaseline,/作品|技能|服务|成果/);
  assert.match(income.reportBaseline,/收到.*报酬/);
 }
 assert.match(get('peer-takes-wealth','working','wealth').reportBaseline,/^若有合作分成或代垫费用/);
 assert.match(get('wealth-feeds-kill','working','wealth').reportBaseline,/^若工作或合作中已有/);
 assert.match(get('combine-connects','home','relationship').reportBaseline,/固定来往的人/);
});

test('event type is supplied only after independent evidence and does not select opposite endurance outcomes',()=>{
 assert.deepEqual(Imagery.candidates('career',{reportLifeContext:{status:'working',age:35},reportEventType:'submission-rework'}),[]);
 const analysis={triggers:[{type:'枭夺食',detail:'合成独立年度触发'}],reportLifeContext:{status:'working',age:35}};
 const before=JSON.stringify(analysis),rows=Imagery.candidates('career',analysis);
 assert.equal(rows.length,1);
 assert.equal(rows[0].reportEventType,'submission-rework');
 assert.equal(rows[0].mechanism_key,'rule:seal-restrains-output');
 assert.equal(rows[0].manifestation,'delivery-interrupted:work:e2');
 assert.match(rows[0].detail,/不算/);
 assert.doesNotMatch(rows[0].reportBaseline,/不算|是否/);
 assert.equal(JSON.stringify(analysis),before);
 const endurance=get('peer-resists-kill');
 assert.equal(endurance.reportEventType,'extra-effort-shared');
 assert.doesNotMatch(endurance.reportBaseline,/按期完成|最后完成|最终完成|肯定失败|最终未完成|最终仍超过/);
 assert.match(endurance.reportBaseline,/分担|分工/);
 assert.equal(get('output-generates-wealth','student','wealth',15),null);
});
