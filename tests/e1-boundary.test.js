// E1 生克方向词边界修复测试（2026-08-15，GPT 终裁批准：只修 validator 匹配边界，不动生成提示词/引擎）
// 双向证明：①「晦火生金」跨词边界误报消失（TH07/PAT07 生产两盘同根实证）
//          ② 已知真正 E1 错误样本仍然能抓住。
// 从 api/ai-chat.js 提取 runReplyValidation 真实执行（纯函数，与 b4-context-contract 同法）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');

// 提取 runReplyValidation（648-639，纯函数；文件 CRLF，终点为函数结束后紧跟的 JSDoc）
const m = apiSource.match(/function runReplyValidation\(chartData, reply\) \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\*\*/);
assert.ok(m, 'runReplyValidation 提取失败——api/ai-chat.js 结构变化，需人工复核');
const runReplyValidation = new Function('chartData', 'reply', m[1].replace(/^  /gm, ''));

function e1warns(text) {
  return runReplyValidation({ type: 'bazi' }, text)
    .filter(w => w.indexOf('E1-生克方向') === 0);
}

test('E1 边界①：晦火生金跨词边界误报消失（生产 TH07/PAT07 同根句）', () => {
  const text = '印星根气在未、丑两燥土之中，皆为火燥之土，燥土不能晦火生金，化杀之力不足。';
  assert.deepStrictEqual(e1warns(text), [], '「晦火生金」=晦火+生金（主语燥土），非独立「火生金」断言');
});

test('E1 边界②：真正错误的生克断言仍然能抓住', () => {
  // 非法相生
  const t1 = e1warns('此局火能生金，金能生水，故金水为喜。');
  assert.strictEqual(t1.length, 1, '「火能生金」非法相生应被抓住');
  assert.ok(t1[0].indexOf('火') >= 0, '应指向火生金');
  // 非法相克
  const t2 = e1warns('金克水为无情之克，需火通关。');
  assert.strictEqual(t2.length, 1, '「金克水」非法相克应被抓住');
  // 混合句：土生金合法、火生金非法——合法匹配不得吞掉后续非法断言
  const t3 = e1warns('土生金，火生金，双金并立。');
  assert.strictEqual(t3.length, 1, '「火生金」非法相生应被抓住');
});

test('E1 边界③：合法相生/相克不误报', () => {
  assert.deepStrictEqual(e1warns('木生火，火生土，土生金，金生水，水生木，循环不息。'), []);
  assert.deepStrictEqual(e1warns('金克木，木克土，土克水，水克火，火克金，制化有序。'), []);
});

test('E1 边界④：动词集宾语跳过仅限紧邻一字，链式「生X生Y」不受影响', () => {
  // 紧邻动词宾语跳过：晦火、泄木、耗水 三类动词
  assert.deepStrictEqual(e1warns('燥土晦火生金，金水相涵。'), [], '晦火生金跳过');
  assert.deepStrictEqual(e1warns('旺木泄水生木，流通有情。'), [], '泄水生木跳过（水为泄的宾语）');
  // 非紧邻不受影响：火 前无边界动词时正常判定
  assert.strictEqual(e1warns('故曰火来生金，皆因土力不足。').length, 1, '「火来生金」非法应抓住');
});

test('E1 边界⑤：其余 E1 子类不受影响（五合）', () => {
  const w = runReplyValidation({ type: 'bazi' }, '甲庚相合，主事业有变。');
  assert.ok(w.some(x => x.indexOf('E1-五合错误') === 0), '五合校验不受生克边界改动影响');
});
