const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../api/_bazi-runtime');
const daily = require('../api/_daily-fortune');

test('daily fortune changes date at China Standard Time rather than server local time', () => {
  assert.deepEqual(daily.chinaDateParts(new Date('2026-08-22T16:30:00.000Z')), {year:2026,month:8,day:23});
  assert.deepEqual(daily.chinaDateParts(new Date('2026-08-23T15:59:59.000Z')), {year:2026,month:8,day:23});
});

test('daily branch facts cover clash combine harm punishment and break', () => {
  assert.ok(daily.branchRelations('子','午').some(row => row.type === '六冲'));
  assert.ok(daily.branchRelations('子','丑').some(row => row.type === '六合' && row.resultElement === '土'));
  assert.ok(daily.branchRelations('申','亥').some(row => row.type === '六害'));
  assert.ok(daily.branchRelations('寅','巳').some(row => row.type === '相刑'));
  assert.ok(daily.branchRelations('寅','亥').some(row => row.type === '相破'));
});

test('personal daily facts use frozen yong-xi-ji and keep day stem separate from spouse palace', () => {
  const chart = runtime.chartFromQuery('year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0');
  const transit = {
    yearNumber:2026, monthNumber:8, dayNumber:23,
    year:runtime.calendar.getYearPillar(2026,8,23,12),
    month:runtime.calendar.getMonthPillar(2026,8,23,12,12),
    day:runtime.calendar.getDayPillar(2026,8,23)
  };
  const facts = daily.buildDailyFacts(runtime.calculator, chart.bazi, chart.gender, transit);
  const frozen = runtime.calculator.getYongJi(chart.bazi);
  assert.deepEqual(Array.from(facts.yongJi.yongShen), Array.from(frozen.yongShen));
  assert.equal(facts.context.at(-1).label, '流日');
  assert.ok(facts.allEvents.some(row => row.layer === '地支' && row.target === '夫妻宫'));
  assert.ok(facts.allEvents.every(row => !(row.layer === '天干' && row.target === '夫妻宫')));
  assert.ok(['偏顺','偏紧','有利变化','需要留意','平稳','利弊并见','有引动'].includes(facts.tendency));
  assert.ok(facts.basis.length >= 2);
});

test('fortune page gives guests public almanac and labels personal reasoning separately', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'fortune.html'), 'utf8');
  assert.match(page, /公共黄历 · 建除民俗参考/);
  assert.match(page, /专属今日推演/);
  assert.match(page, /loadPublicHuangli\(publicPrompt/);
  assert.match(page, /推演依据/);
  assert.match(page, /命理推演用于观察当天更容易出现的倾向/);
});


function pillar(text) { return {gan:text[0], zhi:text[1]}; }
function syntheticChart(text = '乙丑 乙丑 乙丑 乙丑') {
  return Object.fromEntries(['year','month','day','hour'].map((key,i) => [key,pillar(text.split(' ')[i])]));
}
function syntheticCalculator(roles = {}) {
  return {
    getYongJi:() => ({yongShen:[],xiShen:[],jiShen:[], elementRoleLedger:{entries:Object.entries(roles).map(([element,level]) => ({
      element, fortuneLevel:level, fortuneRole:level === '总体不利' ? '忌神' : level === '中性双向' ? '忌神' : '喜神'
    }))}}),
    classifyFortuneElement:(element,_yj,_label,carrier) => {
      const level = roles[element] || '总体有利';
      return {element,level,score:level === '总体不利' ? -2 : level === '总体有利' ? 2 : 0,
        role:level === '总体不利' || level === '中性双向' ? '忌神' : '喜神', carrierStatus:'已核对', carrierReason:carrier.symbol + '的测试条件'};
    },
    calcDayMasterStrength:() => ({score:50,level:'中和'}), getPattern:() => ({name:'测试',status:'测试'}), getShiShen:() => '测试'
  };
}
function transit(day = '甲子', background = '甲子') {
  return {yearNumber:2026,monthNumber:9,dayNumber:24,day:pillar(day),year:pillar(background),month:pillar(background)};
}

test('real dry-earth water case retains dual role instead of pure adverse daily water', () => {
  const bazi = runtime.calculator.buildFromPillars(syntheticChart('丙戌 丙申 丙申 戊戌'),'female',null);
  const facts = daily.buildDailyFacts(runtime.calculator,bazi,'female',transit('壬子','丙午'));
  assert.equal(facts.day.ganRole,'中性双向');
  assert.equal(facts.day.zhiReview.level,'中性双向');
  assert.equal(facts.tendency,'利弊并见');
  assert.ok(facts.conditions.some(line => /润|调候/.test(line)));
  const clauses = facts.conditions.flatMap(line => line.split('；'));
  assert.equal(new Set(clauses).size, clauses.length, 'same-pillar conditions must not repeat');
  assert.equal(Object.hasOwn(facts,'score'),false,'do not present old additive luck score');
});

test('background restrains a favorable daily carrier instead of staying decorative', () => {
  const calc = syntheticCalculator();
  const bazi = syntheticChart();
  const supported = daily.buildDailyFacts(calc,bazi,'male',transit('甲子','甲子'));
  const constrained = daily.buildDailyFacts(calc,bazi,'male',transit('甲子','庚午'));
  assert.equal(supported.tendency,'有利变化');
  assert.equal(constrained.tendency,'利弊并见');
  assert.equal(constrained.decision.restrainedPositive,true);
  assert.deepEqual(supported.allEvents,constrained.allEvents,'natal triggers do not change with background');
  assert.ok(constrained.background.flatMap(row => row.links).some(link => /背景天干克流日/.test(link.relation)));
});

