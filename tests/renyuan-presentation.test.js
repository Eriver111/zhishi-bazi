const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const resultSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
const resultHtml = fs.readFileSync(path.join(__dirname, '..', 'result.html'), 'utf8');
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
const proAnalysisSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'pro-analysis.js'), 'utf8');

test('result chart data stores the shared renyuan evidence', () => {
  assert.match(resultSource, /d\.renYuan\s*=\s*BaZiCalculator\.getRenYuanEvidence\(_bazi\)/);
  assert.match(resultSource, /d\.dayMasterStrength\._siLing\s*=\s*_bazi\._siLing/);
  assert.doesNotMatch(resultSource, /^(?:<<<<<<<|=======|>>>>>>>)/m);
});

test('result page cache-busts the repaired renderer bundle', () => {
  assert.match(resultHtml, /js\/result\.js\?v=19/);
  assert.match(resultHtml, /js\/pro-analysis\.js\?v=6/);
  assert.match(resultHtml, /js\/bazi\.js\?v=20260830a/);
});

test('strength renderer appends the shared note after the canonical detail', () => {
  const detailIndex = resultSource.indexOf("r.detail+'</p>'");
  const renyuanIndex = resultSource.indexOf('facts.renYuan');
  assert.ok(detailIndex >= 0, 'canonical strength detail should be rendered');
  assert.ok(renyuanIndex > detailIndex, 'renyuan note should follow canonical strength detail');
  assert.match(resultSource, /font-size:9px/);
  assert.match(resultSource, /ry\.visible/);
  assert.match(resultSource, /ry\.text/);
});

test('the visible professional card uses the same shared renyuan evidence', () => {
  assert.match(proAnalysisSource, /facts\s*&&\s*facts\.renYuan/);
  assert.match(proAnalysisSource, /renYuan\.text/);
  assert.doesNotMatch(proAnalysisSource, /var _relCN=/);
});

test('AI context receives the exact shared renyuan text as reference-only evidence', () => {
  assert.match(apiSource, /data\.renYuan\s*&&\s*data\.renYuan\.visible/);
  assert.match(apiSource, /data\.renYuan\.text/);
  assert.match(apiSource, /不改写日主旺衰、格局或喜用忌/);
});
