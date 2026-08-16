// B4 契约测试（2026-08-15，GPT 终裁批准 B4 进入 AI_REPORT_LAYER_FROZEN 变更流程）
// 白名单三字段：①pattern.mechanism ②候选对比 evidence ③chainHints 财→杀事实链。
// 断言：
//   A（#61 事实锁）：AI context 含 pattern=财生杀格 + mechanism=财生杀，且不得以「财生官」描述壬七杀关系；
//   B（冻结字段锁）：六盘 strengthScore/strengthLabel/pattern.name/pattern.status/用神/喜神/忌神 在 context 中逐字段正确呈现。
// 红线：AI 不得据此改 pattern/status/strength/用神喜忌（见 api/ai-chat.js 提示词新锁）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');

// 引擎：bazi.js + bazi-chain.js 同 context 加载（与生产 result.html 三文件口径一致）
const SHARED = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'bazi.js'), 'utf8'), SHARED);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'bazi-chain.js'), 'utf8'), SHARED);
const E = SHARED.window.BaZiCalculator;

function buildPillars(gz) {
  const p = gz.split(' ');
  return E.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

// 提取 buildSingleChart（873-1174，纯字符串拼接函数，无内部依赖；函数体自带 let ctx 声明）
// 注意：文件为 CRLF 行尾，边界用 \r?\n 容错
const m = apiSource.match(/function buildSingleChart\(data\) \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\*\*/);
assert.ok(m, 'buildSingleChart 提取失败——api/ai-chat.js 结构变化，需人工复核');
const buildSingleChart = new Function('data', m[1].replace(/^  /gm, ''));

// 模拟 js/ai-chat-integration.js:553-561 的数据组装（完整对象透传；chainHints 在 getYongJi 输出内）
function chartDataFor(gz) {
  const b = buildPillars(gz);
  return {
    dayMasterStrength: E.calcDayMasterStrength(b),
    pattern: E.getPattern(b),
    yongJi: E.getYongJi(b)
  };
}

// GPT 指定六盘（PAT01/PAT04/R06/X04 取自 _aireport_batch chartdata 四柱；TH07 取自 _aireport_batch.js:24；#61 为 P5-B 验收盘）
const DISKS = {
  PAT01: '癸亥 甲寅 戊辰 丁巳',
  PAT04: '丁亥 己酉 甲辰 庚午',
  R06: '辛卯 丁酉 乙亥 己卯',
  X04: '戊辰 丙辰 壬戌 庚戌',
  TH07: '丁未 丁未 辛丑 戊子',
  '#61': '己丑 壬申 丙午 壬辰'
};

test('B4 源码：mechanism 输出行与提示词三锁存在', () => {
  assert.ok(apiSource.includes('格局机制：${pt.mechanism}'), 'buildSingleChart 需输出 pattern.mechanism');
  assert.ok(apiSource.includes('pattern.mechanism**（格局机制）'), '提示词需含 mechanism 锁（解释字段不是裁决字段）');
  assert.ok(apiSource.includes('候选对比**（五行候选评分对比）'), '提示词需含候选对比锁');
  assert.ok(apiSource.includes('chainHints 是解释性证据'), '提示词需含 chainHints 不得重新判命锁');
});

test('B4 A锁：#61 事实锁——财生杀格+机制共存，无财生官残留', () => {
  const ctx = buildSingleChart(chartDataFor(DISKS['#61']));
  assert.ok(ctx.includes('命局格局：财生杀格'), 'AI context 格局名应为财生杀格\n' + ctx.slice(0, 600));
  assert.ok(ctx.includes('格局机制：财生杀'), 'AI context 应输出机制=财生杀');
  // GPT 硬断言 A：不得重新出现「财生官」来描述壬七杀这条关系（含旧格名残留与机制误标两种泄漏形态）
  assert.ok(!ctx.includes('财生官'), '#61 的 AI context 不得出现「财生官」任何形态\n' + ctx.slice(0, 600));
  assert.ok(!ctx.includes('财生官格'), '#61 的 AI context 不得残留旧格名「财生官格」');
  // 白名单 ③：财→杀事实链可见（chainHints 财党杀 hint，实测文本「财星生助官杀」）
  assert.ok(ctx.includes('财星生助官杀') || ctx.includes('财党杀'), 'AI context 应包含财→杀生克链事实');
});

test('B4 B锁：六盘冻结字段在 AI context 中逐字段正确呈现', () => {
  Object.keys(DISKS).forEach(id => {
    const gz = DISKS[id];
    const data = chartDataFor(gz);
    const ctx = buildSingleChart(data);
    const ds = data.dayMasterStrength, pt = data.pattern, yj = data.yongJi;
    // 冻结字段锁：strengthScore/strengthLabel/pattern.name/pattern.status/用神/喜神/忌神
    assert.ok(ctx.includes(`日主旺衰评定：${ds.level}（评分 ${ds.score}`), id + ' 旺衰评定未按引擎原值呈现');
    assert.ok(ctx.includes(`命局格局：${pt.name}`), id + ' 格局名未按引擎原值呈现');
    assert.ok(ctx.includes(`格局状态：${pt.status}`), id + ' 格局状态未按引擎原值呈现');
    const y = (yj.yongShen || []).join('、') || '—';
    const x = (yj.xiShen || []).join('、') || '—';
    const j = (yj.jiShen || []).join('、') || '—';
    assert.ok(ctx.includes(`用神：${y}`), id + ' 用神未按引擎原值呈现');
    assert.ok(ctx.includes(`喜神：${x}`), id + ' 喜神未按引擎原值呈现');
    assert.ok(ctx.includes(`忌神：${j}`), id + ' 忌神未按引擎原值呈现');
  });
});

test('B4 白名单：候选对比证据出现在有 candidateScores 的盘', () => {
  Object.keys(DISKS).forEach(id => {
    const data = chartDataFor(DISKS[id]);
    const ctx = buildSingleChart(data);
    const hasCand = data.yongJi && Array.isArray(data.yongJi.candidateScores) && data.yongJi.candidateScores.length;
    if (hasCand) {
      assert.ok(ctx.includes('候选对比'), id + ' 有 candidateScores 但 context 缺候选对比证据');
    }
  });
});
