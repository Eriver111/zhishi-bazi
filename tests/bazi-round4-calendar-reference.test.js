const test = require('node:test');
const assert = require('node:assert/strict');
const { Solar } = require('lunar-javascript');
const { calculator: E, calendar } = require('../api/_bazi-runtime');
const pillars = b => ['year','month','day','hour'].map(p => b[p].gan + b[p].zhi).join(' ');

function compare(y, m, d, h, minute, second, splitZi) {
  const ref = Solar.fromYmdHms(y, m, d, h, minute, second).getLunar().getEightChar();
  ref.setSect(splitZi ? 2 : 1);
  const actual = E.calculateFromBirthInput({year:y, month:m, day:d,
    hour:Math.floor((h + 1) % 24 / 2), clock:h + minute / 60 + second / 3600,
    trueSolarTime:false, ziHourNextDay:!splitZi, gender:'male'}).bazi;
  assert.equal(pillars(actual), ref.toString(), `${y}-${m}-${d} ${h}:${minute}:${second} splitZi=${splitZi}`);
}

test('1900—2100 每年年末、次日及二月底：四柱与参考库一致', () => {
  for (let y = 1900; y <= 2100; y++) {
    const febEnd = new Date(Date.UTC(y, 2, 0)).getUTCDate();
    for (const [m, d, h, minute] of [[12,31,23,59],[1,1,0,0],[2,febEnd,23,59],[3,1,0,0]]) {
      for (const splitZi of [true, false]) compare(y, m, d, h, minute, 0, splitZi);
    }
  }
});

test('八个年份十二交节的前一秒、当刻、后一秒均与参考库一致', () => {
  for (const year of [1900,1933,1969,1999,2000,2024,2033,2100]) {
    for (const term of calendar.getJieQiDates(year)) {
      const t = term.date;
      for (const offset of [-1,0,1]) {
        const stamp = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()) + offset * 1000);
        for (const splitZi of [true, false]) compare(stamp.getUTCFullYear(), stamp.getUTCMonth()+1, stamp.getUTCDate(), stamp.getUTCHours(), stamp.getUTCMinutes(), stamp.getUTCSeconds(), splitZi);
      }
    }
  }
});

test('512 个固定种子新日期覆盖精确时分、早晚子及两种换日法', () => {
  let seed = 0xb42a;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 512; i++) {
    const y = 1900 + Math.floor(random() * 201), m = 1 + Math.floor(random() * 12);
    const d = 1 + Math.floor(random() * new Date(Date.UTC(y, m, 0)).getUTCDate());
    const h = Math.floor(random() * 24), minute = Math.floor(random() * 60);
    for (const splitZi of [true,false]) compare(y, m, d, h, minute, 0, splitZi);
  }
});

test('闰日及月底的男女顺逆和十二步大运干支与参考库一致', () => {
  for (const [y,m,d,h] of [[1900,2,28,23],[1933,12,31,0],[1968,2,29,12],[1999,12,31,23],[2000,2,29,0],[2024,2,29,23],[2033,8,31,12],[2100,2,28,0]]) {
    const ref = Solar.fromYmdHms(y,m,d,h,35,0).getLunar().getEightChar();
    const b = E.calculate(y,m,d,Math.floor((h+1)%24/2),'male',h+35/60);
    for (const [gender, number] of [['male',1],['female',0]]) {
      const expected = ref.getYun(number,2), actual = E.calculateDaYun(b.month,b.year,gender,y,m,d,Math.floor((h+1)%24/2),h+35/60);
      assert.equal(actual.isForward, expected.isForward());
      assert.deepEqual(Array.from(actual.list, p => p.gan+p.zhi), expected.getDaYun(13).slice(1).map(p => p.getGanZhi()));
    }
  }
});
