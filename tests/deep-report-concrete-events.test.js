const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Imagery=require('../js/report-imagery'),Model=require('../js/calibration-model');
const root=path.join(__dirname,'..');
const candidate=(status,domain='career')=>Imagery.candidates(domain,{triggers:[{type:'枭夺食',detail:'合成年度独立触发'}],reportLifeContext:{status,age:26}})[0];
const event=(option,year=2024,extra={})=>({event_key:'synthetic-'+year,event_year:year,answer:'yes',selected_option:option.key,match_level:'exact',options:[option],...extra});

test('owl/seal questions state an actual returned submission and a missed deadline, not generic affairs',()=>{
 for(const status of ['student','exam','working','transition','home','retired','unknown']){
  const row=candidate(status,['student','exam'].includes(status)?'study':'career');
  assert.match(row.label,/重做.*延期/);assert.match(row.detail,/被退回重做.*延期或未能提交/);
  assert.match(row.detail,/正常修改并按时完成不算/);assert.doesNotMatch(row.label+row.detail,/个人事务|共同任务|主要目标|输出受阻/);
  assert.ok(row.evidence.some(e=>e.includes('偏印实际克制有用食神')));
 }
});

test('all 31 rules expose event results and exclusions in every supported setting',()=>{
 for(const status of ['student','exam','working','transition','home','retired','unknown'])for(const rule of Imagery.rules){
  for(const domain of new Set(rule.outcomes.map(o=>o.domain))){
   const rows=Imagery.sceneOutcomes(rule,domain,{status,age:26});
   for(const row of rows){
    assert.match(row.detail,/不算/,rule.id+' '+status);
    assert.doesNotMatch(row.label+row.detail,/个人事务|共同事务|共同任务|主要目标|阶段成果|任务与协作|\{\w+\}/);
    assert.ok(row.detail.length<=220,'server must not truncate event boundary');
    assert.match(row.manifestation,/:e2$/);assert.doesNotMatch(row.label,/^(枭夺食|伤官见官)·/);
   }
  }
 }
});

test('unknown history does not claim employment and a school event requires a school context',()=>{
 const unknown=candidate('unknown');assert.match(unknown.detail,/作品或申请材料/);assert.doesNotMatch(unknown.detail,/领导|项目交付|岗位/);
 const school=candidate('student','study'),work=candidate('working');
 assert.match(school.detail,/作业、论文/);assert.match(work.detail,/设计稿、方案/);
 assert.notEqual(school.manifestation,work.manifestation);
});

test('broad legacy answers stay unchanged but never confirm new concrete outcomes or common processes',()=>{
 const fresh=candidate('unknown'),old={...fresh,key:fresh.key.replace(':e2',''),manifestation:fresh.manifestation.replace(':e2',''),label:'枭夺食·个人事务或共同任务',detail:'个人事务受阻'};
 const history=[event(old,2021),event(old,2024)],before=JSON.stringify(history),future=[{...fresh,year:2026,hasIndependentAnnualTrigger:true}];
 const profile=Model.buildCalibrationProfile(history,{currentYear:2026}),review=Model.buildReportReview(history,future,{currentYear:2026});
 assert.equal(profile.patterns.length,0);assert.equal(profile.tentativePatterns.length,0);assert.equal(profile.events.length,2);
 assert.equal(review.adjustments.length,0);assert.equal(review.processReferences.length,0);assert.equal(review.history.length,2);
 assert.equal(JSON.stringify(history),before);assert.equal(Model.optionLabel(history[0]).legacyBroad,true);
});

test('only complete concrete agreement enters model weights; partial feedback keeps its original text',()=>{
 const row=candidate('working'),partial=[event(row,2021,{match_level:'partial'}),event(row,2024,{match_level:'partial'})];
 const p=Model.buildCalibrationProfile(partial,{currentYear:2026});assert.equal(p.patterns.length,0);assert.equal(p.events.length,2);
 const exact=Model.buildCalibrationProfile([event(row,2021),event(row,2024)],{currentYear:2026});assert.equal(exact.patterns.length,1);
 assert.equal(Model.optionLabel(event(row)).eventText,row.detail);
});

test('event option keys remain distinct and round trip without server truncation',()=>{
 const keys=new Set();
 for(const status of ['student','exam','working','transition','home','retired','unknown'])for(const rule of Imagery.rules){
  for(const domain of new Set(rule.outcomes.map(o=>o.domain)))for(const o of Imagery.sceneOutcomes(rule,domain,{status,age:26})){
   const m=o.manifestation.replace('@',':'),row={...o,domain,key:domain+':'+rule.id+':'+m,manifestation:m,mechanism_key:'rule:'+rule.id};
   assert.ok(!keys.has(row.key),row.key);keys.add(row.key);
   const saved=Model.normalizeCalibrationOptions([row])[0];assert.equal(saved.key,row.key);assert.equal(saved.manifestation,m);assert.ok(Imagery.describeOption(saved));
  }
 }
});

test('AI and report share the same locked question renderer, with event detail visible before selection',()=>{
 const source=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8');
 assert.match(source,/root\.ZhishiCalibration\.beforeAI = inspectFirstClick/);assert.match(source,/root\.ZhishiCalibration\.beforeReport = beforeReport/);
 assert.match(source,/<strong>'\+escapeHtml\(option.label\)\+'<\/strong><small>'\+escapeHtml\(option.detail\)/);
 assert.doesNotMatch(source,/option\.detail=scenario/);
 const ai=fs.readFileSync(path.join(root,'api/ai-chat.js'),'utf8');assert.match(ai,/每题指定年份、具体对象、可观察行为与结果/);assert.match(ai,/不知道当年在读还是工作时先问当年身份/);
 const server=fs.readFileSync(path.join(root,'lib/supabase.js'),'utf8');assert.match(server,/picked\.eventText\|\|picked\.label/);assert.match(server,/旧版宽泛题反馈/);
});
