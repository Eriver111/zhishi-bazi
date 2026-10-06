const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const DeepReport = require('../js/deep-report.js');
const context = { window: {}, console };
vm.createContext(context);
for (const name of ['bazi.js', 'structural.js', 'bazi-chain.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context);
}
const calc = context.window.BaZiCalculator;
const deps = { calculator:calc, structural:context.window.StructuralAnalysis, chain:context.window.BaZiChain };
function chart(pillars, gender='male') {
  const parts = pillars.split(' ').map(s => ({ gan:s[0], zhi:s[1] }));
  return calc.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,parts[i]])),gender);
}
function facts(pillars, gender='male') { return DeepReport.buildFacts(chart(pillars,gender),gender,{anchorYear:2026,deps}); }
function item(n,title) { return n.verdicts.find(v=>v.title===title); }
function visible(n) { return [n.headline,n.painPoint,...n.verdicts.map(v=>v.outcomeText)].join(' '); }

test('year-day combine cannot trigger advice to live apart; concurrent facts remain visible',()=>{
  const p=calc.analyzeParents(chart('癸酉 丙辰 戊辰 庚申'),'male');
  assert.ok(p.evidence.palace.combinationEvents.some(e=>e.to==='day'));
  assert.doesNotMatch(p.childRelationshipText,/长大后拉开居住距离|容易意见不一/);
  assert.match(p.claims.find(c=>c.claimKey==='parents.child').blockers.join('；'),/相合线索/);
  const concurrent=calc.analyzeParents(chart('癸巳 庚申 甲辰 戊辰'),'male');
  assert.ok(concurrent.evidence.palace.combinationEvents.some(e=>e.pair==='巳申'));
  assert.ok(concurrent.evidence.palace.damageEvents.some(e=>e.pair==='巳申'));
});

test('parent roots use same-element settled facts even when the exact ten-god stem is absent',()=>{
  const p=calc.analyzeParents(chart('癸酉 丁巳 癸巳 丁巳'),'male');
  const star=p.evidence.parentStars.father;
  assert.equal(star.name,'偏财');
  assert.ok(star.rooted && star.roots.length && star.rootEvidence.some(r=>r.gan==='丙'));
  assert.equal(star.rootPower,star.rootEvidence.reduce((sum,r)=>sum+r.effectivePower,0));
  assert.doesNotMatch(p.fatherText,/本人做事有底气|能给出的实际帮助相对稳定/);
});

test('absent parent stars do not become missing affection and cooccurrence is not a confirmed pathway',()=>{
  const p=calc.analyzeParents(chart('甲子 己丑 丙寅 戊戌'),'female');
  assert.equal(p.fatherPresent,false);
  assert.equal(p.claims.find(c=>c.claimKey==='parents.father').status,'insufficient');
  assert.doesNotMatch(p.fatherText,/存在感.*偏弱|直接参与感偏弱/);
  assert.equal(p.inferences.family.wealthBlocksSeal,null);
  assert.equal(p.inferences.family.businessPattern,null);
});

test('exposed and hidden spouse evidence takes the exposed-rooted path, not the hidden-only path',()=>{
  const f=facts('乙卯 癸未 辛未 戊戌');
  const n=item(f.relationship.narrative,'缘分是否容易落地');
  assert.equal(f.relationship.spouseStar.quality.visibility,'透藏并见');
  assert.match(n.sourceText,/透藏并见.*配偶星有根/);
  assert.match(n.outcomeText,/明确的关系|认真相处|稳定下来/);
  assert.ok(n.requiredConditions.every(c=>c.met));
  const changed=structuredClone(f);
  changed.relationship.spouseStar.exposed=[];
  changed.relationship.spouseStar.quality.visibility='藏干潜藏';
  const later=item(DeepReport.buildNarratives(changed).relationship,'缘分是否容易落地');
  assert.match(later.sourceText,/藏干潜藏/);
  assert.notEqual(later.outcomeText,n.outcomeText);
  assert.ok(later.blockers.includes('配偶星显现条件未完整'));
});

test('unclear spouse age remains insufficient rather than defaulting to similar age',()=>{
  const f=facts('乙卯 癸未 辛未 戊戌');
  assert.equal(f.relationship.age.tendency,'unclear');
  const row=item(f.relationship.narrative,'年龄倾向');
  assert.equal(row.status,'insufficient');
  assert.match(row.sourceText,/年龄线索未集中/);
  assert.equal(row.detailOnly,true);
  assert.equal(row.outcomeText,'');
  assert.doesNotMatch(row.outcomeText,/以与命主相仿为主/);
});

test('reordering spouse occurrences never changes the meeting-channel narrative',()=>{
  const f=facts('丙子 己亥 戊辰 丙辰');
  const a=item(f.relationship.narrative,'认识渠道');
  assert.equal(f.relationship.distance.tendency,'unclear');
  f.relationship.spouseStar.occurrences.reverse();
  const b=item(DeepReport.buildNarratives(f).relationship,'认识渠道');
  assert.equal(a.outcomeText,b.outcomeText);
  assert.equal(a.status,'insufficient');
});

test('authoritative neutral strength is preserved for every carrying state',()=>{
  const f=facts('癸酉 丙辰 戊辰 庚申');
  assert.equal(f.core.strength.level,'中和');
  for(const state of ['可承接','承压','有缓解']) {
    f.wealth.capacity.state=state;
    const narrative=DeepReport.buildNarratives(f).wealth;
    const row=item(narrative,'钱能不能留下');
    assert.equal(f.core.strength.level,'中和');
    assert.ok(f.storyline.technicalBasis.includes('中和'));
    assert.ok(row.sourceRefs.length&&row.sourceText);
    assert.doesNotMatch(visible(narrative),/日主偏强|日主偏弱/);
  }
});

