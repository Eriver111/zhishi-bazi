const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const context={window:null,console,Date,URLSearchParams,location:{search:''},document:{readyState:'loading',addEventListener(){}}};context.window=context;vm.createContext(context);
for(const f of ['bazi.js','structural.js','bazi-chain.js','deep-report.js','report-imagery.js','calibration-model.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),context);
const source=fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8');
vm.runInContext(source.replace('root.ZhishiCalibration.beforeAI = inspectFirstClick;','root.ZhishiCalibration.beforeAI = inspectFirstClick;root.__select=selectDistinctCandidates;root.__meaning=optionMeaning;root.__generate=generateCandidates;root.__local=prepareLocalEvents;'),context);
const option=(domain,manifestation='change',extra={})=>({key:domain+':'+manifestation,domain,manifestation,label:domain,detail:domain+' '+manifestation,mechanism_key:domain+':trigger',evidence:['independent trigger'],_independent:true,_triggerKeys:['month:clash'],...extra});
const row=(year,options,extra={})=>({event_key:year+'-test',year,domain:options[0].domain,prompt:year+'年经历如何？',options,_stage:'midlife',...extra});
const select=(pool,preserved=[])=>context.__select(pool,preserved);
test('same event meaning with different wording or mechanism does not fill multiple questions',()=>{
 const first=option('career','pressure');
 const result=select([row(2024,[first]),row(2020,[{...first,detail:'另一种说法',mechanism_key:'different'}])]);
 assert.equal(result.length,1);
});
test('one explained independent cross-year pair is allowed, never a third repetition',()=>{
 const input=[row(2024,[option('wealth')]),row(2020,[option('wealth')]),row(2016,[option('wealth')])],before=JSON.stringify(input);
 const result=select(input);assert.equal(result.length,2);
 assert.equal(result.filter(r=>r.prompt.includes('跨年对照')).length,1);assert.match(result[1].prompt,/2024年.*也可以两年都选不符合/);
 assert.equal(JSON.stringify(input),before);assert.ok(!('_independent' in result[0].options[0]));
});
test('nearby recall windows and theme-only years cannot form a repeat pair',()=>{
 assert.equal(select([row(2024,[option('wealth')]),row(2022,[option('wealth')])]).length,1);
 assert.equal(select([row(2024,[option('wealth')]),row(2020,[option('wealth','change',{_independent:false})])]).length,1);
});
test('same-trigger broad environment option is removed but unrelated change evidence survives',()=>{
 const result=select([row(2024,[option('change'),option('family')])]);assert.equal(result[0].options.length,1);assert.equal(result[0].options[0].domain,'family');
 const separate=select([row(2024,[option('change','change',{_triggerKeys:['hour:clash']}),option('family')])]);assert.equal(separate[0].options.length,2);
});

test('same-year scene variants with identical wording cannot occupy two answer slots',()=>{
 const a=option('study','task',{detail:'通过共同练习完成阶段任务'}),b=option('career','task',{detail:a.detail});
 const result=select([row(2024,[a,b])]);assert.equal(result.length,1);assert.equal(result[0].options.length,1);assert.equal(result[0].options[0].domain,'study');
});
test('father and mother events remain distinct and unrelated personal finance is retained',()=>{
 const result=select([row(2024,[option('family','pressure',{mechanism_key:'parent-father:clash',detail:'父亲的变化'})]),row(2020,[option('family','pressure',{mechanism_key:'parent-mother:clash',detail:'母亲的变化'}),option('wealth')])]);
 assert.equal(result.length,2);assert.equal(result[1].options.length,2);assert.ok(result.every(r=>!r.prompt.includes('跨年对照')));
});
test('fixed answers consume slots and block duplicate years and meanings without being rewritten',()=>{
 const saved={...row(2024,[option('career')]),event_year:2024,answer:'no'},before=JSON.stringify(saved);
 const result=select([row(2024,[option('wealth')]),row(2020,[option('career','change',{mechanism_key:'different'})]),row(2016,[option('study')])],[saved]);
 assert.equal(result.length,1);assert.equal(result[0].year,2016);assert.equal(JSON.stringify(saved),before);
});
test('stage coverage is kept when distinct evidence exists without padding to five questions',()=>{
 const stages=['school','youth','early-adult','midlife','mature'],domains=['study','career','wealth','family','health'];
 const result=select(stages.map((stage,i)=>row(2024-i*8,[option(domains[i])],{_stage:stage})));
 assert.equal(result.length,5);assert.equal(select([row(2024,[option('study')])]).length,1);
});
function chart(year,month,gender){
 const calc=context.BaZiCalculator,b=calc.calculate(year,month,15,6,gender,12),d=b.birthDate;
 context._bazi=b;context._daYunData=calc.calculateDaYun(b.month,b.year,gender,d.year,d.month,d.day,d.hour,d.clock);context.location.search='?year='+year;
 const yongJi=calc.getYongJi(b);return {birthInfo:{year,gender},yongJi,fortuneAnalysis:context.BaZiChain.analyzeFortune(b,context._daYunData.list,yongJi)};
}
test('64 synthetic charts preserve years, evidence, stages and a maximum of one explained recurrence',()=>{
 let total=0;
 for(const year of [1958,1966,1974,1982,1990,1998,2006,2010])for(const month of [2,5,8,11])for(const gender of ['male','female']){
  const questions=context.__generate(chart(year,month,gender));total+=questions.length;
  assert.ok(questions.length<=5 && questions.length>0);assert.equal(new Set(questions.map(q=>q.year)).size,questions.length);
  const repeats=questions.filter(q=>q.prompt.includes('跨年对照'));assert.ok(repeats.length<=1);
  const seen=new Map(),domains={};let duplicated=0;
  for(const q of questions){
   assert.ok(q.year<new Date().getFullYear() && q.year>=year+6);assert.ok(q.options.length>=1 && q.options.length<=3);
   domains[q.domain]=(domains[q.domain]||0)+1;assert.ok(domains[q.domain]<=2);
   for(const o of q.options){assert.ok(o.evidence.length);const key=context.__meaning(o);if(seen.has(key))duplicated++;seen.set(key,true);}
  }
  assert.ok(duplicated<=1);if(duplicated)assert.equal(repeats.length,1);
 }
 assert.ok(total>250);
});
test('guest upgrade preserves original answered records and safely replaces only unanswered candidates',()=>{
 const data=chart(1990,5,'female'),original=context.__generate(data),saved={...original[0],event_year:original[0].year,answer:'no',note:'synthetic original'},old={...original[1],event_year:original[1].year,answer:null};
 const storage=new Map([['zhishi_calibration_data:test',JSON.stringify([saved,old])]]);context.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const result=context.__local('test',data),retained=result.find(r=>r.event_key===saved.event_key);
 assert.equal(JSON.stringify(retained),JSON.stringify(saved));assert.ok(result.length<=5);assert.equal(storage.get('zhishi_calibration_version:test'),'bazi-cal-v10');
 const stored=storage.get('zhishi_calibration_data:test');context.__local('test',data);assert.equal(storage.get('zhishi_calibration_data:test'),stored);
});
