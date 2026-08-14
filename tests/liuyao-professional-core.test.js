const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const siteRoot = path.join(__dirname, '..');

function loadEngine(options = {}) {
  const context = { console };
  context.window = context;
  vm.createContext(context);
  if (options.calendar) {
    vm.runInContext(fs.readFileSync(path.join(siteRoot, 'js', 'bazi.js'), 'utf8'), context);
  }
  vm.runInContext(fs.readFileSync(path.join(siteRoot, 'js', 'liuyao-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(siteRoot, 'js', 'yijing-db.js'), 'utf8'), context);
  return context;
}

const TRIGRAM_BY_LINES = {
  '111': '乾', '110': '兑', '101': '离', '100': '震',
  '011': '巽', '010': '坎', '001': '艮', '000': '坤'
};

test('all 64 line patterns resolve to the canonical hexagram name and palace', () => {
  const context = loadEngine();
  for (let value = 0; value < 64; value += 1) {
    const lines = Array.from({ length: 6 }, (_, index) => (value >> index) & 1);
    const lower = TRIGRAM_BY_LINES[lines.slice(0, 3).join('')];
    const upper = TRIGRAM_BY_LINES[lines.slice(3, 6).join('')];
    const canonical = context.YIJING.find((gua) => gua.upper === upper && gua.lower === lower);
    const actual = context.LIUYAO.zhuangGua(lines, 0, '寅');

    assert.ok(canonical, `${upper}/${lower} must exist in the canonical database`);
    assert.equal(actual.guaName, canonical.name, `${upper}上${lower}下的卦名`);
    assert.notEqual(actual.guaType, undefined, `${canonical.name} must have an eight-palace type`);
  }
});

test('changed-line relatives can stay anchored to the original palace element', () => {
  const context = loadEngine();
  const changedToKun = context.LIUYAO.zhuangGua(
    [0, 0, 0, 0, 0, 0],
    0,
    '寅',
    { liuQinGongWX: '金' }
  );

  assert.deepEqual(
    Array.from(changedToKun.liuqin),
    ['父母', '官鬼', '妻财', '父母', '子孙', '兄弟']
  );
  assert.equal(changedToKun.liuQinGongWX, '金');
});

test('moving-line transformation distinguishes both control directions', () => {
  const context = loadEngine();
  assert.equal(context.LIUYAO.getHuaRelation('木', '水'), '化回头生');
  assert.equal(context.LIUYAO.getHuaRelation('木', '金'), '化回头克');
  assert.equal(context.LIUYAO.getHuaRelation('木', '火'), '化泄气');
  assert.equal(context.LIUYAO.getHuaRelation('木', '土'), '化出所克');
  assert.equal(context.LIUYAO.getHuaRelation('木', '木'), '比和');
});

test('monthly state distinguishes exact month branch from generic seasonal strength', () => {
  const context = loadEngine();
  const qianInYinMonth = context.LIUYAO.zhuangGua([1, 1, 1, 1, 1, 1], 0, '寅');
  assert.deepEqual(
    Array.from(qianInYinMonth.monthState),
    ['泄于月', '临月建', '月克', '得月生', '克月', '月克']
  );
});

test('a missing relative is restored from the palace pure hexagram with its real flying relation', () => {
  const context = loadEngine();
  const tianFengGou = context.LIUYAO.zhuangGua([0, 1, 1, 1, 1, 1], 0, '寅');
  const hidden = context.LIUYAO.getFuShen(
    tianFengGou.guaName,
    tianFengGou.liuqin,
    tianFengGou.yaoWX
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(hidden)),
    [{
      qin: '妻财', ganZhi: '甲寅', wx: '木', yaoIdx: 2,
      feiQin: '子孙', feiWX: '水', rel: '飞来生伏'
    }]
  );
});

test('Beijing divination calendar uses solar-term month boundaries', () => {
  const context = loadEngine({ calendar: true });
  const beforeLiQiu = context.LIUYAO.getCalendarContext(2026, 8, 1, 12);
  const afterLiQiu = context.LIUYAO.getCalendarContext(2026, 8, 14, 12);
  const beforeLiChun = context.LIUYAO.getCalendarContext(2026, 2, 1, 12);

  assert.deepEqual(
    JSON.parse(JSON.stringify(beforeLiQiu)),
    {
      yearGan: '丙', yearZhi: '午', monthGan: '乙', monthZhi: '未',
      dayGan: '丁', dayZhi: '未', dayGanIdx: 3, dayIndex: 43,
      xunKong: ['寅', '卯'], yuePo: '丑'
    }
  );
  assert.equal(afterLiQiu.monthGan + afterLiQiu.monthZhi, '丙申');
  assert.equal(beforeLiChun.yearGan + beforeLiChun.yearZhi, '乙巳');
  assert.equal(beforeLiChun.monthGan + beforeLiChun.monthZhi, '己丑');
});

test('AI professional facts include calendar void, month break, hidden spirit and changed-line identity', () => {
  const context = loadEngine({ calendar: true });
  const calendar = context.LIUYAO.getCalendarContext(2026, 8, 14, 12);
  const original = context.LIUYAO.zhuangGua([0, 1, 1, 1, 1, 1], calendar.dayGanIdx, calendar.monthZhi);
  const changed = context.LIUYAO.zhuangGua(
    [1, 1, 1, 1, 1, 1],
    calendar.dayGanIdx,
    calendar.monthZhi,
    { liuQinGongWX: original.gongWX }
  );
  const hidden = context.LIUYAO.getFuShen(original.guaName, original.liuqin, original.yaoWX);
  const facts = context.LIUYAO.formatProfessionalFacts({
    original,
    changed,
    movingLines: [1],
    calendar,
    hidden
  });

  assert.match(facts, /月建：丙申月/);
  assert.match(facts, /日辰：庚申日/);
  assert.match(facts, /第5爻：兄弟壬申金，六神勾陈，月令关系临月建，日令关系临日辰/);
  assert.match(facts, /旬空：子丑/);
  assert.match(facts, /月破：寅/);
  assert.match(facts, /伏神：第2爻妻财甲寅木，飞神子孙亥水，飞来生伏/);
  assert.match(facts, /第1爻动：父母辛丑土→子孙甲子水，化出所克/);
});
