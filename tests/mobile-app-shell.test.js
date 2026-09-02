const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('home and paipan share one versioned mobile shell without touching desktop markup', () => {
  const home = read('index.html');
  const paipan = read('paipan.html');

  for (const source of [home, paipan]) {
    assert.match(source, /css\/mobile-app-shell\.css\?v=8/);
    assert.match(source, /js\/mobile-app-shell\.js\?v=7/);
  }

  assert.doesNotMatch(home, /class="mobile-home-dashboard"/);
  assert.match(home, /class="mobile-home-fortune"/);
  assert.match(home, /js\/home-fortune\.js\?v=2/);
  assert.match(paipan, /<script src="js\/main\.js\?v=2"><\/script>\s*<script src="js\/mobile-app-shell\.js\?v=7"><\/script>/);
});

test('feature pages share the same back header and result uses a four-pillar mobile grid', () => {
  const css = read('css/mobile-app-shell.css');
  const js = read('js/mobile-app-shell.js');
  const auth = read('js/auth.js');

  assert.match(js, /setAttribute\('aria-label', '返回上一页'\)/);
  assert.match(js, /window\.history\.back\(\)/);
  assert.match(auth, /'\/result', '\/ziwei', '\/hepan', '\/hepan-result', '\/fortune'/);
  assert.doesNotMatch(auth, /'\/zw-ai-chat'/);
  assert.match(auth, /mobile-app-shell\.css\?v=21/);
  assert.match(auth, /mobile-app-shell\.js\?v=7/);
  assert.match(read('result.html'), /js\/auth\.js\?v=18/);
  assert.match(css, /body\.mobile-page-result \.pp-row[\s\S]*grid-template-columns:\s*34px repeat\(6/);
  assert.match(css, /body\.mobile-page-result \.pp-dayun-col,[\s\S]*\.pp-liunian-col[\s\S]*display:\s*flex !important/);
  assert.match(css, /body\.mobile-page-result \.section-sizhu \.pp-shensha-row[\s\S]*display:\s*none !important/);
  assert.match(css, /body\.mobile-page-result \.section-dayun,[\s\S]*border-radius:\s*0 !important/);
  assert.match(css, /body\.mobile-page-result \.section-sizhu \.tian-gan,[\s\S]*font-family:\s*"PingFang SC"/);
  assert.match(css, /body\.mobile-page-result \.section-sizhu \.tian-gan,[\s\S]*font-size:\s*27px !important/);
  assert.match(read('result.html'), /class="pp-row pp-fuxing-row"[\s\S]*<div class="pp-label">副星<\/div>/);
  assert.match(css, /body\.mobile-page-result \.section-sizhu \.pp-fuxing[\s\S]*min-height:\s*68px/);
  assert.match(js, /syncResultSectionOrder/);
  assert.match(js, /container\.insertBefore\(sizhu, dayun\)/);
  assert.match(js, /function createResultModeTabs\(\)/);
  for (const label of ['基础排盘', '专业解读', '白话详参']) {
    assert.match(js, new RegExp(label));
  }
  assert.match(css, /\.mobile-result-tabs[\s\S]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.section-sizhu \.pp-aux-row,[\s\S]*\.section-sizhu \.pp-shensha-row[\s\S]*display:\s*none !important/);
  assert.match(js, /panelGroups[\s\S]*professional:[\s\S]*reading:/);
  assert.match(js, /getElementById\('unifiedReport'\)[\s\S]*data-result-panel', 'reading'/);
  assert.match(js, /document\.body\.classList\.add\('mobile-result-view-basic'\)/);
  const result = read('result.html');
  for (const row of ['pp-xingyun-row', 'pp-zizuo-row', 'pp-kongwang-row', 'pp-nayin-row']) {
    assert.match(result, new RegExp(row));
  }
  assert.match(css, /\.ai-fab::before,[\s\S]*content:\s*"AI"/);
});

test('mobile shell is narrow-screen only and preserves accessible navigation', () => {
  const css = read('css/mobile-app-shell.css');
  const js = read('js/mobile-app-shell.js');

  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.mobile-app-header,[\s\S]*\.mobile-app-drawer__overlay\s*\{\s*display: none;/);
  assert.match(js, /setAttribute\('aria-label', '手机端主导航'\)/);
  assert.match(js, /setAttribute\('aria-current', 'page'\)/);
  assert.match(js, /\{ key: 'home', label: '首页'/);
  assert.match(js, /\{ key: 'fate', label: '命理'/);
  assert.match(js, /\{ key: 'divination', label: '卜筮'/);
  assert.match(js, /\{ key: 'divination', label: '卜筮', href: '\/liuyao' \}/);
  assert.match(js, /id = 'mobileAppDrawer'/);
  assert.match(js, /href="\/archives">命盘档案<\/a>/);
  assert.doesNotMatch(js, /href:\s*'\/liuren'/);
  assert.match(js, /\{ key: 'observe', label: '观相'/);
  assert.match(js, /\{ key: 'profile', label: '我的'/);
});

test('paipan mobile styling remains presentation-only', () => {
  const css = read('css/mobile-app-shell.css');
  const js = read('js/mobile-app-shell.js');

  assert.match(css, /body\.mobile-page-paipan \.field select/);
  assert.match(css, /body\.mobile-page-paipan \.submit/);
  assert.doesNotMatch(js, /calculate|calculateDaYun|birthForm\.addEventListener|fetch\s*\(/);
});
