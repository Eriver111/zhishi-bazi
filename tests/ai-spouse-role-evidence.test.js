'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateChartEvidence,chartEvidenceContext}=require('../lib/ai-chart-evidence');
const code='E10-本人配偶星角色串位';
function chart(gender='male',dayMaster='乙'){
  return {type:'bazi',birthInfo:{gender},fourPillars:{year:{gan:'癸',zhi:'丑'},month:{gan:'辛',zhi:'酉'},
    day:{gan:dayMaster,zhi:'亥'},hour:{gan:'己',zhi:'卯'}}};
}
const roleWarnings=(data,text,question='请回看我 2010 年的具体事情。')=>validateChartEvidence(data,text,question).filter(w=>w.startsWith(code));
test('captured JE30 male reasoning cannot adopt the female husband-star role',()=>{
  const reason='流年庚金正官透出，与日干乙木天干五合，正官为夫星，日干为本人，合即牵绊、结合；同时流年寅与日支亥六合，日支正是夫妻宫，夫妻宫被合动，是最直接的婚姻完成信号。';
  const warnings=roleWarnings(chart(),reason);
  assert.equal(warnings.length,1);assert.match(warnings[0],/男命/);assert.match(warnings[0],/财星/);
  assert.match(warnings[0],/不判断婚事/);
});
test('role consistency works across all day masters and both explicitly supplied genders',()=>{
  for(const dm of '甲乙丙丁戊己庚辛壬癸'){
    for(const text of ['正官为夫星。','七杀是你的配偶星。','你的妻星是正官。','正官（夫星）在这一年出现。','财星为你的夫星。'])
      assert.equal(roleWarnings(chart('male',dm),text).length,1,dm+text);
    for(const text of ['正财为妻星。','偏财代表你的配偶星。','你的夫星是正财。','财星（夫星）出现。','官杀是你的妻星。'])
      assert.equal(roleWarnings(chart('female',dm),text).length,1,dm+text);
    for(const text of ['财星是你的妻星。','你的配偶星是正财。','正财代表财物，也可看配偶。'])
      assert.deepEqual(roleWarnings(chart('male',dm),text),[]);
    for(const text of ['正官为夫星。','你的配偶星是七杀。','官杀也代表制度和工作。'])
      assert.deepEqual(roleWarnings(chart('female',dm),text),[]);
  }
});
test('general teaching and another person never borrow the current chart gender',()=>{
  for(const text of [
    '女命以正官为夫星，男命以财星为妻星。','一般来说，女性的正官为夫星。',
    '这里讨论女命：\n正官为夫星。','先举一个女命例子。正官为夫星。',
    '她的八字，正官为夫星。','你妻子的八字，正官为夫星。','另一位命主的正官为夫星。',
    '小张的命盘里，正官为夫星。','合盘里的女方，正官为夫星。'
  ])assert.deepEqual(roleWarnings(chart(),text),[],text);
  for(const question of ['女命怎么取夫星？','解释一下男女命如何取配偶星。','我妻子的命盘怎么取夫星？','小张的八字怎么看？',
    '我妻子的盘怎么看？','看看我女朋友。','换成另一张盘看看。','甲方的盘怎么看？','看我妈妈这张盘。'])
    assert.deepEqual(roleWarnings(chart(),'正官为夫星。',question),[],question);
});
test('quotation, negation, hypotheticals, questions and corrections are not adopted assertions',()=>{
  for(const text of [
    '“正官为夫星”，这句话不能套到你身上。','有人说正官为夫星，我不赞同。',
    '上次说正官为夫星，是把性别看错了。','引用：\n正官为夫星。',
    '不能把正官为夫星用在你身上。','不是正官为夫星。','并非正官为夫星。',
    '正官为夫星的说法不对。','正官为夫星，这是错误的说法。',
    '如果按女命讨论，正官为夫星。','假设正官为夫星，接下来另说。','若正官为夫星，就要换参照。',
    '正官为夫星吗？','正官为夫星？','是不是正官为夫星，要先核对。',
    '你问“正官为夫星吗”；男命需要看财星。','```\n正官为夫星。\n```'
  ])assert.deepEqual(roleWarnings(chart(),text),[],text);
  assert.deepEqual(roleWarnings(chart(),'男命以财星为配偶星。','是不是正官为夫星？'),[]);
});
test('an explicit reset to current person is checked after generic teaching or another person',()=>{
  for(const text of ['女命一般以正官为夫星。回到你的命盘，正官是你的夫星。',
    '先看她的八字，正官为夫星。再看你的命盘，正官为妻星。',
    '不能说正官为夫星，但你的正官是妻星。'])
    assert.equal(roleWarnings(chart(),text).length,1,text);
});
test('unknown gender, another chart mode, or invalid literal chart cannot produce spouse-role correction',()=>{
  for(const data of [chart(null),chart('unknown'),chart('男'),{...chart(),birthInfo:{}},
    {...chart(),type:'hepan'},{...chart(),type:'ziwei'},{birthInfo:{gender:'male'}}]){
    assert.deepEqual(roleWarnings(data,'正官为夫星。'),[]);
  }
});
test('alternative references and special partner conventions do not infer orientation or real relationship roles',()=>{
  for(const question of ['请合盘看看双方。','以妻子为日主论十神。','请换太极看对方。','以朋友为参照，正官为夫星吗？',
    '换日主后再论。','男男伴侣关系用什么口径？','这次按特殊取法讨论。'])
    assert.deepEqual(roleWarnings(chart(),'正官为夫星。',question),[],question);
  for(const text of ['以妻子为日主来看，正官为夫星。','这段用另一口径，正官为夫星。','男男伴侣的取法不同，正官为夫星。'])
    assert.deepEqual(roleWarnings(chart(),text),[],text);
});
test('generation context supplies the same known-gender convention without asserting a marriage',()=>{
  for(const dm of '甲乙丙丁戊己庚辛壬癸')for(const gender of ['male','female']){
    const data=chart(gender,dm),context=chartEvidenceContext(data);
    assert.match(context,/本盘传统配偶星角色核对/);
    assert.match(context,gender==='male'?/男命，财星对应妻星\/配偶星/:/女命，官杀对应夫星\/配偶星/);
    assert.match(context,/同一节点的多种角色不是多条独立证据/);
    assert.match(context,/不能仅此断结婚或离婚/);
    assert.deepEqual(roleWarnings(data,context),[]);
  }
  for(const data of [chart(null),chart('unknown'),{...chart(),birthInfo:{}},{...chart(),type:'hepan'}])
    assert.doesNotMatch(chartEvidenceContext(data),/本盘传统配偶星角色核对/);
});
test('finding a literal role error does not assert or rewrite any event or family fact',()=>{
  const data=chart(),before=JSON.stringify(data),reply='本人在 2010 年完成结婚。正官为夫星。';
  const warnings=roleWarnings(data,reply);assert.equal(warnings.length,1);assert.equal(JSON.stringify(data),before);
  assert.doesNotMatch(warnings[0],/没有结婚|必然|已经离婚|另有对象|妻子出事/);
  assert.deepEqual(roleWarnings(data,'2010 年结婚了，正官参与工作关系。'),[]);
});
test('reviewed attributed or switched-perspective statements are not current-person claims',()=>{
  for(const text of ['老师说正官为夫星，我不赞同。','正官是你的夫星，是沿用女命说法举例，不代表你。',
    '以妻星为中心重新论十神，正官为夫星。','站在妻子的角度，正官为夫星。','就她而言，正官为夫星。',
    '老师说：\n正官为夫星。'])assert.deepEqual(roleWarnings(chart(),text,'请看我的婚姻。'),[],text);
  for(const text of ['你这个男命，正官为夫星。','回到你这个男命：正官为夫星。'])
    assert.equal(roleWarnings(chart(),text,'请看我的婚姻。').length,1,text);
  assert.equal(roleWarnings(chart(),'老师说正官为夫星，但你的正官是妻星。').length,1);
});

