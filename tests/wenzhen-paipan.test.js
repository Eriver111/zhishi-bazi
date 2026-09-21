const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { Solar } = require('lunar-javascript');
const { calculator: c, calendar } = require('../api/_bazi-runtime');
const fixture = require('./fixtures/wenzhen-paipan.json');
const pillars = b => ['year','month','day','hour'].map(p => b[p].gan + b[p].zhi).join(' ');
function run(sample) {
  const [year, month, day, clock, minute] = sample.date;
  const { bazi, normalized: n } = c.calculateFromBirthInput({ year, month, day, clock, minute,
    hour: Math.floor((clock + 1) % 24 / 2), gender: sample.gender,
    location: sample.location, trueSolarTime: !!sample.location, ziHourNextDay: !sample.splitZi });
  const yun = c.calculateDaYun(bazi.month, bazi.year, sample.gender, n.year, n.month, n.day, n.hour, n.clock);
  return { bazi, n, yun };
}
for (const sample of fixture.cases) {
  test('WenZhen UI fixture: ' + sample.name, () => {
    const { bazi, n, yun } = run(sample);
    assert.equal(pillars(bazi), sample.pillars);
    if (sample.solarClock) assert.equal(n.clock, sample.solarClock[0] + sample.solarClock[1] / 60);
    if (sample.timing) {
      assert.deepEqual(['years','months','days','hours'].map(k => yun.timingInfo[k]), sample.timing);
      assert.equal(yun.list[0].startYear, sample.firstYear);
      assert.equal(yun.list[0].displayAge, sample.firstAge);
      assert.equal(yun.list[0].gan + yun.list[0].zhi, sample.firstPillar);
    }
  });
}

test('all stored terms preserve the source year, month and second', () => {
  for (let year = 1899; year <= 2101; year++) {
    const source = Solar.fromYmdHms(year,6,1,12,0,0).getLunar().getJieQiTable();
    for (const term of calendar.getJieQiDates(year)) {
      const reference = source[term.name === '小寒' ? 'XIAO_HAN' : term.name];
      const d = term.date;
      assert.deepEqual([d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds()],
        [reference.getYear(),reference.getMonth(),reference.getDay(),reference.getHour(),reference.getMinute(),reference.getSecond()]);
    }
  }
});

test('the twelve displayed cycles match the observed WenZhen end-of-year chart', () => {
  const { yun } = run(fixture.cases.find(s => s.name === '年末顺行'));
  assert.equal(yun.list.map(x => x.gan+x.zhi).join(' '),'己丑 庚寅 辛卯 壬辰 癸巳 甲午 乙未 丙申 丁酉 戊戌 己亥 庚子');
  assert.deepEqual(Array.from(yun.list,x=>x.startYear),Array.from({length:12},(_,i)=>1999+i*10));
});

test('seconds are respected on both sides of all monthly boundaries', () => {
  for (const year of [1900,1949,1988,2000,2024,2033,2100]) {
    for (const term of calendar.getJieQiDates(year)) {
      const d = term.date;
      for (const offset of [-1,1]) {
        const stamp = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds()) + offset*1000);
        const [y,m,day,h,min,s] = [stamp.getUTCFullYear(),stamp.getUTCMonth()+1,stamp.getUTCDate(),stamp.getUTCHours(),stamp.getUTCMinutes(),stamp.getUTCSeconds()];
        const ref = Solar.fromYmdHms(y,m,day,h,min,s).getLunar().getEightChar();
        ref.setSect(2);
        assert.equal(pillars(c.calculate(y,m,day,Math.floor((h+1)%24/2),'male',h+min/60+s/3600)), ref.toString());
      }
    }
  }
});

test('split minute and restored fractional clock normalize identically, with or without solar correction', () => {
  for (const solar of [false,true]) {
    const base = { year:2024,month:2,day:4,hour:8,gender:'male',location:'新疆',trueSolarTime:solar };
    const split = c.calculateFromBirthInput({...base,clock:16,minute:50});
    const restored = c.calculateFromBirthInput({...base,clock:16+50/60,minute:50});
    assert.equal(split.normalized.clock, restored.normalized.clock);
    assert.equal(pillars(split.bazi),pillars(restored.bazi));
  }
});

test('civil-time QiYun calculation is independent of host timezone and DST', () => {
  const script = `const c=require('./api/_bazi-runtime').calculator;const b=c.calculate(1990,12,11,8,'male',16);const y=c.calculateDaYun(b.month,b.year,'male',1990,12,11,8,16);console.log(JSON.stringify([y.timingInfo,y.startDate,y.list]));`;
  const outputs = ['Asia/Shanghai','UTC','America/New_York'].map(TZ => execFileSync(process.execPath,['-e',script],
    {cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ},encoding:'utf8'}));
  assert.equal(outputs[0], outputs[1]);
  assert.equal(outputs[0], outputs[2]);
});

test('normalized integer clocks do not recover stale minutes or reapply solar time', () => {
  const n = c.normalizeBirthInput({year:2024,month:2,day:4,hour:8,clock:16,minute:50,
    clockAlreadyNormalized:true,trueSolarTime:true,location:'新疆'});
  assert.equal(n.clock,16);
  assert.equal(n.solarInfo,null);
  const { chartFromQuery } = require('../api/_bazi-runtime');
  const chart = chartFromQuery('year=2024&month=2&day=4&hour=8&clock=16&minute=50&gender=male&solar=1&prov=新疆&report_clock_normalized=1');
  assert.equal(pillars(chart.bazi),'癸卯 乙丑 戊戌 庚申');
});

test('reverse QiYun at the exact Jie instant uses that Jie rather than the previous month', () => {
  // 小暑恰在整分钟；普通分钟精度表单也能触发此边界。
  const b = c.calculate(1908,7,7,11,'female',21.8);
  const yun = c.calculateDaYun(b.month,b.year,'female',1908,7,7,11,21.8);
  assert.equal(yun.isForward,false);
  assert.equal(yun.targetJieQi,'小暑');
  assert.deepEqual(['years','months','days','hours'].map(k=>yun.timingInfo[k]),[0,0,0,0]);
  assert.equal(yun.startDate,'1908-07-07 21:48:00');
});
