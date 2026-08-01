const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
  return context.window.BaZiCalculator;
}

function renderProfessionalReport() {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars({
    year: { gan: '乙', zhi: '卯' },
    month: { gan: '辛', zhi: '酉' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '戊', zhi: '辰' },
  }, 'male');
  const nodes = {};
  const node = id => nodes[id] || (nodes[id] = { id, innerHTML: '', style: {}, classList: { add() {} } });
  const canvas = node('radarCanvas');
  canvas.getContext = () => ({
    scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {},
    arc() {}, fillText() {}, createRadialGradient() { return { addColorStop() {} }; },
  });
  const body = node('proBody');
  let onReady;
  const document = {
    readyState: 'loading',
    addEventListener(event, callback) {
      if (event === 'DOMContentLoaded') onReady = callback;
    },
    getElementById: node,
    querySelector(selector) {
      if (selector === '#proSection .drawer-body') return body;
      if (selector === '#proSection .drawer-arrow') return node('arrow');
      return null;
    },
    querySelectorAll() { return []; },
  };
  let factCalls = 0;
  const wrappedCalculator = Object.assign({}, calculator, {
    getProfessionalReportFacts(bazi) {
      factCalls += 1;
      return calculator.getProfessionalReportFacts(bazi);
    },
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pro-analysis.js'), 'utf8'), {
    _bazi: chart,
    document,
    window: { devicePixelRatio: 1 },
    BaZiCalculator: wrappedCalculator,
    console,
    setTimeout() { throw new Error('report data should already be ready'); },
  });
  onReady();
  return { body, nodes, factCalls };
}

test('专业报告从一份事实对象渲染五个核心证据区域', () => {
  const rendered = renderProfessionalReport();
  assert.equal(rendered.factCalls, 1);
  assert.match(rendered.body.innerHTML, /命局总纲/);
  assert.match(rendered.body.innerHTML, /旺衰依据/);
  assert.match(rendered.body.innerHTML, /格局成败/);
  assert.match(rendered.body.innerHTML, /喜用忌神/);
  assert.match(rendered.body.innerHTML, /原局作用链/);
  assert.match(rendered.body.innerHTML, /岁运联动/);
  assert.match(rendered.nodes.reportSummary.innerHTML, /甲日主/);
  assert.match(rendered.nodes.patternAnalysis.innerHTML, /破格/);
  assert.match(rendered.nodes.xiyongAnalysis.innerHTML, /用神/);
  assert.match(rendered.nodes.xiyongAnalysis.innerHTML, /喜神/);
  assert.match(rendered.nodes.xiyongAnalysis.innerHTML, /忌神/);
  assert.doesNotMatch(rendered.nodes.xiyongAnalysis.innerHTML, /闲神|仇神/);
  assert.notEqual(rendered.nodes.actionChainAnalysis.innerHTML, '');
  assert.match(rendered.nodes.fortuneInteractionAnalysis.innerHTML, /流年/);
  assert.match(rendered.nodes.fortuneInteractionAnalysis.innerHTML, /用神|喜神|忌神|中性/);
});
