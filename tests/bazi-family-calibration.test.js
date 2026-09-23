const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../js/bazi.js'),'utf8');
function load(){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,calc:ctx.window.BaZiCalculator};}
function chart(p){return Object.fromEntries(p.split(' ').map((s,i)=>[['year','month','day','hour'][i],{gan:s[0],zhi:s[1]}]));}
function row(result,key){return result.claims.find(c=>c.claimKey==='parents.'+key);}
// These tests isolate inference prerequisites, not empirical family outcomes.
function roles(ctx,classification){ctx.getYongJi=()=>({elementClassification:classification,xiShen:[],jiShen:[]});}

test('missing exact parent symbols retain auxiliary stars without replacing identities',()=>{
  const p=load().calc.analyzeParents(chart('甲子 己丑 丙寅 戊戌'),'female');
  assert.equal(p.fatherPresent,false);assert.equal(p.motherPresent,false);
  assert.ok(p.evidence.auxiliaryStars.father.appearances.length);
  assert.ok(p.evidence.auxiliaryStars.mother.appearances.length);
  assert.equal(p.fatherStar,'偏财');assert.equal(p.motherStar,'正印');
  assert.equal(row(p,'mother').direction,'insufficient');
  assert.match(p.motherText,/仍有印星照顾线索/);
  assert.doesNotMatch(p.motherText,/满盘无印|母亲不爱|关系不好/);
});

test('support is withdrawn when rooted carrying evidence is removed',()=>{
  const {ctx,calc}=load();roles(ctx,{水:'喜神',土:'中性'});
  const b=chart('癸亥 癸卯 甲午 丙寅');
  const a=calc.analyzeParents(b,'male');
  assert.ok(a.judgements.mother.support);
  const settle=ctx.buildBaziEvidenceSettlement;
  ctx.buildBaziEvidenceSettlement=b=>{const s=settle(b);return {...s,roots:s.roots.filter(r=>r.element!=='水')};};
  const after=calc.analyzeParents(b,'male');
  assert.equal(after.judgements.mother.support,false);
  assert.equal(row(after,'mother').direction,'insufficient');
  assert.doesNotMatch(after.motherText,/更偏向提供支持/);
});

test('neutral role does not become pressure, and adverse role does not become lack of love',()=>{
  const {ctx,calc}=load();const b=chart('癸亥 癸卯 甲午 丙寅');
  roles(ctx,{水:'中性'});const n=calc.analyzeParents(b,'male');
  assert.equal(n.judgements.mother.responsibilityPressure,false);
  assert.equal(row(n,'mother').direction,'thematic');
  assert.equal(n.judgements.mother.support,false);
  assert.ok(n.judgements.mother.themeRequirements.every(c=>c.met));
  assert.match(n.motherText,/哪些事由母亲帮你安排，哪些事你自己来/);
  roles(ctx,{水:'忌神'});const p=calc.analyzeParents(b,'male');
  assert.ok(p.judgements.mother.responsibilityPressure);
  assert.ok(p.judgements.mother.pressureRequirements.every(c=>c.met));
  assert.doesNotMatch(p.motherText,/不爱|不关心|必然|肯定|感情不好/);
});

test('thematic parent reading is withdrawn with the carrying root, not relabelled as support',()=>{
  const {ctx,calc}=load();roles(ctx,{水:'中性'});
  const b=chart('癸亥 癸卯 甲午 丙寅');
  assert.equal(row(calc.analyzeParents(b,'male'),'mother').direction,'thematic');
  const settle=ctx.buildBaziEvidenceSettlement;
  ctx.buildBaziEvidenceSettlement=b=>{const s=settle(b);return {...s,roots:s.roots.filter(r=>r.element!=='水')};};
  const p=calc.analyzeParents(b,'male');
  assert.equal(row(p,'mother').direction,'insufficient');
  assert.equal(p.judgements.mother.support,false);
});

test('a personal household theme needs both cross-pillar context and an actual day relation',()=>{
  const {ctx,calc}=load();roles(ctx,{});
  const p=calc.analyzeParents(chart('壬子 癸亥 甲寅 丁卯'),'male');
  assert.equal(row(p,'child').direction,'thematic');
  assert.ok(row(p,'child').requiredConditions.every(c=>c.met));
  assert.match(p.childRelationshipText,/谁需要帮忙、谁能腾出时间/);
  assert.doesNotMatch(p.childRelationshipText,/起分歧|争论|谈不拢/);
  assert.match(row(p,'child').sourceText,/亥与日柱寅合/);
  // Removing the cross-pillar upbringing theme cannot leave a generic relational claim behind.
  const withoutTheme=calc.analyzeParents(chart('壬子 丙午 甲寅 丁卯'),'male');
  assert.equal(row(withoutTheme,'child').direction,'insufficient');
});

