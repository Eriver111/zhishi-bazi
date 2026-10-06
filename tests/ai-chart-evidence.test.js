'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chartEvidence,chartEvidenceContext,validateChartEvidence}=require('../lib/ai-chart-evidence');
const chart = words => ({fourPillars:Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:words[i][0],zhi:words[i][1]}]))});
const doctor=chart(['辛酉','戊戌','甲戌','丁卯']);
const water=chart(['丁巳','丙午','壬寅','庚子']);
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