test('adverse repetition only raises pressure when today has a natal trigger', () => {
  const calc = syntheticCalculator({水:'总体不利',火:'总体有利'});
  const bazi = syntheticChart('戊午 戊午 戊午 戊午');
  assert.equal(daily.buildDailyFacts(calc,bazi,'male',transit('壬子','壬子')).tendency,'偏紧');
  assert.equal(daily.buildDailyFacts(calc,bazi,'male',transit('壬子','乙卯')).tendency,'需要留意');
  const noTrigger = daily.buildDailyFacts(syntheticCalculator(),syntheticChart('甲子 甲子 甲子 甲子'),'male',transit('丙辰','丙辰'));
  assert.equal(noTrigger.decision.hasTrigger,false);
  assert.equal(noTrigger.tendency,'平稳');
});

test('several natal targets and overlapping relations settle once without auto transformation', () => {
  const facts = daily.buildDailyFacts(syntheticCalculator(),syntheticChart('乙亥 乙亥 乙亥 乙亥'),'male',transit('庚寅','庚寅'));
  const branch = facts.allEvents.filter(row => row.id === 'natal-zhi-亥');
  assert.equal(branch.length,1);
  assert.equal(branch[0].targets.length,4);
  assert.deepEqual(branch[0].types,['六合','相破']);
  assert.equal(branch[0].transformed,false);
  const stem = facts.allEvents.find(row => row.id === 'natal-gan-乙');
  assert.deepEqual(stem.types,['天干五合','流日天干克原局']);
  assert.equal(stem.transformed,false);
  assert.ok(facts.allEvents.every(row => !Object.hasOwn(row,'impact')));
});

test('groups already present in natal chart are not a newly formed daily structure', () => {
  const facts = daily.buildDailyFacts(syntheticCalculator(),syntheticChart('甲寅 丙午 戊戌 甲子'),'male',transit('甲寅'));
  const group = facts.allEvents.find(row => row.id === 'group-三合-火');
  assert.equal(group.strong,false);
  assert.equal(group.transformed,false);
  assert.match(group.detail,/原局已有/);
});

test('conditional benefit cannot become unconditional daily good fortune', () => {
  const facts = daily.buildDailyFacts(syntheticCalculator({木:'条件有利',水:'中性双向'}),syntheticChart(),'male',transit());
  assert.equal(facts.tendency,'利弊并见');
  assert.equal(facts.conditions.length,2);
  assert.match(daily.buildDailyCopy(facts).tip,/需要满足的条件/);
});

test('decade selection uses exact civil start date and forwards precise birth clock', () => {
  const bazi = syntheticChart(); bazi.birthDate={year:2000,month:1,day:1,hour:6,clock:11.75};
  let lastClock;
  const calc = {calculateDaYun(...args){lastClock=args.at(-1);return {startDate:'2006-09-25 13:30:00',list:[pillar('甲子'),pillar('乙丑'),pillar('丙寅')]};}};
  const before = daily.activeDaYun(calc,bazi,'male',{yearNumber:2026,monthNumber:9,dayNumber:24});
  const boundary = daily.activeDaYun(calc,bazi,'male',{yearNumber:2026,monthNumber:9,dayNumber:25});
  const after = daily.activeDaYun(calc,bazi,'male',{yearNumber:2026,monthNumber:9,dayNumber:26});
  assert.equal(lastClock,11.75);
  assert.equal(before.pillar.gan,'乙');
  assert.equal(boundary.pillar.gan,'乙');
  assert.match(boundary.status,/当天交运/);
  assert.equal(after.pillar.gan,'丙');
  assert.match(daily.activeDaYun(calc,bazi,'male',{yearNumber:2006,monthNumber:9,dayNumber:24}).status,/尚未起运/);
});

test('decade background also participates in the same daily carrier gate', () => {
  const bazi = syntheticChart(); bazi.birthDate={year:2000,month:1,day:1,hour:0,clock:0};
  const calc = syntheticCalculator();
  calc.calculateDaYun=() => ({startDate:'2020-01-01 00:00:00',list:[pillar('庚午')]});
  const facts = daily.buildDailyFacts(calc,bazi,'male',transit('甲子','甲子'));
  assert.equal(facts.tendency,'利弊并见');
  assert.equal(facts.context[0].label,'大运');
  assert.ok(facts.background[0].links.some(row => row.state === '受牵制'));
});

test('daily copy does not invent school employment marriage or specific guaranteed events', () => {
  for (const text of ['丙戌 丙申 丙申 戊戌','壬午 辛亥 癸巳 戊午']) {
    const bazi = runtime.calculator.buildFromPillars(syntheticChart(text),'female',null);
    const yjBefore = JSON.stringify(runtime.calculator.getYongJi(bazi));
    // Core attaches its existing _siLing memo on first evaluation; daily transits must not alter it.
    const before = JSON.stringify(bazi);
    const seen = new Set();
    const stems='甲乙丙丁戊己庚辛壬癸', branches='子丑寅卯辰巳午未申酉戌亥';
    for(let i=0;i<60;i++) {
      const facts = daily.buildDailyFacts(runtime.calculator,bazi,'female',transit(stems[i%10]+branches[i%12],'丙午'));
      seen.add(facts.tendency);
      assert.equal(new Set(facts.allEvents.map(row => row.id)).size,facts.allEvents.length);
      assert.doesNotMatch(daily.buildDailyCopy(facts).tip,/必定|(?<!不据此)保证结果。|升职|失业|分手|发财|现实结果通常/);
      assert.ok(facts.basis.length===3);
    }
    assert.ok(seen.size >= 2,'daily output must follow changing evidence');
    assert.equal(JSON.stringify(bazi),before);
    assert.equal(JSON.stringify(runtime.calculator.getYongJi(bazi)),yjBefore);
  }
});
