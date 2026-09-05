const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const handler = require('../api/ai-chat.js');

function person(id, role, name, gender, pillars) {
  return {
    personId: id, roleLabel: role, name, gender,
    birthInfo: { name, gender },
    fourPillars: Object.fromEntries(['year', 'month', 'day', 'hour'].map((pos, i) => [pos, {
      gan: pillars[i][0], zhi: pillars[i][1]
    }])),
    dayMaster: { gan: pillars[2][0], wuXing: id === 'P1' ? '火' : '水' }
  };
}

function withDaYun(base, startAge, cycles) {
  return {
    ...base,
    daYun: {
      direction: base.gender === 'male' ? '顺行' : '逆行',
      startAge,
      cycles: cycles.map(([displayAge, gz], index) => ({
        displayAge: String(displayAge), gan: gz[0], zhi: gz[1],
        startYear: 2000 + index * 10, endYear: 2009 + index * 10
      }))
    }
  };
}

test('合盘上下文用双身份锁完整隔离甲乙四柱', () => {
  const chart = {
    type: 'hepan', relationType: '情侣',
    person1: person('P1', '甲方', '青禾', 'male', ['甲子', '乙丑', '丙寅', '丁卯']),
    person2: person('P2', '乙方', '知夏', 'female', ['庚午', '辛未', '壬申', '癸酉'])
  };
  const context = handler._test.buildChartContext(chart);
  assert.match(context, /甲方身份锁：P1｜青禾｜男｜四柱 甲子 乙丑 丙寅 丁卯/);
  assert.match(context, /乙方身份锁：P2｜知夏｜女｜四柱 庚午 辛未 壬申 癸酉/);
  assert.match(context, /\[P1\/甲方，只属于甲方\]/);
  assert.match(context, /\[P2\/乙方，只属于乙方\]/);
});

test('合盘上下文逐人携带起运年龄和完整大运顺序', () => {
  const chart = {
    type: 'hepan', relationType: '情侣',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉'], [26, '丙戌']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子'], [24, '辛亥']])
  };
  const context = handler._test.buildChartContext(chart);
  assert.match(context, /P1\/person1\.daYun/);
  assert.match(context, /大运（逆行，5\.2岁起运）/);
  assert.match(context, /6岁：甲申/);
  assert.match(context, /16岁：乙酉/);
  assert.match(context, /大运（顺行，3\.4岁起运）/);
  assert.match(context, /4岁：癸丑/);
});

test('合盘回复审计拦截双方大运互换或自行重排', () => {
  const chart = {
    type: 'hepan',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉'], [26, '丙戌']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子'], [24, '辛亥']])
  };
  const correct = handler._test.runReplyValidation(chart, '你（甲方，女）：\n- 6-15岁：甲申\n- 16-25岁：乙酉\n他（乙方，男）：\n- 4-13岁：癸丑\n- 14-23岁：壬子');
  assert.equal(correct.some(item => item.includes('合盘大运')), false);

  const wrong = handler._test.runReplyValidation(chart, '你（甲方，女）：6岁起运\n- 6-15岁：丙子\n- 16-25岁：丁丑\n他（乙方，男）：4岁起运\n- 4-13岁：甲申');
  assert.ok(wrong.some(item => item.includes('甲方6-15岁') && item.includes('甲申')));
  assert.ok(wrong.some(item => item.includes('乙方4-13岁') && item.includes('癸丑')));
});

test('合盘大运校验失败时只返回双方各自冻结的排盘事实', () => {
  const chart = {
    type: 'hepan',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子']])
  };
  const fallback = handler._test.buildHepanDaYunFactFallback(chart);
  assert.match(fallback, /甲方（我，女）/);
  assert.match(fallback, /6-15岁：甲申/);
  assert.match(fallback, /16-25岁：乙酉/);
  assert.match(fallback, /乙方（对方，男）/);
  assert.match(fallback, /4-13岁：癸丑/);
  assert.match(fallback, /14-23岁：壬子/);
  assert.equal(handler._test.runReplyValidation(chart, fallback).some(item => item.includes('合盘大运')), false);
});

test('合盘回复关系校验会读取双方地支，不把跨盘三合误报为缺员', () => {
  const chart = {
    type: 'hepan',
    person1: person('P1', '甲方', '甲', 'male', ['甲申', '乙寅', '丙午', '丁戌']),
    person2: person('P2', '乙方', '乙', 'female', ['庚子', '辛卯', '壬辰', '癸酉'])
  };
  const warnings = handler._test.runReplyValidation(chart, '甲方申与乙方子、辰构成申子辰三合水局。');
  assert.equal(warnings.some((item) => item.includes('三合水缺少成员')), false);
});

test('合盘页面加载会话隔离并以 hepan 类型装饰请求', () => {
  const html = fs.readFileSync(path.join(root, 'hepan-result.html'), 'utf8');
  const integration = fs.readFileSync(path.join(root, 'js', 'ai-chat-integration.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');
  assert.match(html, /chat-persistence\.js\?v=3/);
  assert.match(integration, /p\._daYunData\.list\.map/);
  assert.match(integration, /d\.currentDaYun = currentCycle/);
  assert.match(integration, /chartData\.type === 'hepan' \? 'hepan'/);
  assert.match(api, /conversation\.mode !== conversationMode/);
  assert.match(api, /conversation\.chart_key !== chart_key/);
  assert.match(api, /【合盘身份锁】/);
});