test('support and pressure interpretations name different interactions without claiming emotional closeness',()=>{
  const {ctx,calc}=load(),b=chart('癸亥 癸卯 甲午 丙寅');
  roles(ctx,{水:'喜神'});const support=calc.analyzeParents(b,'male');
  roles(ctx,{水:'忌神'});const pressure=calc.analyzeParents(b,'male');
  assert.equal(row(support,'mother').direction,'mixed');
  assert.match(support.motherText,/能得到照顾与安排上的助力.*实际执行却容易打折/);
  assert.match(pressure.motherText,/学习与生活该怎样安排、选择是否稳妥/);
  assert.doesNotMatch(support.motherText+pressure.motherText,/无法确定|不足以|感情亲密|不爱你/);
  assert.notEqual(support.summaryText,pressure.summaryText);
});

test('a chart with no family conclusion gets one compact notice instead of five empty cards',()=>{
  const {ctx,calc}=load();const p=calc.analyzeParents(chart('丁酉 癸卯 乙巳 丙戌'),'male');
  assert.ok(p.claims.every(c=>c.status==='insufficient'));
  const node={innerHTML:''};ctx.document={addEventListener(){},getElementById(id){return id==='parentsContent'?node:null;}};
  ctx.window.BaZiCalculator={analyzeParents:()=>p};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/result.js'),'utf8'),ctx);
  ctx.renderParents({},'male');
  assert.equal((node.innerHTML.match(/class="pr-card"/g)||[]).length,0);
  assert.equal((node.innerHTML.match(/parents-limited/g)||[]).length,1);
  assert.match(node.innerHTML,/本盘家庭专项线索较少/);
  assert.ok(node.innerHTML.indexOf('parents-limited')<node.innerHTML.indexOf(p.fatherText));
});

test('a parent star only in the year background does not establish personal pressure',()=>{
  const {ctx,calc}=load();roles(ctx,{水:'忌神'});
  const p=calc.analyzeParents(chart('癸亥 丁卯 甲午 丙寅'),'male');
  assert.ok(p.evidence.parentStars.mother.rooted);
  assert.equal(p.judgements.mother.responsibilityPressure,false);
  assert.equal(p.judgements.mother.interactionFriction,false);
  assert.equal(row(p,'mother').direction,'thematic');
  assert.match(p.motherText,/小时候/);
  assert.equal(row(p,'mother').reading.scope,'早年成长背景');
  assert.ok(p.judgements.mother.themeRequirements.every(c=>c.met));
});

test('month-day clash is retained even when year-day has no relationship',()=>{
  const p=load().calc.analyzeParents(chart('甲辰 癸酉 甲卯 丙寅'),'male');
  assert.ok(p.evidence.selfFamilyEvents.some(e=>e.from==='month'&&e.to==='day'&&e.type==='冲'));
  assert.match(row(p,'child').sourceText,/月柱酉与日柱卯冲/);
});

test('disturbance unrelated to a parent root cannot be borrowed as that parent friction',()=>{
  const {ctx,calc}=load();roles(ctx,{水:'喜神'});
  const b=chart('癸亥 癸酉 甲卯 丁巳');
  const p=calc.analyzeParents(b,'male');
  // Water root is disturbed by year-hour; month-day clash does not hit that root.
  assert.ok(p.evidence.parentStars.mother.damageEvents.length);
  assert.equal(p.judgements.mother.interactionFriction,false);
  assert.equal(p.judgements.mother.frictionRequirements.find(c=>c.key==='settledRootDisturbance').met,false);
});

test('parent relationship requires actual separate rooted early parent locations',()=>{
  const calc=load().calc;
  const linked=calc.analyzeParents(chart('戊戌 癸丑 甲寅 丙午'),'male');
  assert.ok(linked.evidence.parentPairEvents.some(e=>e.type==='刑'));
  assert.equal(row(linked,'between').direction,'pressure');
  const unlinked=calc.analyzeParents(chart('甲申 丙寅 戊戌 癸亥'),'male');
  assert.ok(unlinked.evidence.palace.damageEvents.length);
  assert.equal(unlinked.evidence.parentPairEvents.length,0);
  assert.equal(row(unlinked,'between').direction,'insufficient');
});

test('cooccurrence cannot deduct family support through the old wealth-breaks-seal score',()=>{
  const p=load().calc.analyzeParents(chart('癸未 庚申 甲寅 戊辰'),'male');
  assert.equal(p.inferences.family.wealthBlocksSeal,null);
  assert.equal(p.inferences.family.businessPattern,null);
  const active=source.slice(source.indexOf('function analyzeParents(bazi'),source.indexOf('// ==================== 日主性格分析'));
  assert.doesNotMatch(active,/foundationScore|if\s*\(wealthBlocksSeal\).*[-]=/);
  assert.ok(p.evidence.earlyEnvironment.nodes.some(n=>n.pos==='month'));
});

