// E1 五合校验修复测试（2026-08-15 P5-B 收口批次附带发现）：
// 旧实现 [m1,m2].sort().join('') 按 Unicode 码点排序——己(U+5DF1)<甲(U+7532)，
// 合法对「甲己」被排成「己甲」不在 validHe 列表 → 甲己合必然误报（R01/PAT04 生产两盘实锤）。
// 修复：正反两种写法任一命中五对合法对即通过（validator 匹配边界修复，同 GPT ②类批准范围）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');

// 提取 runReplyValidation（纯函数，与 e1-boundary.test.js 同法）
const m = apiSource.match(/function runReplyValidation\(chartData, reply\) \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\*\*/);
assert.ok(m, 'runReplyValidation 提取失败——api/ai-chat.js 结构变化，需人工复核');
const runReplyValidation = new Function('chartData', 'reply', m[1].replace(/^  /gm, ''));

function wuheWarns(text) {
  return runReplyValidation({ type: 'bazi' }, text)
    .filter(w => w.indexOf('E1-五合错误') === 0);
}

test('五合①：合法对「甲己合」不误报（生产 R01「年柱甲己合」实句）', () => {
  assert.deepStrictEqual(wuheWarns('年柱甲己合，有"合官留杀"之象。'), [],
    '甲己是五对合法五合之一，不得误报');
});

test('五合②：全部五对合法组合（正写+反写）均不误报', () => {
  ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'].forEach(p => {
    const rev = p[1] + p[0];
    assert.deepStrictEqual(wuheWarns('日主与' + p + '相合，' + rev + '亦为同对。'), [],
      p + '/' + rev + ' 是合法五合对');
  });
});

test('五合③：非法组合仍然全部抓住（不逃逸）', () => {
  // 各取一例：庚甲（金木）、甲辛（金木另一向）、戊庚、甲癸、丙己、丁己
  ['庚甲', '甲辛', '戊庚', '甲癸', '丙己', '丁己'].forEach(p => {
    const w = wuheWarns('此局' + p + '相合，主变。');
    assert.strictEqual(w.length, 1, p + ' 为非法五合，应被抓住');
    assert.ok(w[0].indexOf(p) >= 0, '警告应指向「' + p + '」');
  });
});

test('五合④：同干自合（甲甲合）等退化组合仍被抓住', () => {
  assert.strictEqual(wuheWarns('甲甲相合，自刑自合。').length, 1, '同干不是五合');
});

test('五合⑤：生产 PAT04 实句「月柱正财合身（甲己合）」不再误报', () => {
  const text = '月柱正财合身（甲己合），对财富有现实追求；但身弱财旺，为财所累。';
  assert.deepStrictEqual(wuheWarns(text), [], 'PAT04 生产句中的甲己合是正确命理内容');
});