test('captured RCY male claim cannot relabel an officer as the personally assigned romance star',()=>{
 const text='**一、流年乙木正官透出，正是你这盘的感情星。** 你是戊土日主，男命看财星为妻星，但1985年天干乙木是正官——官星代表正式关系、名分、责任。';
 const data=chart('male','戊'),before=JSON.stringify(data),warnings=roleWarnings(data,text,'回看1985年感情方面发生了什么？');
 assert.equal(warnings.length,1);assert.match(warnings[0],/正官透出，正是你这盘的感情星/);
 assert.equal(JSON.stringify(data),before);
 for(const gender of ['male','female'])for(const dm of '甲乙丙丁戊己庚辛壬癸'){
  const wrong=gender==='male'?'正官':'正财',right=gender==='male'?'正财':'正官';
  for(const statement of [wrong+'是你的感情星。','你的婚恋星是'+wrong+'。'])
   assert.equal(roleWarnings(chart(gender,dm),statement).length,1,gender+dm+statement);
  assert.deepEqual(roleWarnings(chart(gender,dm),right+'是你的感情星。'),[]);
 }
});

test('romance alias preserves negation, attribution, another-person and questioning protection',()=>{
 for(const text of [
  '“正官透出，正是你这盘的感情星。”这句话不对。',
  '老师说正官是你的感情星，我不赞同。','上次说正官是你的感情星，是把角色写错了。',
  '不能说正官是你的感情星。','不是正官是你的感情星。','正官是你的感情星的说法不对。',
  '正官是你的感情星吗？','假设正官是你的感情星，再讨论。',
  '引用：\n正官是你的感情星。','先看她的八字。正官是你的感情星。',
  '女命一般看官星。正官是你的感情星。','换太极后，正官是你的感情星。'
 ])assert.deepEqual(roleWarnings(chart(),text),[],text);
 assert.deepEqual(roleWarnings(chart(),'正官是你的感情星。','我妻子的命盘怎样看？'),[]);
 assert.equal(roleWarnings(chart(),'先看她的八字。再看你的命盘，正官是你的感情星。').length,1);
});

test('expression, palace and generic relationship influence do not become spouse identity assertions',()=>{
 for(const text of [
  '伤官是你的感情星，这里只讨论表达情绪。','食神是你的感情星，这里只讨论相处表达。',
  '正官参与本年的感情议题，不等于它是你的配偶星。','你的感情里，官星代表责任。',
  '正官透出，会影响你对感情的表达。','日支夫妻宫说明感情关系的变化。',
  '这里把正官称为感情星，只是泛指它参与感情讨论。','正官是感情星。'
 ])assert.deepEqual(roleWarnings(chart(),text),[],text);
});
