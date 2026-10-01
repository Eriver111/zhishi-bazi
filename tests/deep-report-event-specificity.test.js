const test=require('node:test');
const assert=require('node:assert/strict');
const Report=require('../js/deep-report');
const Model=require('../js/calibration-model');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const life={status:'working',age:30};
function rec(domain,scene,extra={}){return {domain,label:domain,direction:'偏不利',hasIndependentAnnualTrigger:true,activationScore:6,scenarioCandidates:[scene],evidence:['合成独立年度依据'],...extra};}
function year(n,records){return {year:n,pillar:{gan:'甲',zhi:'子'},lifeContext:life,eventAdjudication:{lifeContext:life,age:30,domainRecords:records,primaryEvent:records[0],secondaryEvent:records[1]}};}
function facts(rows){return {core:{},wealth:{},relationship:{},study:{},currentYear:rows[0],fiveYear:{years:rows}};}

test('specific supplied event takes precedence over an earlier broad summary without changing the record',()=>{
 const record=rec('career','工作任务增加',{scenarioCandidates:['工作任务增加','交出的方案被退回重做，原定交付时间延后。']});
 const before=JSON.stringify(record);
 assert.match(Report.__test.selectTimingScenario(record,{lifeContext:life}),/被退回重做/);
 const descriptor=Report.__test.describeTimingEvent(record,{lifeContext:life});
 assert.equal(descriptor.eventType,'submission-rework');
 assert.equal(descriptor.label,'交出的内容被退回重做');
 assert.equal(JSON.stringify(record),before);
});

test('report selection fills two eligible events when a top-ranked theme has no annual trigger',()=>{
 const rows=[rec('career','只有年度主题',{hasIndependentAnnualTrigger:false,activationScore:8}),
   rec('relationship','已经约定的事临时取消'),
   rec('change','环境或节奏变化明显，结果取决于准备程度',{evidence:['驿马临流年，外出与移动议题被引动']})];
 const n=Report.buildNarratives(facts([year(2028,rows)])).currentYear;
 assert.equal(n.verdicts.length,2);
 assert.match(n.verdicts[1].outcomeText,/临时外出|往返/);
 assert.doesNotMatch(n.verdicts[1].outcomeText,/搬家|长期居住|移民|车祸/);
 assert.equal(n.verdicts[1].supportLevel,'process');
 assert.equal(n.verdicts[1].detailOnly,true);
 assert.doesNotMatch(n.headline,/出行与往返安排改变/);
});

test('family-domain pressure does not invent illness, caregiving or a money event',()=>{
 const d=Report.__test.describeTimingEvent(rec('family','家庭责任、长辈事务或居住安排更容易形成压力'),{lifeContext:life});
 assert.equal(d.supportLevel,'domain');
 assert.doesNotMatch(d.scenario,/身体|疾病|照顾|照应|住院|收入中断|共同开支|钱|费用/);
 assert.match(d.scenario,/分工|需要你处理/);
});

test('generic change direction cannot pick relocation, travel expenses or illness from thin air',()=>{
 const d=Report.__test.describeTimingEvent(rec('change','变动成本和计划反复更值得防范'),{lifeContext:life});
 assert.equal(d.supportLevel,'domain');
 assert.doesNotMatch(d.scenario,/搬家|住处|出行|交通|费用|身体|疾病/);
 assert.match(d.scenario,/安排|准备/);
});

test('dedicated event identity and title survive calibration into current-year and five-year output',()=>{
 const candidate={key:'delivery',year:2026,domain:'career',mechanism_key:'rule:seal-restrains-output',manifestation:'career:rework:e2',
   label:'作品提交',detail:'这一年是否交付被打断？',hasIndependentAnnualTrigger:true,evidence:['合成作用依据'],
   reportBaseline:'交出的方案容易被退回重做，原定交付时间延后。',reportLabel:'交付被退回，原定时间延后',reportEventType:'submission-rework',meaningKey:'owl:working:career'};
 const review=Model.buildReportReview([], [candidate]);
 assert.equal(review.candidates[0].reportEventType,'submission-rework');
 const f=facts([year(2026,[rec('career','工作压力')])]);Report.applyReportReview(f,review);
 const v=f.currentYear.narrative.verdicts[0];
 assert.equal(v.eventType,'submission-rework');assert.equal(v.supportLevel,'mechanism');
 assert.equal(v.displayTitle,candidate.reportLabel);
 assert.equal(v.detailOnly,true);
 assert.doesNotMatch(f.currentYear.narrative.headline,/交付被退回/);
 assert.equal(f.fiveYear.narrative.years[0].primaryEventLabel,candidate.reportLabel);
 assert.doesNotMatch(v.outcomeText,/是否|工作压力/);
});

