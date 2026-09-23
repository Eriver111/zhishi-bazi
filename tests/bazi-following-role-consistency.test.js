const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Constructed mechanism cases, not independently adjudicated accuracy labels.
// Read source only; no production environment, API module loading or services.
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const elements = ['木','火','土','金','水'];
const box = {window:{}};
vm.runInNewContext(read('js/bazi.js'), box);
vm.runInNewContext(read('js/hepan-core.js'), box);
const E = box.window.BaZiCalculator;
function chart(text) {
  const p = text.split(' ').map(gz => ({gan:gz[0],zhi:gz[1]}));
  return E.buildFromPillars({year:p[0],month:p[1],day:p[2],hour:p[3]}, 'male');
}
function checkComplete(result) {
  assert.deepEqual(Object.keys(result.elementClassification), elements);
  for (const wx of elements) {
    const role = result.elementClassification[wx];
    const ledger = result.elementRoleLedger.entries.find(row => row.element === wx);
    assert.equal(ledger.classification, role, wx);
    assert.ok(result.elementReasons[wx], 'missing reason for ' + wx);
    assert.equal(result.neutralElements.includes(wx), role === '中性', wx);
    if (role === '中性') {
      assert.equal(ledger.fortuneRole, '中性');
      assert.equal(result.elementReasons[wx].role, '中性');
      assert.ok(!result.xiShen.includes(wx) && !result.jiShen.includes(wx));
    }
  }
  assert.ok(result.yongShen.every(wx => result.xiShen.includes(wx)));
  assert.ok(result.xiShen.every(wx => !result.jiShen.includes(wx)));
}

const incompleteCases = [
  {text:'辛酉 辛酉 乙酉 辛巳', name:'从杀格', yong:['金'], xi:['金','土'], ji:['水','木'], neutral:['火']},
  {text:'丙午 丙午 甲午 戊辰', name:'从儿格', yong:['火'], xi:['火','土'], ji:['水'], neutral:['木','金']}
];
for (const fixture of incompleteCases) {
  test(fixture.name + '：早返回遗漏的五行统一中性，保留原首用与喜忌', () => {
    const bazi = chart(fixture.text), result = E.getYongJi(bazi);
    assert.equal(E.getCongGe(bazi).name, fixture.name);
    assert.equal(result.selectionStatus, 'determined');
    assert.equal(result.method, '从格顺势');
    assert.deepEqual(plain(result.yongShen), fixture.yong);
    assert.deepEqual(plain(result.xiShen), fixture.xi);
    assert.deepEqual(plain(result.jiShen), fixture.ji);
    assert.deepEqual(plain(result.neutralElements), fixture.neutral);
    assert.equal(result.candidateScores, undefined, 'metadata normalization must not introduce ordinary scoring');
    checkComplete(result);
  });
}

test('从财与五类专旺原已覆盖五行，不应新增中性或改变顺逆喜忌', () => {
  for (const text of ['戊戌 己未 甲戌 戊辰','甲寅 乙卯 甲寅 癸亥','甲寅 丙午 丙午 甲午','丙午 戊辰 戊戌 丁未','戊申 辛酉 庚申 庚申','庚申 壬子 壬子 辛亥']) {
    const bazi = chart(text), cong = E.getCongGe(bazi), result = E.getYongJi(bazi);
    assert.equal(cong.isCong, true, text);
    assert.deepEqual(plain(result.yongShen), plain(cong.xiOverride.slice(0, 1)), text);
    assert.deepEqual(plain(result.xiShen), plain(cong.xiOverride), text);
    assert.deepEqual(plain(result.jiShen), plain(cong.jiOverride), text);
    assert.deepEqual(plain(result.neutralElements), [], text);
    checkComplete(result);
  }
});