test('following report storyline does not reuse the ordinary weak-person remedy',()=>{
  const f=facts('己未 庚午 甲戌 戊辰');
  assert.equal(f.core.yongJi.method,'从格顺势');
  assert.match(f.storyline.mechanismAccount.cause,/顺势/);
  assert.ok(f.storyline.technicalBasis.includes('从财格'));
  assert.equal(f.wealth.capacity.state,'顺势');
  assert.doesNotMatch(f.storyline.summary+visible(f.wealth.narrative),/真正要解决的是承载不足|必须.*补印比/);
});

test('missing domain facts cannot produce an A grade, degree claim or spouse age',()=>{
  for(const input of [{},{wealth:{}},{relationship:{}},{study:{}}]) {
    const n=DeepReport.buildNarratives(input);
    for(const section of ['wealth','relationship','study']) {
      assert.equal(n[section].evidenceStatus,'insufficient');
      assert.equal(n[section].grade,'');
      assert.equal(n[section].verdicts.length,0);
    }
  }
});

test('removing a wealth pathway removes its confirmation and keeps a visible limitation',()=>{
  const f=facts('辛丑 乙未 丙寅 戊戌');
  f.wealth.pathways=[{type:'食伤生财',positive:true,scalePotential:true}];
  const a=item(DeepReport.buildNarratives(f).wealth,'钱主要从哪里来');
  assert.ok(a.requiredConditions.some(c=>c.key==='wealthPath'&&c.met));
  f.wealth.pathways=[];
  f.wealth.storage={present:false,activated:false,storages:[]};
  const b=item(DeepReport.buildNarratives(f).wealth,'钱主要从哪里来');
  assert.ok(b.requiredConditions.some(c=>c.key==='wealthPath'&&!c.met));
  assert.equal(b.status,'insufficient');
  assert.doesNotMatch(b.outcomeText,/主要还是.*正经收入|不是靠.*横财/);
});

test('known adult work timing preserves supplied distinct scenarios while absent age or a child context does not assume a job',()=>{
  const adult={age:35,lifeStage:{key:'development'},lifeContext:{status:'working',age:35}};
  const record={domain:'career',direction:'偏有利',hasIndependentAnnualTrigger:true,evidence:['合成年度职业触发']};
  const a=DeepReport.__test.selectTimingScenario({...record,scenarioCandidates:['合同续约']},adult);
  const b=DeepReport.__test.selectTimingScenario({...record,scenarioCandidates:['项目验收']},adult);
  assert.equal(a,'合同续约'); assert.equal(b,'项目验收'); assert.notEqual(a,b);
  const child=DeepReport.__test.selectTimingScenario({...record,scenarioCandidates:['合同续约']},{age:12,lifeStage:{key:'child'},lifeContext:{status:'student',age:12}});
  assert.doesNotMatch(child,/合同续约/);
  const unknown=DeepReport.__test.selectTimingScenario({...record,scenarioCandidates:['合同续约']},{lifeStage:{key:'development'}});
  assert.doesNotMatch(unknown,/合同续约|项目验收/,'单独一个阶段标签不能补造年龄或职业');
  const untriggered={...record,hasIndependentAnnualTrigger:false,scenarioCandidates:['合同续约']};
  const year={year:2026,lifeContext:adult.lifeContext,eventAdjudication:{...adult,primaryEvent:untriggered,domainRecords:[untriggered]}};
  assert.equal(DeepReport.buildNarratives({currentYear:year,fiveYear:{years:[year]}}).currentYear.verdicts.length,0,'有场景和工作身份但无年度独立触发也不生成年度事件');
});

test('A grades keep existing differentiated selling points on representative charts',()=>{
  for(const [p,grade] of [['辛丑 乙未 丙寅 戊戌','A10'],['戊寅 甲子 辛卯 辛卯','A9'],['戊辰 乙丑 己巳 己巳','A8'],['己酉 辛未 癸巳 丁巳','A6']]){
    assert.equal(facts(p).wealth.narrative.grade,grade);
  }
});

test('256 male and female generated charts retain roots, uncertainty and per-paragraph evidence contracts',()=>{
  let seed=0x092324;
  const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
  for(let i=0;i<128;i++) {
    const date=[1960+next(51),1+next(12),1+next(28),next(24)];
    for(const gender of ['male','female']) {
      const b=calc.calculate(...date.slice(0,3),Math.floor((date[3]+1)%24/2),gender,date[3]);
      const p=calc.analyzeParents(b,gender);
      for(const star of Object.values(p.evidence.parentStars)) {
        assert.equal(star.rooted,star.rootPower>0);
        assert.equal(star.rootPower,star.rootEvidence.reduce((n,r)=>n+r.effectivePower,0));
      }
      const f=DeepReport.buildFacts(b,gender,{anchorYear:2026,deps});
      if(f.relationship.age.tendency==='unclear')assert.equal(item(f.relationship.narrative,'年龄倾向').status,'insufficient');
      for(const key of ['wealth','relationship','study','currentYear','fiveYear']) {
        const n=f[key].narrative;
        assert.ok(n.headline);
        for(const v of n.verdicts)assert.ok(v.claimKey&&v.ruleId&&v.sourceRefs.length&&v.conditions.length&&v.realityConfirmed===false);
      }
      assert.doesNotMatch(visible(f.study.narrative),/本科相对轻松|本科阶段通常可达/);
    }
  }
});
