const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
const handler = require('../api/ai-chat.js');

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

test('回复审计拦截无证据安慰、保证化解和把不利圆成成长机会', () => {
  const validate = handler._test.runReplyValidation;
  const chart = { type: 'bazi' };

  assert.ok(validate(chart, '这步运压力较大，不过别灰心，后面会越来越顺。')
    .some(item => item.startsWith('E6-无证据粉饰')));
  assert.ok(validate(chart, '只要你调整心态，就一定能化解这些问题。')
    .some(item => item.startsWith('E6-保证式化解')));
  assert.ok(validate(chart, '虽然这一步偏不利，但是这其实是一次成长机会。')
    .some(item => item.startsWith('E6-不利结论被圆回正向')));
  assert.ok(validate(chart, '虽然现在不顺，但这都是成长的机会，熬过去以后一定越来越顺。')
    .some(item => item.startsWith('E6-无证据粉饰')));
});

test('回复审计允许如实的不利结论和不承诺结果的风险建议', () => {
  const warnings = handler._test.runReplyValidation(
    { type: 'bazi' },
    '这一步结构偏不利，工作阻力和资金压力容易增加。建议控制投入、保留现金，但这些做法只能降低风险，不能保证结果。'
  );
  assert.equal(warnings.some(item => item.startsWith('E6-')), false);
});

test('紫微与六壬回复也进入通用粉饰审计', () => {
  const validate = handler._test.runReplyValidation;
  assert.ok(validate({ type: 'ziwei' }, '不用担心，往后会越来越顺。').some(item => item.startsWith('E6-')));
  assert.ok(validate({ type: 'liuren' }, '给对方一点时间，一切都会好起来。').some(item => item.startsWith('E6-')));
});
