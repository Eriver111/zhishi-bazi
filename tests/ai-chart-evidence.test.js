'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chartEvidence,chartEvidenceContext,validateChartEvidence}=require('../lib/ai-chart-evidence');
const chart = words => ({fourPillars:Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:words[i][0],zhi:words[i][1]}]))});
const doctor=chart(['辛酉','戊戌','甲戌','丁卯']);
const water=chart(['丁巳','丙午','壬寅','庚子']);

test('day master is the owner rather than an additional peer seizing wealth',()=>{
  for(const day of '甲乙丙丁戊己庚辛壬癸'){
    const data=chart(['乙卯','丙戌',day+'子','甲子']);
    for(const text of ['日柱'+day+'比肩（都是同辈、合伙人、竞争者这一路）在克财。','日干'+day+'代表你的竞争者。'])
      assert.ok(validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
    for(const text of ['日柱'+day+'是你自己，其他位置的比劫才另看。','不能把日干'+day+'视为竞争者。','“日干'+day+'是合伙人”的说法不成立。','日干'+day+'不是同行。','日支藏比肩可另看，日干'+day+'负责承财。'])
      assert.ok(!validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
  }
});
test('short annual-branch assertions cannot invent a different wealth clash year',()=>{
  for(const reply of ['同时流年辰土冲月柱戌土。','流年己土透出。','流年戊辰引动财库。'])
    assert.ok(validateChartEvidence(doctor,reply,'回看2008年财富上发生了什么？').some(w=>w.includes('流年干支串位')),reply);
  for(const reply of ['流年戊子，戊土透出。','流年子水参与。','不能说流年辰土冲戌。','2008年分析完毕。2012年流年辰土冲戌。','如果流年辰土参与，这是另一种情况。'])
    assert.ok(!validateChartEvidence(doctor,reply,'回看2008年财富上发生了什么？').some(w=>w.includes('流年干支串位')),reply);
});

test('a counted group containing the day stem cannot become other people seizing money across sentences',()=>{
  for(const day of '甲乙丙丁戊己庚辛壬癸'){
    const data=chart(['乙卯','丙戌',day+'子','甲子']);
    for(const text of [
      '年柱乙木劫财、日柱'+day+'、时柱甲木，三条线都在克这个戊土偏财。劫财、比肩就是同类竞争者，说明这笔钱被别人抢先、被合作方分掉。',
      '年柱乙、日干'+day+'、时柱甲三股力量都克财。这几股都是同辈，来分钱。'
    ])assert.ok(validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
  }
});

test('ownership group guard preserves legitimate peers, self control, quotations and explicit separation',()=>{
  const data=chart(['乙卯','丙戌','甲寅','甲子']);
  for(const text of [
    '年柱乙、日柱甲、时柱甲三条线都克财。日主甲是本人，其他位置的比劫另看，不能直接说被别人分走。',
    '日主甲是自己承财。年柱乙、时柱甲两股力量克财，存在其他人争财的线索。',
    '年柱乙、时柱甲两条线都克财。这些比劫可能参与分钱，但不能据此确认。',
    '年柱乙、日柱甲、时柱甲三条线都克财。这不是三个人，也不证明被别人分走。',
    '年柱乙、日柱甲、时柱甲三条线都克财。日主自己能控制财的负担，其他比劫是否帮忙另看。',
    '“年柱乙、日柱甲、时柱甲三条线都克财。它们是竞争者，来分钱。”这是错误示范。',
    '> 年柱乙、日柱甲、时柱甲三条线都克财。都是同辈，来分钱。',
    '不能把年柱乙、日柱甲、时柱甲三条线都克财，解释成都是同类来分钱。',
    '如果年柱乙、日柱甲、时柱甲三条线都克财，也不能理解为它们都是来分钱的。',
    '对方年柱乙、日柱甲、时柱甲三条线都克财，它们是竞争者，来分钱。'
  ])assert.ok(!validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
  for(const type of ['hepan','ziwei','liuyao'])assert.deepEqual(validateChartEvidence({...data,type},'年柱乙、日柱甲、时柱甲三条线都克财。这几个都是同行，来分钱。'),[]);
});

test('visible actor facts distinguish owner from peer carriers without counting people',()=>{
  const data=chart(['乙卯','丙戌','甲寅','甲子']);
  const text=chartEvidenceContext(data);
  assert.match(text,/日干甲是本人/);assert.match(text,/年干乙（劫财）、时干甲（比肩）/);
  assert.match(text,/同类字的数量不是竞争者人数/);
});

test('named self and peers grouped by element do not imply someone else stole the wealth',()=>{
  const data=chart(['乙卯','丙戌','甲寅','甲子']);
  for(const text of [
    '年干乙、日干甲、时干甲都是木，木克土，等于财一露头就被抢。',
    '年柱乙木、日柱甲木、时柱甲木都是木，木克土，说明你的财被别人拿走。'
  ])assert.ok(validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
  for(const text of [
    '年干乙、日干甲、时干甲都是木，木克土，不等于财一露头就被抢。',
    '年干乙、日干甲、时干甲都是木，木克土，只表示几处控制关系，日主是自己。',
    '年干乙、时干甲都是木，木克土，说明有竞争线索。',
    '“年干乙、日干甲、时干甲都是木，木克土，等于财被抢。”不成立。'
  ])assert.ok(!validateChartEvidence(data,text).some(w=>w.includes('日主归属错误')),text);
});

test('captured source-mechanism replies cannot invent six-harm or six-break pairs',()=>{
  for(const text of ['辰与你的日支申（夫妻宫）形成六破。','大运未与流年酉形成六害。','辰申六破使夫妻宫拆散。']){
    assert.ok(validateChartEvidence(doctor,text).some(w=>/E10-明示地支六[害破]配对错误/.test(w)),text);
  }
  for(const text of ['辰与你的时支丑形成六破。','午与时支丑六害。','寅亥六破。','辰申六破的说法不成立。','不能说辰与申相破。','假若辰与申六破，这只是错误示范。','原文说辰申六破，需要纠正。'])assert.deepEqual(validateChartEvidence(doctor,text),[],text);
  const pairs={六害:['子未','丑午','寅巳','卯辰','申亥','酉戌'],六破:['子酉','丑辰','寅亥','卯午','巳申','未戌']};
  for(const [kind,list]of Object.entries(pairs))for(const pair of list)for(const order of [pair,pair[1]+pair[0]])assert.deepEqual(validateChartEvidence(doctor,order+kind+'，仅指配对关系。'),[]);
});
test('literal eight-character counts exclude lunar-month and hidden-stem weights',()=>{
  const result=chartEvidence(water);
  assert.equal(result.literal.火,4);assert.equal(Object.values(result.literal).reduce((a,b)=>a+b,0),8);
  assert.deepEqual(result.roots,['hour']);
  assert.match(chartEvidenceContext(water),/不含藏干、不加月令权重/);
});
test('captured live replies: weighted eight-fire claim and global root loss are caught',()=>{
  assert.equal(validateChartEvidence(water,'火有八个，是全局最重的力量。').length,1);
  assert.equal(validateChartEvidence(water,'你有8个火。').length,1);
  assert.equal(validateChartEvidence(doctor,'时柱卯木是你的根。但你自己日主无根，容易被推着走。').length,1);
  assert.equal(validateChartEvidence(doctor,'日主甲木原局无根。').length,1);
});
test('scope, quotation, negation and correctly identified reference values remain allowed',()=>{
  for(const text of ['日主在日支无根，时支卯有根。','日主无根的说法不成立。','不能说日主无根。','“日主无根”的判断是错的。','假如日主无根，要看其他条件。']) assert.deepEqual(validateChartEvidence(doctor,text),[],text);
  for(const text of ['火有4个。','火的加权参考值为8。','不是火有八个。','有八个火的说法不对。','算上藏干计火有八个。']) assert.deepEqual(validateChartEvidence(water,text),[],text);
});
test('malformed, other-mode or double-chart data cannot drive single-chart corrections',()=>{
  for(const data of [null,{}, {fourPillars:{day:{gan:'壬',zhi:'子'}}}, {...doctor,type:'hepan'}, {...doctor,type:'ziwei'}, {...doctor,type:'liuren'}]) assert.deepEqual(validateChartEvidence(data,'日主无根，火有八个。'),[]);
});

test('partial counts, hidden-stem scopes and quoted corrections never become whole-chart errors',()=>{
  const data=chart(['戊辰','丁巳','己巳','丁卯']);
  for(const text of ['天干有两个火，丁火两透。','地支有两个火。','含藏干在内，木有两个。','木有两个（含藏干）。','根受制不等于日主无根。','有人说日主无根，我不赞同。','你上一轮说“金有三个”，这里需要纠正。','大运加入后，木有三个。']) assert.deepEqual(validateChartEvidence(data,text),[],text);
  assert.equal(validateChartEvidence(data,'天干有八个火。').length,1);
});
test('all ten stems use same-element hidden roots rather than matching exact polarity',()=>{
  const expected={甲:'寅',乙:'寅',丙:'巳',丁:'巳',戊:'丑',己:'丑',庚:'酉',辛:'酉',壬:'子',癸:'子'};
  for(const [gan,zhi] of Object.entries(expected)) {
    const data=chart(['甲'+zhi,'乙'+zhi,gan+zhi,'丙'+zhi]);
    assert.equal(chartEvidence(data).roots.length,4,gan);
    assert.equal(validateChartEvidence(data,'日主无根。').length,1,gan);
  }
});

test('later correction and explicit count-scope reset do not trigger a repair',()=>{
  const data=chart(['戊辰','丁巳','己巳','丁卯']);
  for(const text of ['天干有两个火，全局有四个火。','日主无根，这个说法不对。','把日主无根视作既定事实是不对的。','金有三个，这个说法是错的。','火有两个（天干）。','天干和地支合计有四个火。']) assert.deepEqual(validateChartEvidence(data,text),[],text);
  assert.deepEqual(validateChartEvidence(chart(['乙巳','己丑','丙子','丁酉']),'假如只看日支，日主无根；放回全局则有根。'),[]);
  assert.equal(validateChartEvidence(data,'天干有两个火，全局有八个火。').length,1);
  assert.equal(validateChartEvidence(data,'火有三个（天干）。').length,1);
});

test('holdout reply cannot move a decade branch into the natal chart',()=>{
  const data=chart(['庚申','丁亥','甲午','甲戌']);
  assert.equal(validateChartEvidence(data,'丑一来，和你原局里的未、戌凑成三刑。').length,1);
  for(const text of ['大运的未和原局里的戌受流年引动。','原局未见未土。','“原局里的未、戌”这个说法不对。','原局里的亥、午与岁运作用。']) assert.deepEqual(validateChartEvidence(data,text),[],text);
  const other=chart(['乙未','己丑','丙午','戊戌']);
  assert.deepEqual(validateChartEvidence(other,'流年与原局里的未、戌形成关系。'),[]);
});

test('counts of roots or exposed stems are not literal eight-character counts',()=>{
  assert.deepEqual(validateChartEvidence(doctor,'甲木有一个根，在时支卯木。'),[]);
  assert.deepEqual(validateChartEvidence(chart(['戊辰','丁巳','己巳','丁卯']),'火有两个透干，另有两个巳火藏支。'),[]);
  assert.equal(validateChartEvidence(water,'火有八个，是全局最重的力量。').length,1);
});

const timedChart=()=>({...chart(['乙丑','己丑','丙辰','庚寅']),daYun:{cycles:[
  {gan:'丁',zhi:'亥',startYear:1997,endYear:2006},
  {gan:'丙',zhi:'戌',startYear:2007,endYear:2016},
  {gan:'乙',zhi:'酉',startYear:2017,endYear:2026}
]}});
test('calendar range context comes from supplied cycles, never from displayed ages',()=>{
  const data=timedChart();data.daYun.cycles[1].displayAge='21—30';
  assert.match(chartEvidenceContext(data),/丙戌运 2007—2016年/);
  assert.match(chartEvidenceContext(data),/岁运天克地冲、伏吟或体感转折不等于刚换大运/);
  assert.doesNotMatch(chartEvidenceContext(data),/丙戌运 21/);
});
test('captured W04 reply cannot turn a year inside a decade into its handover',()=>{
  const question='回看2012年，请判断当年最突出的具体事件。';
  const reply='2012年最突出的两件事：那年你26岁，正处在换大运的节点上——旧的一段（丙戌运）刚结束，新的一段（乙酉运）刚接手，流年壬辰又和大运天克地冲。';
  const warnings=validateChartEvidence(timedChart(),reply,question);
  assert.equal(warnings.length,1);assert.match(warnings[0],/换运年份错误/);assert.match(warnings[0],/丙戌大运（2007—2016年）/);
  for(const text of ['那年刚换大运。','当年丙戌运刚结束。','你那时刚进入乙酉运。','2012年是换运年。'])
    assert.match(validateChartEvidence(timedChart(),text,question)[0],/换运年份错误/,text);
});
test('calendar handover guard preserves boundary years and their adjacent years',()=>{
  for(const year of [2006,2007,2008,2015,2016,2017,2018])
    assert.deepEqual(validateChartEvidence(timedChart(),'那年刚换大运。','回看'+year+'年。'),[],String(year));
  for(const year of [2009,2014])
    assert.equal(validateChartEvidence(timedChart(),'那年刚换大运。','回看'+year+'年。').length,1,String(year));
});
test('ambiguous, missing or overlapping source timing cannot reject a handover',()=>{
  const overlap=timedChart();overlap.daYun.cycles[2].startYear=2016;
  const missing=timedChart();delete missing.daYun.cycles[2].endYear;
  const ages=timedChart();ages.daYun.cycles=ages.daYun.cycles.map(c=>({...c,startYear:21,endYear:30}));
  for(const data of [chart(['乙丑','己丑','丙辰','庚寅']),overlap,missing,ages])
    assert.deepEqual(validateChartEvidence(data,'2012年刚换大运。','回看2012年。'),[]);
  for(const question of [undefined,'最近怎么样','回看2012年和2017年。','那年26岁吗'])
    assert.deepEqual(validateChartEvidence(timedChart(),'那年刚换大运。',question),[]);
});
test('metaphor, negation, quoted mistakes and corrections are not factual handover claims',()=>{
  for(const text of [
    '2012年的体感有过渡感，像换挡一样，不等于刚换大运。',
    '2012年好像正处在换大运的节点，这只是比喻。',
    '2012年并不是刚换大运，而是在丙戌运中段。',
    '那年并没有刚进入乙酉运。',
    '不能把当年说成刚换大运。',
    '“2012年刚换大运”的说法不对。',
    '2012年刚换大运，这个说法不成立。',
    '上一轮说2012年刚换大运，需要纠正。',
    '如果那年刚换大运，就要另看，实际仍处丙戌运。',
    '2012年有一种刚换大运的感觉。',
    '那年是否刚换大运，要看原排盘。',
    '那年刚换大运吗？',
    '那年可能刚进入乙酉运，需要另行确认。',
    '到以后刚进入乙酉运时另论。',
    '2017年刚进入乙酉运。那年刚换大运。',
    '2012年岁运天克地冲，是人生转折点。',
    '你正处于过渡阶段，但不是换运。'
  ]) assert.deepEqual(validateChartEvidence(timedChart(),text,'回看2012年。'),[],text);
});
test('handover corrections stay single-chart and need source evidence rather than model text',()=>{
  const question='回看2012年。';
  assert.deepEqual(validateChartEvidence({...timedChart(),type:'hepan'},'2012年刚换大运。',question),[]);
  const data={...timedChart(),type:'bazi'};
  assert.equal(validateChartEvidence(data,'2012年刚换大运，源排盘2012年开始乙酉运。',question).length,1);
  assert.deepEqual(validateChartEvidence(data,'2012年在丙戌运中，2017年才换到乙酉运。',question),[]);
});

test('a public captured reply cannot borrow a future decade for the requested past year',()=>{
 const data={...chart(['辛酉','庚寅','辛巳','甲午']),daYun:{cycles:[
  {gan:'丁',zhi:'亥',startYear:2010,endYear:2019},{gan:'丙',zhi:'戌',startYear:2020,endYear:2029}
 ]}};
 const q='回看2015年，请判断当年的具体事件。';
 const bad='那年你34岁，正走丙戌大运（2020年前的十年），流年乙未。';
 assert.ok(validateChartEvidence(data,bad,q).some(w=>w.startsWith('E10-所行大运串位')));
 for(const text of ['当时在丙戌运中。','2015年所走的大运是丙戌运。'])
  assert.ok(validateChartEvidence(data,text,q).some(w=>w.startsWith('E10-所行大运串位')),text);
 for(const text of [
  '那年正走丁亥大运，2020年以后才走丙戌。',
  '2025年正走丙戌大运。',
  '以后正走丙戌运时另论。',
  '不能说那年正走丙戌运。',
  '“正走丙戌大运”的说法不对。',
  '如果当时在丙戌运，就应另论。',
  '大运列表中还有丙戌运，不是当年所走的运。'
 ]) assert.equal(validateChartEvidence(data,text,q).some(w=>w.startsWith('E10-所行大运串位')),false,text);
 const ambiguous={...data,daYun:{cycles:[...data.daYun.cycles,{gan:'戊',zhi:'子',startYear:2015,endYear:2024}]}};
 assert.equal(validateChartEvidence(ambiguous,bad,q).some(w=>w.startsWith('E10-所行大运串位')),false);
});

const annualChart=()=>({...chart(['丁巳','己酉','丁丑','癸卯']),daYun:{cycles:[
 {gan:'乙',zhi:'巳',startYear:2011,endYear:2020},{gan:'甲',zhi:'辰',startYear:2021,endYear:2030}
]}});
const hasCode=(data,text,question,code)=>validateChartEvidence(data,text,question).some(w=>w.startsWith(code));

test('captured live named-element and branch-pair mistakes trigger relation-specific corrections',()=>{
 const examples=[
  ['再加上寅木这个印星（主住处、文书、手续）和你的日支酉金相冲相克，钱和手续容易卡在同一个环节上反复。','地支六冲配对错误','寅申、酉卯'],
  ['天干癸水克日主己土，地支卯木冲日支酉金。','五行生克方向错误','己土克癸水'],
  ['依据是流年子水冲你的日支酉、又害时支未，日支是自身根基和伴侣宫。','地支六冲配对错误','子午、酉卯']
 ];
 for(const [reply,code,correct] of examples){
  const found=validateChartEvidence(doctor,reply).filter(w=>w.startsWith('E10-明示'));
  assert.equal(found.length,1,reply);assert.ok(found[0].includes(code));assert.ok(found[0].includes(correct));
  assert.match(found[0],/重新核对整个论证/);
 }
});

test('all explicit stem and branch element directions are checked without inferring effect or outcomes',()=>{
 const literal={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水',子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
 const rules={生:{木:'火',火:'土',土:'金',金:'水',水:'木'},克:{木:'土',土:'水',水:'火',火:'金',金:'木'}};
 for(const [a,x] of Object.entries(literal))for(const [b,y] of Object.entries(literal))for(const [kind,table] of Object.entries(rules)){
  const text=a+x+kind+'日主'+b+y+'。';
  assert.equal(hasCode(doctor,text,'','E10-明示五行生克方向错误'),table[x]!==y,text);
 }
 assert.equal(hasCode(doctor,'己土被癸水克。','','E10-明示五行生克方向错误'),true);
 assert.equal(hasCode(doctor,'癸水被己土克。','','E10-明示五行生克方向错误'),false);
 assert.equal(hasCode(doctor,'甲木克庚金，庚金克甲木。','','E10-明示五行生克方向错误'),true);
 assert.equal(hasCode(doctor,'庚金克甲木，甲木克庚金。','','E10-明示五行生克方向错误'),true);
 assert.equal(hasCode(doctor,'甲木与庚金相克，要看各自作用。','','E10-明示五行生克方向错误'),false);
});

test('every unordered branch pair respects fixed six-clash and six-combine tables in either direction',()=>{
 const branches='子丑寅卯辰巳午未申酉戌亥';
 const fixed={六冲:['子午','丑未','寅申','卯酉','辰戌','巳亥'],六合:['子丑','寅亥','卯戌','辰酉','巳申','午未']};
 for(const a of branches)for(const b of branches)for(const [type,pairs] of Object.entries(fixed)){
  const valid=pairs.includes(a+b)||pairs.includes(b+a);
  for(const text of [a+'与日支'+b+type+'。',a+b+type+'。'])
   assert.equal(hasCode(doctor,text,'','E10-明示地支'+type+'配对错误'),!valid,text);
 }
 for(const text of ['子水冲日支午火。','日支酉金与流年卯木相冲。','午火与未土六合。'])
  assert.equal(hasCode(doctor,text,'','E10-明示地支'),false,text);
 assert.equal(hasCode(doctor,'流年子水与日支酉金形成六合。','','E10-明示地支六合配对错误'),true);
});

test('quoted errors, denials, questions and hypotheses are not affirmative relation claims',()=>{
 for(const text of [
  '“天干癸水克日主己土”的说法是错的。',
  '上轮说子水冲你的日支酉，需要纠正。',
  '不能说子酉六冲。',
  '不是寅木与酉金相冲。',
  '子水冲日支酉，这个说法不对。',
  '癸水克己土，这种判断不成立。',
  '子水冲日支酉，这是错误的。',
  '癸水克己土，这不对。',
  '前文误写成癸水克己土，应纠正。',
  '引文：子水与酉金相冲。',
  '如果子水冲日支酉，要另论。',
  '假设癸水克己土，就要重新推导。',
  '若子酉六冲，另论。',
  '假定寅与酉六合，另论。',
  '子水冲日支酉吗？',
  '是否癸水克己土，需要核对。',
  '有人说“寅木与酉金相冲”，我不认同。',
  '己土克癸水，不是癸水克己土。',
  '子与午相冲，子与酉不是六冲。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示'),false,text);
});

test('literal relation guard does not reinterpret hidden stems, transformed qi or broad prose',()=>{
 for(const text of [
  '藏干作用另论，子水生戌土不是在说表层本五行。',
  '按合化后的气看，寅木克酉金另论。',
  '甲己化土后，甲木生庚金属于化气讨论。',
  '子水的藏干与午火中的己土有合，不是地支六合。',
  '巳与酉相合，属于半合线索。',
  '寅与午有半合，不能冒充六合。',
  '这段关系相冲，相互克制的感觉强。',
  '你克制了自己的冲动。',
  '子水冲动的表达要另看。',
  '冲日支需要看实际流年的支是什么。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示'),false,text);
 for(const data of [{...doctor,type:'hepan'}, {...doctor,type:'ziwei'}, null, {}])
  assert.deepEqual(validateChartEvidence(data,'癸水克己土，子酉六冲。'),[]);
});

test('captured partial-meeting reply checks the two named branches without changing chart inference',()=>{
 const data=chart(['己丑','戊辰','丁丑','丙午']);
 const warnings=validateChartEvidence(data,'申和你原局的丑形成半会金的牵引');
 assert.equal(warnings.length,1);
 assert.match(warnings[0],/^E10-明示地支半会组别错误/);
 assert.match(warnings[0],/申与丑/);
 assert.match(warnings[0],/仅核对组员，不判定合化、成局或现实吉凶/);
});

test('captured explicit ten-god reversal is corrected without changing polarity or chart conclusions',()=>{
 const before=JSON.stringify(doctor),warnings=validateChartEvidence(doctor,'正印克财。');
 assert.equal(warnings.length,1);
 assert.match(warnings[0],/^E10-明示十神生克方向错误/);
 assert.match(warnings[0],/正确关系是财克正印/);
 assert.match(warnings[0],/不判作用是否有效、正偏身份或现实结果/);
 assert.equal(JSON.stringify(doctor),before);
 assert.deepEqual(validateChartEvidence(doctor,'财克正印，但实际作用仍需另论。'),[]);
 assert.deepEqual(validateChartEvidence(doctor,'流年是正财，偏财与正财的身份另查。'),[],'this addition does not classify 正/偏身份');
});

test('every named ten-god and family pair follows the same five-family generate/control cycles across charts',()=>{
 const families={比肩:'比劫',劫财:'比劫',比劫:'比劫',食神:'食伤',伤官:'食伤',食伤:'食伤',正财:'财',偏财:'财',财星:'财',财:'财',正官:'官杀',七杀:'官杀',偏官:'官杀',官杀:'官杀',官星:'官杀',杀星:'官杀',正印:'印',偏印:'印',印星:'印',印:'印'};
 const rules={生:{比劫:'食伤',食伤:'财',财:'官杀',官杀:'印',印:'比劫'},克:{比劫:'财',财:'印',印:'食伤',食伤:'官杀',官杀:'比劫'}};
 for(const data of [doctor,water])for(const [a,x] of Object.entries(families))for(const [b,y] of Object.entries(families))for(const [kind,table] of Object.entries(rules)) {
  for(const text of [a+kind+b+'。',b+'被'+a+kind+'。'])
   assert.equal(hasCode(data,text,'','E10-明示十神生克方向错误'),table[x]!==y,text);
 }
 for(const text of ['正印直接克财。','偏印克你的正财。','正财被流年的偏印克。','以同一日主为参照，正印克财。','以同一日主为中心论十神，正印克财。'])
  assert.equal(hasCode(doctor,text,'','E10-明示十神生克方向错误'),true,text);
});

test('ten-god quotes, negations, questions, hypotheticals and explicit corrections remain outside affirmative assertions',()=>{
 for(const text of [
  '不能说正印克财。','不是正印克财。','没有正印克财。','不存在正印克财。',
  '正印克财不成立。','正印克财，这不对。','正印克财并不成立。','正印克财，并非如此。',
  '正印克财，这个说法是错误的。','“正印克财”是错的。','“先看正印，正印克财”的说法不对。',
  '“正印克财。”这是错误示范。','有人说：“先看正印。正印克财。”我不认同。',
  '正印克财这一说法不成立。','正印克财并不正确。','正印克财的说法不正确。',
  '正印克财，应改成财克印。','正印克财，准确说应当是财克印。',
  '有人说，正印克财，我不认同。','上轮说正印克财，应当纠正。','前文误写成正印克财。','原文：正印克财。',
  '如果正印克财，就另论。','假如出现正印，正印克财也须另论。','假设正印克财。','若正印克财，另论。',
  '倘若出现正印，正印克财也须另论。','若正印出现，正印克财也须另论。',
  '是否正印克财？','正印克财吗？','正印克财吗。','正印克财？','正印克财?',
  '财克正印，不是正印克财。','正印不克财。','财未被正印克。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示十神生克方向错误'),false,text);
});

test('an earlier correction does not excuse a later independent affirmative ten-god mistake',()=>{
 for(const text of [
  '不能说正印克财，但偏印克偏财。','“正印克财”不成立，偏印克偏财。',
  '上轮说正印克财，需要纠正；偏印克偏财。','正印克财，偏财克正印。',
  '正印克财？偏印克偏财。'
 ])assert.equal(validateChartEvidence(doctor,text).filter(w=>w.startsWith('E10-明示十神生克方向错误')).length,1,text);
});

test('ten-god direction guard skips other people, combined charts and changed day-master references',()=>{
 for(const text of [
  '对方的正印克财。','男方的正印克女方的正财。','她的正印克财。','甲命中正印克财。',
  '丈夫的正印克你的正财。','配偶的正印克你的正财。','妻子的正印克你的正财。',
  '张三的正印克你的正财。','丈夫正印克你的正财。','按配偶的日主取十神，正印克财。','把配偶当日主重新看十神，正印克财。',
  '双方按各自日主取十神。正印克财。','这是合盘讨论。正印克财。',
  '换以配偶为日主，正印克财。','改用另一日元为参照，正印克财。','以财星为太极，正印克财。',
  '以配偶为中心论十神，正印克财。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示十神生克方向错误'),false,text);
 for(const question of ['这是合盘，比较双方。','按对方的日主讨论。','换以财星为太极。'])
  assert.equal(hasCode(doctor,'正印克财。',question,'E10-明示十神生克方向错误'),false,question);
 for(const data of [{...doctor,type:'hepan'},{...doctor,type:'ziwei'},null,{}])
  assert.deepEqual(validateChartEvidence(data,'正印克财。'),[]);
});

test('broad restraint, wealth imagery and transformed or hidden-qi prose are not literal ten-god directions',()=>{
 for(const text of [
  '正印制财。','正印制约财星。','正印克制正财。','正财被正印克制。','财制印的有效性另论。',
  '正印克财运。','正印克财富。','正印克财务自由的想象。','印刷与财务没有关系。',
  '正印与财星相克。','正印有克制，有财星。','正印克的对象是财星。',
  '合化后再论正印克财。','正印克财是在讨论化气。','藏干作用另论，正印克财不是本五行断言。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示十神生克方向错误'),false,text);
});

test('partial combinations and meetings accept any two distinct members including arch endpoints',()=>{
 const groups={半合:['申子辰','亥卯未','寅午戌','巳酉丑'],半会:['寅卯辰','巳午未','申酉戌','亥子丑']};
 for(const [kind,sets] of Object.entries(groups))for(const a of '子丑寅卯辰巳午未申酉戌亥')for(const b of '子丑寅卯辰巳午未申酉戌亥'){
  const valid=a!==b&&sets.some(g=>g.includes(a)&&g.includes(b));
  for(const text of [a+b+kind+'。',a+'与日支'+b+'形成'+kind+'关系。',a+kind+'流年的'+b+'。'])
   assert.equal(hasCode(doctor,text,'','E10-明示地支'+kind+'组别错误'),!valid,text);
 }
 for(const text of ['寅戌半合火。','巳与丑构成半合金的牵引。','寅辰半会木。','亥与丑有半会水势。','申与戌构成三会金局的局部。','亥丑三会局部水势。'])
  assert.equal(hasCode(doctor,text,'','E10-明示地支'),false,text);
 for(const text of ['申与丑构成三会金局的局部。','寅、酉形成半合。','子午三会局部火势。','申与丑两支形成半会金。'])
  assert.equal(hasCode(doctor,text,'','E10-明示地支'),true,text);
});

test('partial-group denials, correction quotations and hypotheses do not become affirmative claims',()=>{
 for(const text of [
  '不能说申丑半会。','申与丑并非半会。','不是寅酉半合。','没有申丑半会关系。',
  '申丑半会不成立。','申与丑形成半会金的牵引，这个说法不对。',
  '“申和丑形成半会金的牵引”的说法是错的。','原文：申丑半会。',
  '前文误写成寅酉半合，应纠正。','上轮说申丑半会，需要纠正。',
  '有人说“先取金，申丑半会”，这个判断不对。',
  '有人说，申丑半会，我不认同。',
  '如果申丑半会，需要另论。','若寅酉半合，另论。','是否申丑半会？','申丑半会吗？',
  '申与酉半会，申与丑不是半会。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示地支'),false,text);
});

test('partial-group validation stays within each assertion after corrections and between clauses',()=>{
 for(const text of [
  '不能说申丑半会，但寅酉半合。','上轮说申丑半会，需要纠正；寅酉半合。',
  '上轮说申丑半会，寅酉半合则是明确关系。','“申丑半会”不成立，寅与酉半合。',
  '申与酉半会金，申与丑半会金。','申与丑半会，寅与午半合。'
 ])assert.equal(validateChartEvidence(doctor,text).filter(w=>/^E10-明示地支(?:半会|半合)组别错误/.test(w)).length,1,text);
 assert.equal(validateChartEvidence(doctor,'申丑半会；寅酉半合。').filter(w=>/^E10-明示地支/.test(w)).length,2);
});

test('partial-group guard leaves broad qi, unnamed references and full three-branch claims out of scope',()=>{
 for(const text of [
  '申和原局形成金气牵引。','金气增强，与原局有半会的可能。','申和你的日支形成半会金。',
  '原局的丑带来金气线索。','申与丑之间有金气牵引。',
  '寅午戌半合之说需另看。','申子辰半会之说需另看。','申、子、辰半会之说需另看。','申与酉与丑形成半会。',
  '申与酉构成半会火势。'
 ])assert.equal(hasCode(doctor,text,'','E10-明示地支'),false,text);
 for(const data of [{...doctor,type:'hepan'},{...doctor,type:'ziwei'},null,{}])
  assert.deepEqual(validateChartEvidence(data,'申丑半会。'),[]);
});
test('captured active-decade contradictions are not excused by a later parenthesis',()=>{
 const career=annualChart();
 for(const text of [
  '那年是甲辰大运中的甲午流年。',
  '那年你走的是甲辰大运（2021年前是乙巳运，2015年仍在乙巳运内）。',
  '当时所处运是甲辰大运。',
  '2015年处在甲辰大运中的这段时间。',
  '那年的大运为甲辰运。'
 ])assert.ok(hasCode(career,text,'回看2015年。','E10-所行大运串位'),text);
 const student={...chart(['甲戌','己巳','庚申','甲申']),daYun:{cycles:[
  {gan:'丁',zhi:'卯',startYear:2013,endYear:2022},{gan:'丙',zhi:'寅',startYear:2023,endYear:2032}
 ]}};
 const captured='那年你27岁，走的是丙寅大运（2023年之前的丁卯运刚交完，2023年才进丙寅——这里按2021年实际所处运程看，是丁卯运尾段）。';
 assert.ok(hasCode(student,captured,'回看2021年。','E10-所行大运串位'));
});
test('active-decade additions preserve reference year, source ambiguity and handover boundaries',()=>{
 const data=annualChart(),q='回看2015年。';
 for(const text of [
  '2025年走的是甲辰大运。那年处在甲辰运中。',
  '未来走的是甲辰大运；2015年实际走的是乙巳。',
  '下一步所处的大运是甲辰运。',
  '那年走的是甲辰大运，这个说法不对。',
  '不能说当时所处运是甲辰大运。',
  '如果当时所处运是甲辰大运，就要另论。',
  '若当时走的是甲辰大运，就要另论。',
  '有人说“那年走的是甲辰大运”，需要纠正。',
  '那年可能走的是甲辰大运。',
  '当时是否走的是甲辰大运？',
  '那年并没有正走甲辰大运。'
 ])assert.equal(hasCode(data,text,q,'E10-所行大运串位'),false,text);
 for(const year of [2011,2020,2021])assert.equal(hasCode(data,'当时走的是甲辰运。','回看'+year+'年。','E10-所行大运串位'),false,String(year));
 const overlap=annualChart();overlap.daYun.cycles[1].startYear=2020;
 assert.equal(hasCode(overlap,'当时走的是甲辰运。',q,'E10-所行大运串位'),false);
});
test('captured annual stem cannot borrow the decade stem and explicit branch is calendar checked',()=>{
 const data=annualChart();
 assert.ok(hasCode(data,'流年天干是乙木，正是你的核心用神。','回看2013年。','E10-流年干支串位'));
 const captured='一、那年走乙巳大运（2011—2020），巳火是你的喜神。巳与年支巳同气。二、流年天干是乙木，正是你的核心用神。';
 assert.ok(hasCode(data,captured,'回看2013年。','E10-流年干支串位'));
 assert.ok(hasCode(data,'那年走乙巳运（2011—2020）。但当时走的是甲辰运。','回看2013年。','E10-所行大运串位'));
 assert.ok(hasCode(data,'2013年流年的地支为午。','回看2013年。','E10-流年干支串位'));
 for(const text of ['流年天干是癸水，地支巳火。','大运天干是乙木。','流年地支为巳，属于火。'])
  assert.equal(hasCode(data,text,'回看2013年。','E10-流年干支串位'),false,text);
});
test('annual calendar guard preserves solar-year boundary and a different explicit year',()=>{
 const data=annualChart();
 for(const question of ['回看2013年1月。','回看2013年二月。','回看2013-01-20。','2013年立春之前如何？','农历2013年如何？','2013和2015年相比如何？','当年如何？'])
  assert.equal(hasCode(data,'流年天干是壬。',question,'E10-流年干支串位'),false,question);
 for(const text of [
  '2015年流年天干是乙木。',
  '2015年另说。流年天干是乙木。',
  '2013年立春前，流年天干是壬水。',
  '以下说2013年1月。流年天干是壬水。',
  '流年天干是壬水（这里指立春前）。',
  '去年流年天干是壬水。',
  '“流年天干是乙木”的说法不对。',
  '如果流年天干是乙木，那就是另一年。',
  '若流年天干是乙木，需要另论。',
  '此前说流年天干是乙木，需要纠正。',
  '不能说流年天干是乙木。'
 ])assert.equal(hasCode(data,text,'回看2013年。','E10-流年干支串位'),false,text);
});
test('named natal branch elements resolve every member of a coordinated phrase',()=>{
 const data=chart(['辛巳','甲午','癸丑','癸亥']);
 const captured='卯与年支、时支的水形成半合木势，木是你的忌神。';
 const warning=validateChartEvidence(data,captured,'回看2023年。').find(w=>w.startsWith('E10-原局支五行串位'));
 assert.match(warning,/年支巳属火/);assert.doesNotMatch(warning,/时支亥属/);
 for(const text of ['年支与时支都属水。','月支本五行为土。','年支的本五行是水。'])
  assert.ok(hasCode(data,text,'回看2023年。','E10-原局支五行串位'),text);
 for(const text of ['年支和月支都是火。','日支属于土。','时支的水参与半合木势。'])
  assert.equal(hasCode(data,text,'回看2023年。','E10-原局支五行串位'),false,text);
});
test('natal branch element guard excludes hidden stems, transformed qi and another source',()=>{
 const data=chart(['辛巳','甲午','癸丑','癸亥']);
 for(const text of [
  '日支的水藏干也要另看。',
  '日支的水属于藏干。',
  '日支的水指的是藏干。',
  '从藏干看，日支的水不能忽略。',
  '年支的金（藏干庚金）不是表层支的本五行。',
  '若合化成功，年支的水势另论。',
  '半合后年支、时支为水，须另看能否成化。',
  '年支的水（指合化后的五行）不是原本五行。',
  '年支的水是合化后的五行。',
  '对方的年支为水，自己的年支为火。',
  '2012年的年支为水，是另一个日期的例子。',
  '甲子年的年支为水。',
  '大运资料中的年支为水，原局年支为火。',
  '不能把年支、时支的水作为确定事实。',
  '“年支、时支的水”这个说法不对。',
  '如果年支为水，则是另一盘。',
  '若年支为水，则是另一盘。',
  '年支属于水吗？'
 ])assert.equal(hasCode(data,text,'回看2023年。','E10-原局支五行串位'),false,text);
});
