const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');

test('八字 AI 对用户命理观点先核证，不再按用户方向改写冻结结论', () => {
  assert.match(source, /禁止把“我觉得应该身强”“别人说是某格”等命理意见当成现实事实/);
  assert.match(source, /用户意见与预计算数据冲突[\s\S]*?不得为了顺从用户而按其方向改写结论/);
  assert.match(source, /证据各半就明确说“暂不能确认”/);
  assert.doesNotMatch(source, /按用户说的方向重新解读/);
  assert.doesNotMatch(source, /态度要温和，不坚持己见/);
});

test('现实经历只校正事件取象，不反向篡改命盘硬事实', () => {
  assert.match(source, /现实反馈优先于事件推断/);
  assert.match(source, /不得用单次经历反向篡改四柱、十神、旺衰、格局、喜用忌或大运顺序/);
});

test('八字 AI 不把不利结论强行圆成转机或先苦后甜', () => {
  assert.match(source, /结构偏不利就直接说“偏不利\/阻力增加”及其依据/);
  assert.match(source, /不得自动改写成“成长机会”“先苦后甜”“熬过去就会更好”/);
  assert.match(source, /建议本身不能把不利结论翻成有利/);
  assert.match(source, /不得为了安慰用户补造积极面/);
  assert.match(source, /没有后续运势没有独立数据支持|若后续运势没有独立数据支持/);
});

test('紫微与六壬同样执行反迎合和反粉饰约束', () => {
  const antiFlatterySections = source.match(/## 禁止迎合与粉饰/g) || [];
  assert.equal(antiFlatterySections.length, 3);
  assert.match(source, /运限偏不利时直接说明阻力及盘面依据/);
  assert.match(source, /课盘偏不利时直接说明阻力及对应课传依据/);
  assert.match(source, /没有应期证据时不得承诺后续改善/);
});
