const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('archive library is separate from profile while reusing saved_charts', () => {
  const page = read('archives.html');
  const script = read('js/archive-library.js');
  const profile = read('profile.html');

  assert.match(page, /<title>命盘档案库 - 知时<\/title>/);
  assert.match(page, /id="archiveSearch"/);
  assert.match(page, /data-filter="male"/);
  assert.match(page, /data-filter="female"/);
  assert.match(script, /Auth\.getData\('saved_charts'\)/);
  assert.match(script, /Auth\.syncData\('saved_charts'/);
  assert.match(script, /p\.get\('name'\)\|\|chart\.name/);
  assert.match(script, /请先登录保存命盘档案/);
  assert.match(script, /BaZiCalculator\.normalizeBirthInput/);
  assert.match(script, /BaZiCalculator\.calculate/);
  assert.match(script, /继续问 AI/);
  assert.match(script, /sessionStorage\.setItem\('zhishi_open_archive_ai','1'\)/);
  assert.match(script, /ask\.addEventListener\('click',openAi\)/);
  assert.match(page, /archive-library\.js\?v=2/);
  assert.match(profile, /进入命盘档案库/);
  assert.doesNotMatch(profile, /charts\.forEach\(function\(c, i\)/);
});

test('archive AI continuation rebuilds the chart before restoring its conversation', () => {
  const integration = read('js/ai-chat-integration.js');
  const result = read('result.html');

  assert.match(integration, /function resumeArchivedChat\(\)/);
  assert.match(integration, /sessionStorage\.removeItem\('zhishi_open_archive_ai'\)/);
  assert.match(integration, /function openStandaloneChat\(\)/);
  assert.match(integration, /buildChartData\(\)/);
  assert.match(integration, /localStorage\.setItem\('ai_chart_data'/);
  assert.match(result, /ai-chat-integration\.js\?v=20260829a/);
});

test('mobile drawer exposes the archive library without replacing personal center', () => {
  const shell = read('js/mobile-app-shell.js');
  assert.match(shell, /href="\/archives">命盘档案<\/a>/);
  assert.match(shell, /href="\/profile">个人中心<\/a>/);
  assert.match(shell, /\^\\\/\(profile\|archives\|pricing\|auth\)/);
});

test('paipan name travels into result parameters and saved archive records', () => {
  const page = read('paipan.html');
  const main = read('js/main.js');
  const result = read('js/result.js');

  assert.match(page, /id="chartName"[\s\S]*value="案例1"/);
  assert.match(main, /params\.set\('name', readChartName\(\)\)/);
  assert.match(main, /input\.value = '案例' \+ \(max \+ 1\)/);
  assert.match(result, /name:\s*\(p\.get\('name'\)/);
  assert.match(result, /name:\s*_params\.name \|\| ''/);
});
