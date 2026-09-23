const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/bazi.js'),'utf8');
function load(){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,calc:ctx.window.BaZiCalculator};}
function chart(s){return Object.fromEntries(s.split(' ').map((p,i)=>[['year','month','day','hour'][i],{gan:p[0],zhi:p[1]}]));}
const row=(p,key)=>p.claims.find(c=>c.claimKey==='parents.'+key);
const roles=(ctx,c)=>{ctx.getYongJi=()=>({elementClassification:c,xiShen:[],jiShen:[]});};

test('family-day theme readings explain the interaction and keep cooperation distinct from friction',()=>{
 const {ctx,calc}=load();
 const fixtures=[
  ['辛酉 辛丑 癸卯 辛酉','care',true],
  ['丁酉 辛亥 丙寅 戊戌','practical',false],
  ['癸巳 丙辰 癸卯 乙卯','practical',true],
  ['己未 戊辰 壬子 癸卯','rules',true],
  ['丙寅 甲午 壬午 辛亥','expression',true],
  ['己亥 戊辰 癸酉 辛酉','rules',false],
  ['乙亥 壬午 壬午 丁未','independence',true],
  ['甲午 丙寅 己未 壬申','care',false],
  ['壬辰 壬寅 癸亥 丙辰','independence',false],
  ['丙戌 己亥 丙寅 甲午','expression',false]
 ];
 function check(p,theme,friction){
  assert.equal(p.judgements.child.direction,'thematic');
  assert.ok(p.evidence.earlyEnvironment.themes.includes(theme));
  assert.equal(p.evidence.selfFamilyEvents.some(e=>e.type!=='合'),friction);
  assert.ok(row(p,'child').requiredConditions.every(c=>c.met));
  assert.doesNotMatch(p.childRelationshipText,/可以先抓住|这条线索|协调决定|不指定是哪位|观察点|互动主题|父亲|母亲/);
  if(friction)assert.match(p.childRelationshipText,/分歧|争论|谈不拢|各说各的|听谁的/);
  else assert.doesNotMatch(p.childRelationshipText,/分歧|争论|谈不拢|各说各的|控制|不被爱/);
  assert.match(row(p,'child').blockers.join('；'),/不指定是哪位父母/);
 }
 fixtures.forEach(([p,t,f])=>check(calc.analyzeParents(chart(p),'male'),t,f));
});

test('complete ten-god names keep hurting officer out of officials and rob wealth out of wealth',()=>{
 const {ctx,calc}=load();roles(ctx,{});
 const p=calc.analyzeParents(chart('丁巳 丁亥 甲寅 乙卯'),'male');
 const early=p.evidence.earlyEnvironment;
 assert.ok(early.nodes.filter(n=>n.role==='伤官').length>=2);
 assert.ok(early.nodes.filter(n=>n.role==='伤官').every(n=>n.theme==='expression'));
 assert.ok(early.themes.includes('expression'));
 assert.equal(early.themes.includes('rules'),false);
 assert.doesNotMatch(p.familyText,/守规矩|听谁的|按要求做/);
 const officials=calc.analyzeParents(chart('庚辰 辛酉 甲卯 丙午'),'male');
 assert.ok(officials.evidence.earlyEnvironment.nodes.filter(n=>n.role==='正官'||n.role==='七杀').every(n=>n.theme==='rules'));
 assert.ok(officials.evidence.earlyEnvironment.themes.includes('rules'));
 const peers=calc.analyzeParents(chart('壬辰 壬寅 癸亥 丙辰'),'male').evidence.earlyEnvironment;
 assert.ok(peers.nodes.filter(n=>n.role==='劫财').length>=2);
 assert.ok(peers.nodes.filter(n=>n.role==='劫财').every(n=>n.theme==='independence'));
 assert.ok(peers.themes.includes('independence'));
 assert.equal(peers.themes.includes('practical'),false);
});

test('help restrained elsewhere is not expanded into personal arguments or lack of care',()=>{
 const {ctx,calc}=load();roles(ctx,{水:'喜神'});
 const p=calc.analyzeParents(chart('癸亥 癸酉 甲卯 丁巳'),'male'),c=row(p,'mother');
 assert.equal(p.judgements.mother.support,true);
 assert.equal(p.judgements.mother.interactionFriction,false);
 assert.equal(c.reading.mode,'help_constrained');
 assert.ok(c.reading.parts.some(p=>p.key==='delivery_limits'));
 assert.equal(c.reading.parts.some(p=>p.key.startsWith('communication_')),false);
 assert.doesNotMatch(c.outcomeText,/意见分歧|过多安排|缺少关爱|母亲不爱/);
});

test('support disturbed by the same family-day root gets both help and a specific friction reading',()=>{
 const {ctx,calc}=load();roles(ctx,{金:'喜神'});
 const p=calc.analyzeParents(chart('庚辰 辛酉 壬卯 丙午'),'male'),c=row(p,'mother');
 assert.equal(p.judgements.mother.support,true);
 assert.equal(p.judgements.mother.interactionFriction,true);
 assert.equal(c.reading.mode,'help_with_friction');
 for(const key of ['practical_support','help_and_autonomy','communication_clash'])assert.ok(c.reading.parts.some(p=>p.key===key),key);
 assert.match(c.reading.parts.find(p=>p.key==='communication_clash').sourceRefs.join('；'),/月柱酉与日柱卯冲/);
 assert.doesNotMatch(c.outcomeText,/始终支持|关系融洽|父母离异/);
});

