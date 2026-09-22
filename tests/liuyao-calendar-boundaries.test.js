const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Solar } = require('lunar-javascript');
const context = { console };
context.window = context;
vm.createContext(context);
for (const file of ['bazi.js', 'liuyao-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
const engine = context.LIUYAO;
const plain = value => JSON.parse(JSON.stringify(value));
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

function contextAt(solar) {
  return engine.getCalendarContext(solar.getYear(), solar.getMonth(), solar.getDay(),
    solar.getHour(), solar.getMinute(), solar.getSecond());
}

test('six-line calendar preserves minutes and seconds at all 12 monthly boundaries over 13 years', () => {
  const monthlyTerms = ['小寒','立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪'];
  for (let year = 2019; year <= 2031; year += 1) {
    const terms = Solar.fromYmd(year, 6, 15).getLunar().getJieQiTable();
    for (const name of monthlyTerms) {
      const term = terms[name];
      const stamp = Date.UTC(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour(), term.getMinute(), term.getSecond());
      for (const delta of [-1000, 0, 1000]) {
        const date = new Date(stamp + delta);
        const solar = Solar.fromYmdHms(date.getUTCFullYear(), date.getUTCMonth() + 1,
          date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
        const actual = contextAt(solar);
        const lunar = solar.getLunar();
        const label = `${name} ${solar.toYmdHms()}`;
        assert.equal(actual.yearGan + actual.yearZhi, lunar.getYearInGanZhiExact(), label);
        assert.equal(actual.monthGan + actual.monthZhi, lunar.getMonthInGanZhiExact(), label);
        assert.equal(actual.dayGan + actual.dayZhi, lunar.getDayInGanZhiExact2(), label);
      }
    }
  }
});

test('minute-aware Liqiu boundary no longer waits until the following hour', () => {
  assert.equal(engine.getCalendarContext(2026, 8, 7, 19, 42, 42).monthZhi, '未');
  assert.equal(engine.getCalendarContext(2026, 8, 7, 19, 42, 43).monthZhi, '申');
  assert.equal(engine.getCalendarContext(2026, 8, 7, 19, 43).monthZhi, '申');
  assert.equal(engine.getCalendarContext(2026, 8, 7, 19).monthZhi, '未', 'four-argument callers retain exact-hour meaning');
});

test('calendar keeps civil-midnight day change and derives void branches across a full cycle', () => {
  for (let offset = 0; offset < 60; offset += 1) {
    const solar = Solar.fromYmd(2026, 8, 1).next(offset);
    const noon = contextAt(Solar.fromYmdHms(solar.getYear(), solar.getMonth(), solar.getDay(), 12, 0, 0));
    const late = engine.getCalendarContext(solar.getYear(), solar.getMonth(), solar.getDay(), 23, 59, 59);
    assert.equal(late.dayGan + late.dayZhi, noon.dayGan + noon.dayZhi);
    const expectedVoid = solar.getLunar().getDayXunKong();
    assert.equal(noon.xunKong.join(''), expectedVoid);
    assert.equal(BRANCHES.indexOf(noon.yuePo), (BRANCHES.indexOf(noon.monthZhi) + 6) % 12);
    const tomorrow = solar.next(1);
    const nextDay = contextAt(tomorrow);
    assert.equal(nextDay.dayIndex, (noon.dayIndex + 1) % 60);
  }
});

test('five-element life stages use element origin rather than making every month the origin', () => {
  const expected = {
    木: { 亥:'长生', 卯:'帝旺', 未:'墓', 申:'绝' },
    火: { 寅:'长生', 午:'帝旺', 戌:'墓', 亥:'绝' },
    土: { 申:'长生', 子:'帝旺', 辰:'墓', 巳:'绝' },
    金: { 巳:'长生', 酉:'帝旺', 丑:'墓', 寅:'绝' },
    水: { 申:'长生', 子:'帝旺', 辰:'墓', 巳:'绝' },
  };
  for (const [element, branchStages] of Object.entries(expected)) {
    for (const [branch, stage] of Object.entries(branchStages)) assert.equal(engine.getChangSheng(element, branch), stage);
    assert.equal(new Set([...BRANCHES].map(branch => engine.getChangSheng(element, branch))).size, 12);
  }
  const qian = engine.zhuangGua([1, 1, 1, 1, 1, 1], 0, '寅');
  assert.deepEqual(plain(qian.changSheng), ['病','临官','病','长生','绝','病']);
});

test('all 4096 original/changed patterns keep changed relatives anchored to the original element', () => {
  // Explicit 五行/六亲 table, independent of production generation/control helpers.
  const relatives = {
    金: { 金:'兄弟', 水:'子孙', 木:'妻财', 火:'官鬼', 土:'父母' },
    木: { 金:'官鬼', 水:'父母', 木:'兄弟', 火:'子孙', 土:'妻财' },
    水: { 金:'父母', 水:'兄弟', 木:'子孙', 火:'妻财', 土:'官鬼' },
    火: { 金:'妻财', 水:'官鬼', 木:'父母', 火:'兄弟', 土:'子孙' },
    土: { 金:'子孙', 水:'妻财', 木:'官鬼', 火:'父母', 土:'兄弟' },
  };
  const bits = value => Array.from({ length: 6 }, (_, index) => (value >> index) & 1);
  for (let base = 0; base < 64; base += 1) {
    const original = engine.zhuangGua(bits(base), 0, '寅');
    assert.equal((original.shiYao + 2) % 6 + 1, original.yingYao);
    const hidden = engine.getFuShen(original.guaName, original.liuqin, original.yaoWX);
    for (const item of hidden) {
      assert.ok(!original.liuqin.includes(item.qin), 'only missing relatives become hidden');
      assert.equal(item.qin, relatives[original.gongWX][item.wx]);
      assert.equal(item.feiQin, original.liuqin[item.yaoIdx - 1]);
    }
    for (let mask = 0; mask < 64; mask += 1) {
      const changed = engine.zhuangGua(bits(base ^ mask), 0, '寅', { liuQinGongWX: original.gongWX });
      assert.deepEqual(plain(changed.liuqin), plain(changed.yaoWX).map(wx => relatives[original.gongWX][wx]));
      assert.equal(changed.liuQinGongWX, original.gongWX);
    }
  }
});
