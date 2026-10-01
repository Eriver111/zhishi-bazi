const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
function runtime() {
  const c = { console, Date, Math, URLSearchParams, location:{search:''}, document:{readyState:'loading',addEventListener(){}} };
  c.window = c; vm.createContext(c);
  for (const file of ['bazi.js','structural.js','bazi-chain.js','deep-report.js','report-imagery.js','calibration-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), c);
  }
  vm.runInContext(fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8').replace(
    'root.ZhishiCalibration.beforeAI = inspectFirstClick;',
    'root.ZhishiCalibration.beforeAI = inspectFirstClick; root.testOptions=competingOptions; root.testDirection=domainDirection;'
  ), c);
  return c;
}
const c = runtime();
test('family disruption changes agency for children without rewriting adult events',()=>{
 for(const age of [6,8,15,17]){
  const row=c.testOptions('family',annual(),age,'偏印',null)[0];
  assert.match(row.detail,/照顾你的人/);assert.doesNotMatch(row.detail,/让你实际请假照顾|承担计划外开支/);
  assert.match(row.followup_options.find(o=>o.key==='family_responsibility').label,/接送或同住/);
 }
 for(const age of [null,18,32])assert.match(c.testOptions('family',annual(),age,'偏印',null)[0].detail,/实际请假照顾家人/);
});
const chart = {year:{gan:'壬',zhi:'午'},month:{gan:'庚',zhi:'戌'},day:{gan:'壬',zhi:'申'},hour:{gan:'丙',zhi:'午'}};
test('decade favorable clashes cannot guarantee favorable family events',()=>{
 const dy={gan:'壬',zhi:'子',startYear:2015,endYear:2024,displayAge:'14-23'};
 const result=c.BaZiChain.analyzeFortune(chart,[dy],c.BaZiCalculator.getYongJi(chart)).periods[0];
 assert.equal(result.verdict,'喜运');
 const family=result.eventLedger.domainRecords.find(r=>r.domain==='family');
 assert.notEqual(family.direction,'偏有利');
 assert.doesNotMatch(JSON.stringify(result.interactions),/可能先变后改善/);
});
test('all ten day masters avoid ability guarantees and preserve actual character counts',()=>{
 for(const stem of '甲乙丙丁戊己庚辛壬癸'){
  const row=c.BaZiCalculator.analyzeCharacter({...chart,day:{gan:stem,zhi:'申'}});
  assert.doesNotMatch(JSON.stringify(row),/天生聪明|知道自己有能力赚回来|最靠得住|最旺（出现|第一个想到|一流|小毛病|都是小节/);
  assert.ok(row.topSSDetail.every(x=>x.count>0));
  assert.ok(row.strengths&&row.weaknesses);
 }
});
function annual(b = chart, year = {gan:'庚',zhi:'子',year:2020}, dy = {gan:'壬',zhi:'子'}, options = {}) {
  return c.BaZiChain.analyzeLiuNian(b, dy, year, c.BaZiCalculator.getYongJi(b), options);
}

test('favorable balance clashes do not prove family support or a good year', () => {
  const result = annual(); // Birth year/age not supplied by the user: do not assume 2002.
  assert.equal(result.eventAdjudication.age, null);
  assert.equal(result.verdict, '变动明显');
  assert.equal(result.unresolvedDisruptionCount, 2);
  assert.equal(result.verifiedScore, 3.2, 'preserve the balance calculation; repair its interpretation');
  const clashes = result.triggers.filter(t=>t.type==='六冲');
  assert.ok(clashes.every(t=>t.isGood===true && t.eventIsGood===null && t.disruptive));
  const family = result.eventAdjudication.domainRecords.find(r=>r.domain==='family');
  assert.equal(family.direction, '条件性');
  assert.equal(family.hasIndependentAnnualTrigger, true);
  assert.equal(family.unresolvedDisruptionCount, 2);
  assert.match(family.scenarioCandidates[0], /家人身体状况可能.*家庭收入或开支/);
  assert.doesNotMatch(family.eventCandidate, /获得助力|支持.*落实/);
  assert.equal(c.testDirection('family', result), 'neutral');
  assert.equal(c.ReportImagery.candidates('change', result).some(o=>o.mechanism_key==='rule:clash-releases-obstruction'), false);
});

test('the same uncertainty survives a favorable decade and different age contexts', () => {
  for (const age of [null, 18, 38, 78]) {
    const result = annual(chart, undefined, undefined, {age, daYunEventLedger:{domainRecords:[
      {domain:'family',label:'家庭',activationScore:10,direction:'偏有利',conclusion:'合成大运有利背景'}
    ]}});
    assert.equal(result.eventAdjudication.domainRecords.find(r=>r.domain==='family').direction, '条件性');
  }
});