test('upbringing themes need two different early pillars, not two tokens in one pillar',()=>{
  const calc=load().calc;
  const one=calc.analyzeParents(chart('壬子 丙午 甲寅 丁卯'),'male');
  assert.equal(one.evidence.earlyEnvironment.themes.includes('care'),false);
  const two=calc.analyzeParents(chart('壬子 癸亥 甲寅 丁卯'),'male');
  assert.ok(two.evidence.earlyEnvironment.themes.includes('care'));
});

test('mixed parent support is not summarized as uniformly smooth personal support',()=>{
  const p=load().calc.analyzeParents(chart('癸酉 丙辰 戊辰 庚申'),'male');
  assert.equal(row(p,'father').direction,'mixed');
  assert.equal(row(p,'child').direction,'mixed');
  assert.doesNotMatch(p.childRelationshipText,/更偏向有事能够商量/);
});

test('AI receives each direction, prerequisites and counterevidence rather than only a generic boundary',()=>{
  const p=load().calc.analyzeParents(chart('癸未 庚申 甲寅 戊辰'),'male');
  const text=require('../api/ai-chat.js')._test.buildChartContext({parentAnalysis:p});
  assert.match(text,/该段方向：mixed/);assert.match(text,/条件核对：/);
  assert.match(text,/限制与反证：/);assert.match(text,/mixed表示帮助与牵制并存/);
  assert.match(text,/成长环境证据：/);
  assert.match(text,/thematic表示有承载的互动主题/);
  assert.match(text,/缺线索的部分集中简述一次/);
});

test('family page shows supported conclusions first and groups missing conclusions in escaped details',()=>{
  const {ctx,calc}=load();const p=calc.analyzeParents(chart('癸未 庚申 甲寅 戊辰'),'male');
  p.claims[0].outcomeText+='<img src=x onerror=alert(1)>';
  p.claims[0].blockers.push('<script>bad()</script>');
  const node={innerHTML:''};ctx.document={addEventListener(){},getElementById(id){return id==='parentsContent'?node:null;}};
  ctx.window.BaZiCalculator={analyzeParents:()=>p};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/result.js'),'utf8'),ctx);
  ctx.renderParents({},'male');
  const limited=p.claims.filter(c=>c.status==='insufficient').length;
  assert.equal((node.innerHTML.match(/class="pr-card"/g)||[]).length,5-limited);
  assert.equal((node.innerHTML.match(/<details /g)||[]).length,5+(limited?1:0));
  assert.match(node.innerHTML,/原生家庭与成长方式/);
  assert.ok(node.innerHTML.indexOf('家庭的帮助与牵制并存')<node.innerHTML.indexOf('<details'));
  assert.match(node.innerHTML,/&lt;img/);assert.doesNotMatch(node.innerHTML,/<img|<script>/);
});

test('512 generated charts preserve gender symmetry, attributable directions and root evidence',()=>{
  const calc=load().calc;let seed=0x092325;const seen=new Set();
  const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
  for(let i=0;i<256;i++){
    const hour=next(24),b=calc.calculate(1950+next(71),1+next(12),1+next(28),Math.floor((hour+1)%24/2),'male',hour);
    const a=calc.analyzeParents(b,'male'),f=calc.analyzeParents(b,'female');
    assert.equal(JSON.stringify(a.claims),JSON.stringify(f.claims));
    assert.equal(a.claims.length,5);
    for(const key of ['father','mother']){
      const j=a.judgements[key];
      if(j.support)assert.ok(j.supportRequirements.every(c=>c.met));
      if(j.responsibilityPressure)assert.ok(j.pressureRequirements.every(c=>c.met));
      if(j.interactionFriction)assert.ok(j.frictionRequirements.every(c=>c.met));
      if(j.direction==='pressure')assert.ok(j.responsibilityPressure||j.interactionFriction);
      if(j.direction==='supportive'||j.direction==='mixed')assert.ok(j.support);
      if(j.direction==='thematic')assert.ok(j.themeRequirements.every(c=>c.met));
      const star=a.evidence.parentStars[key];
      assert.equal(star.rootPower,star.rootEvidence.reduce((n,r)=>n+r.effectivePower,0));
    }
    for(const c of a.claims){
      assert.ok(c.sourceRefs.length);assert.equal(c.realityConfirmed,false);
      assert.equal(c.direction,a.judgements[c.claimKey.split('.')[1]].direction);
      assert.doesNotMatch(c.outcomeText,/必然|肯定|注定|父亲从商|母亲不爱|父母离异/);
      seen.add(c.direction);
    }
  }
  for(const state of ['supportive','mixed','pressure','insufficient','thematic'])assert.ok(seen.has(state),state);
});