test('a reviewed generic domain is not mislabeled as a specific event because another domain has a mechanism',()=>{
 const first=rec('family','家庭责任、长辈事务或居住安排更容易形成压力',{activationScore:12});
 const second=rec('career','工作压力',{activationScore:5});
 const f=facts([year(2026,[first,second])]);
 Report.applyReportReview(f,{adjustments:[],candidates:[{year:2026,domain:'career',hasIndependentAnnualTrigger:true,mechanism_key:'rule:test',manifestation:'test',reportBaseline:'交出的方案被退回重做',reportLabel:'方案返工',reportEventType:'submission-rework'}]});
 assert.equal(f.fiveYear.narrative.years[0].directionLabel,'领域线索');
 assert.equal(f.currentYear.narrative.verdicts[0].supportLevel,'domain');
});

test('equal wording from different mechanisms does not imply the same event across years',()=>{
 const text='交出的方案容易被退回重做，原定交付时间延后。';
 const a=rec('career',text,{reportScenario:text,reportLabel:'外部要求造成返工',reportMechanismKey:'rule:external',reportEventType:'submission-rework'});
 const b=rec('career',text,{reportScenario:text,reportLabel:'自己反复修改',reportMechanismKey:'rule:self',reportEventType:'self-revision'});
 const n=Report.buildNarratives(facts([year(2026,[a]),year(2027,[b])])).fiveYear;
 assert.equal(n.years[1].summary,text);
 assert.doesNotMatch(n.years[1].summary,/参见2026|延续2026/);
});

test('repeated same mechanism is a reference to another hypothesis, never a claim that it already occurred',()=>{
 const text='交出的方案容易被退回重做，原定交付时间延后。';
 const a=rec('career',text,{reportScenario:text,reportLabel:'交付返工',reportMechanismKey:'rule:external',reportEventType:'submission-rework'});
 const n=Report.buildNarratives(facts([year(2026,[a]),year(2027,[{...a}])])).fiveYear;
 assert.match(n.years[1].summary,/交付返工.*参见2026/);
 assert.doesNotMatch(n.years[1].summary,/延续|仍是同一种变化|再次发生/);
});

test('event titles preserve negation, especially a family bodily-condition non-event',()=>{
 for(const [domain,text] of [['career','交出的方案没有返工，按期通过审核。'],['wealth','今年不用追加费用，原有预算足够。'],['family','家人身体状况没有变化。']]){
   const d=Report.__test.describeTimingEvent(rec(domain,text,{unresolvedDisruptionCount:1}),{lifeContext:life});
   assert.equal(d.scenario,text);
   assert.equal(d.supportLevel,'domain');
   assert.doesNotMatch(d.label,/退回重做|新增费用|身体状况出现变化/);
 }
});

test('real renderer retains two distinct event types even when their mechanism is shared',()=>{
 const make=(type,label,scene)=>rec('career',scene,{reportMechanismKey:'rule:same',reportEventType:type,reportLabel:label,reportScenario:scene});
 const rows=[make('submission-rework','交付被退回','交出的方案被退回重做。'),make('authority-dispute','当面争执','与负责人当面争执，后续配合受影响。')];
 const n=Report.buildNarratives(facts([year(2026,rows)])).currentYear;
 const r={window:{},document:{addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}}};
 vm.createContext(r);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/result.js'),'utf8'),r);
 const html=r.reportNarrative(n);
 assert.notEqual(n.verdicts[0].meaningKey,n.verdicts[1].meaningKey);
 assert.match(html,/交出的方案被退回重做/);
 assert.match(html,/与负责人当面争执/);
});