test('普通弱喜弱忌、显式条件喜神与全零未定不被短路归一化覆盖', () => {
  const near = E.getYongJi(chart('甲子 丁卯 己未 庚午'));
  assert.equal(near.elementClassification.金, '弱喜');
  assert.equal(near.elementClassification.火, '弱忌');
  const conditional = E.getYongJi(chart('己巳 庚午 甲辰 庚午'));
  assert.equal(conditional.elementClassification.木, '条件喜神');
  assert.ok(!conditional.neutralElements.includes('木'));
  assert.ok(!conditional.xiShen.includes('木') && !conditional.jiShen.includes('木'));
  const zero = E.getYongJi(E.calculate(2019, 1, 20, 7, 'male', 14 + 1 / 60));
  assert.equal(zero.selectionStatus, 'undetermined');
  assert.deepEqual(plain(zero.yongShen), []);
  assert.deepEqual(plain(zero.neutralElements), elements);
  for (const result of [near, conditional, zero]) checkComplete(result);
});

test('从格中性五行进入实际合盘摘要，与个人角色账本一致', () => {
  const people = incompleteCases.map((fixture, i) => ({name:'测试' + i, _professionalFacts:{yongJi:E.getYongJi(chart(fixture.text))}}));
  const result = box.window._hepanHelpers.analyzeXiyong(...people);
  assert.deepEqual(plain(result.p1.neutralElements), ['火']);
  assert.deepEqual(plain(result.p2.neutralElements), ['木','金']);
  assert.equal(result.p1.selectionStatus, 'determined');
  assert.equal(result.p2.selectionStatus, 'determined');
  assert.deepEqual(plain(result.p1.yongShen), ['金']);
  assert.deepEqual(plain(result.p2.yongShen), ['火']);
});

function loadPureAiFunctions() {
  const source = read('api/ai-chat.js');
  const scopeModule = {exports:{}};
  vm.runInNewContext(read('lib/hepan-reply-scopes.js'), {module:scopeModule});
  const scope = {hepanReplyScopes:scopeModule.exports.hepanReplyScopes};
  function extract(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, 'pure function extraction boundary changed');
    return source.slice(a, b);
  }
  vm.runInNewContext(extract('function validateFrozenYongSelection(', 'function isHardWarning('), scope);
  vm.runInNewContext(extract('function buildSingleChart(', 'function buildLiurenContext('), scope);
  return scope;
}

test('实际AI上下文完整披露从杀/从儿中性，不再只藏在角色账本内', () => {
  const ai = loadPureAiFunctions();
  for (const fixture of incompleteCases) {
    const result = E.getYongJi(chart(fixture.text));
    const context = ai.buildSingleChart({yongJi:result});
    assert.ok(context.includes('中性（方向待辨）：' + fixture.neutral.join('、')));
    for (const wx of fixture.neutral) assert.ok(context.includes('中性·' + wx), fixture.text + ' ' + wx);
    assert.ok(context.includes('顺势用神'));
    assert.ok(!context.includes('核心用神尚未确定'), 'omitted individual roles do not unset a supported primary');
  }
});

test('现有AI校验识别从格中性被改写，普通已定结论与否定语句仍放行', () => {
  const ai = loadPureAiFunctions();
  for (const fixture of incompleteCases) {
    const result = E.getYongJi(chart(fixture.text)), neutral = fixture.neutral[0];
    const single = {type:'bazi',yongJi:result};
    assert.ok(ai.runReplyValidation(single, '忌神为' + neutral + '。', '').some(w => w.startsWith('E1-取用')));
    assert.equal(ai.runReplyValidation(single, '用神为' + fixture.yong[0] + '。', '').filter(w => w.startsWith('E1-取用')).length, 0);
    assert.equal(ai.runReplyValidation(single, neutral + '并非忌神。', '').filter(w => w.startsWith('E1-取用')).length, 0);
    const pair = {type:'hepan',person1:{name:'测试甲',yongJi:result},person2:{name:'测试乙',yongJi:result}};
    assert.ok(ai.runReplyValidation(pair, '甲方忌神为' + neutral + '。', '').some(w => w.startsWith('E1-合盘喜用')));
    assert.equal(ai.runReplyValidation(pair, '甲方忌神为' + neutral + '这一结论不能成立。', '').filter(w => w.startsWith('E1-合盘喜用')).length, 0);
  }
});
