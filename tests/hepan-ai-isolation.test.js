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
  assert.match(html, /chat-persistence\.js\?v=2/);
  assert.match(integration, /chartData\.type === 'hepan' \? 'hepan'/);
  assert.match(api, /conversation\.mode !== conversationMode/);
  assert.match(api, /conversation\.chart_key !== chart_key/);
  assert.match(api, /【合盘身份锁】/);
});