test('year-only help and its constraints remain about childhood, never current distance',()=>{
 const {ctx,calc}=load();roles(ctx,{水:'喜神'});
 const p=calc.analyzeParents(chart('癸亥 丁卯 甲午 丙寅'),'male'),c=row(p,'mother');
 assert.equal(c.reading.scope,'早年成长背景');
 assert.equal(c.reading.mode,'early_support_constrained');
 assert.ok(c.reading.parts.some(p=>p.key==='early_delivery_limits'));
 assert.equal(c.reading.parts.some(p=>p.key.startsWith('communication_')||p.key==='open_help'),false);
 assert.doesNotMatch(c.outcomeText,/需要帮助时会靠近|自己的意愿却没有同等位置/);
});

test('neutral readings stay neutral and absent symbols do not acquire biographical paragraphs',()=>{
 const {ctx,calc}=load();roles(ctx,{});
 const p=calc.analyzeParents(chart('癸亥 癸卯 甲午 丙寅'),'male'),c=row(p,'mother');
 assert.equal(c.reading.mode,'interaction_theme');
 assert.equal(c.reading.parts.length,1);
 assert.equal(c.reading.parts[0].key,'neutral_topic');
 assert.doesNotMatch(c.outcomeText,/被干涉|压力偏向|亲近中|总能|始终/);
 const absent=calc.analyzeParents(chart('甲子 己丑 丙寅 戊戌'),'male');
 assert.equal(row(absent,'mother').reading,null);
 assert.equal(row(absent,'father').reading,null);
});

test('parent passages and inherited family themes remain attributable across 512 readings',()=>{
 const {calc}=load();let seed=0x92317;
 const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
 const modes=new Set(),communication=new Set();let paragraphs=0;
 for(let i=0;i<256;i++){
  const h=next(24),b=calc.calculate(1950+next(71),1+next(12),1+next(28),Math.floor((h+1)%24/2),'male',h);
  const m=calc.analyzeParents(b,'male'),f=calc.analyzeParents(b,'female');
  assert.equal(JSON.stringify(m.claims),JSON.stringify(f.claims));
  for(const c of m.claims){
   if(c.status!=='insufficient')assert.doesNotMatch(c.outcomeText,/可以先抓住|这条线索指向|解读重点|最具体的观察点|关系的连接点|这一侧的互动主题/);
   if(!c.reading)continue;
   assert.ok(c.outcomeText.startsWith(c.reading.headline));
   assert.equal(new Set(c.reading.parts.map(p=>p.text)).size,c.reading.parts.length);
   for(const part of c.reading.parts){
    paragraphs++;
    assert.ok(part.requiredConditions.length&&part.requiredConditions.every(c=>c.met),part.key);
    assert.ok(part.sourceRefs.length,part.key);assert.equal(part.realityConfirmed,false);
    assert.ok(c.outcomeText.includes(part.title+'：'+part.text));
    assert.doesNotMatch(part.text,/父亲从商|母亲不爱|父母离异|晚年福气|不爱诉苦|每周|每天/);
   }
  }
  for(const key of ['father','mother']){
   const c=row(m,key),j=m.judgements[key];
   if(!c.reading)continue;
   modes.add(c.reading.mode);
   const frictionParts=c.reading.parts.filter(p=>p.key.startsWith('communication_'));
   assert.equal(frictionParts.length>0,j.interactionFriction);
   frictionParts.forEach(p=>communication.add(p.key));
   if(c.reading.mode==='help_available')assert.ok(j.support&&!j.interactionFriction);
   if(c.reading.scope==='早年成长背景')assert.equal(c.reading.parts.some(p=>p.scope!=='早年成长背景'),false);
  }
 }
 for(const mode of ['help_available','help_with_friction','help_constrained','expectations','expectations_and_friction','interaction_theme','early_theme'])assert.ok(modes.has(mode),mode);
 for(const mode of ['communication_clash','communication_repeated_standard','communication_mismatch'])assert.ok(communication.has(mode),mode);
 assert.ok(paragraphs>600);
});

test('family narrative paragraphs are escaped and rendered as readable blocks',()=>{
 const {ctx}=load();ctx.document={addEventListener(){},getElementById(){return null;}};
 vm.runInContext(fs.readFileSync(path.join(root,'js/result.js'),'utf8'),ctx);
 const html=ctx.parentNarrativeHTML('总体判断。\n\n相处方式：<img src=x onerror=bad()>\n\n<script>x</script>：细节');
 assert.equal((html.match(/<p>/g)||[]).length,3);
 assert.match(html,/<strong>相处方式：<\/strong>/);
 assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);
 assert.doesNotMatch(html,/<img|<script>/);
});

test('AI gets passage scope and must preserve supported everyday relationship detail',()=>{
 const {calc}=load();
 const text=require('../api/ai-chat.js')._test.buildChartContext({parentAnalysis:calc.analyzeParents(chart('癸未 庚申 甲寅 戊辰'),'male')});
 assert.match(text,/生活化解读分支：/);assert.match(text,/的成立条件：/);
 assert.match(text,/不压缩成只有“资源、边界”两个词/);
 assert.match(text,/help_constrained只讲帮助落实有条件/);
 assert.match(text,/早年成长背景只谈成长影响/);
});