test('an unrelated domain does not inherit a positive OR negative global score', () => {
  for (const score of [-10, 10]) {
    const result=c.BaZiChain.buildAnnualEventAdjudication(chart,{gan:'壬',zhi:'子'}, {gan:'庚',zhi:'子',year:2020},
      {triggers:[],verifiedScore:score,stemRole:score>0?'喜神':'忌神'},{});
    assert.equal(result.domainRecords.find(r=>r.domain==='relationship').direction,'条件性');
    assert.equal(result.domainRecords.find(r=>r.domain==='health').direction,'条件性');
  }
});

test('family calibration offers concrete adverse experiences without assigning a diagnosis or relative', () => {
  const result=annual();
  const options=c.testOptions('family',result,null,'偏印',null);
  assert.equal(options.length,1);
  assert.equal(options[0].mechanism_key,'family-disruption-review');
  assert.match(options[0].detail,/实际请假照顾家人.*也可以回答没有/);
  assert.ok(options[0].followup_options.some(o=>o.key==='family_responsibility'));
  assert.ok(options[0].followup_options.some(o=>o.key==='family_extra_cost'));
  assert.doesNotMatch(JSON.stringify(options), /就医|医院|住院|治疗|受伤|检查|疾病/);
  assert.doesNotMatch(options[0].detail,/父亲.*出事|必然|重大疾病|已经发生/);
  const event={event_year:2020,options};
  const normalized=c.ZhishiCalibrationModel.normalizeCalibrationResponse(event,{
    answer:'yes',selected_option:options[0].key,selected_detail:'family_responsibility',match_level:'exact',actual_year:2020
  });
  assert.ok(!normalized.error);
  assert.equal(normalized.value.match_level,'exact');
  const vague=c.ZhishiCalibrationModel.normalizeCalibrationResponse(event,{
    answer:'yes',selected_option:options[0].key,match_level:'exact'
  });
  assert.equal(vague.value.match_level,'partial');
  assert.equal(vague.value.selected_detail,null);
  const denied=c.ZhishiCalibrationModel.normalizeCalibrationResponse(event,{answer:'no'});
  assert.ok(!denied.error);
});

test('unfavorable structural triggers stay unfavorable; independent positive events remain positive', () => {
  const result=c.BaZiChain.buildAnnualEventAdjudication(chart,{gan:'壬',zhi:'子'}, {gan:'庚',zhi:'子',year:2020},
    {verifiedScore:10,triggers:[{type:'六冲',target:'year',isGood:false,detail:'合成家庭位置受冲'}]},{});
  assert.equal(result.domainRecords.find(r=>r.domain==='family').direction,'偏不利');
  assert.equal(c.BaZiChain.annualEventDirection({type:'三合局',isGood:true}),true);
  const positive=c.BaZiChain.buildAnnualEventAdjudication(chart,{gan:'壬',zhi:'子'}, {gan:'庚',zhi:'子',year:2020},
    {verifiedScore:-10,triggers:[{type:'三合局',targetPositions:['year'],formedWx:'水',isGood:true,detail:'合成独立有利结构'}]},{});
  assert.equal(positive.domainRecords.find(r=>r.domain==='family').direction,'偏有利');
});

test('cross-chart regression never converts unresolved disruptions into positive family outcomes', () => {
  let checked=0, favourable=0, adverse=0;
  for(const birthYear of [1968,1987,2002,2010]) for(const month of [2,5,8,11]) {
    const b=c.BaZiCalculator.calculate(birthYear,month,15,6,'male',12);
    const y=c.BaZiCalculator.getYongJi(b);
    for(const [gan,zhi] of [['庚','子'],['甲','辰'],['丙','午'],['戊','申']]) {
      const a=c.BaZiChain.analyzeLiuNian(b,{gan:'壬',zhi:'子'},{gan,zhi},y);
      for(const record of a.eventAdjudication.domainRecords) {
        if(record.unresolvedDisruptionCount) { checked++; assert.notEqual(record.direction,'偏有利'); }
        if(record.direction==='偏有利') favourable++;
        if(record.direction==='偏不利') adverse++;
      }
      if(a.unresolvedDisruptionCount) assert.notEqual(a.verdict,'大吉');
    }
  }
  assert.ok(checked>10); assert.ok(favourable>0); assert.ok(adverse>0);
});
