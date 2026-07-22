const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stylesheetHrefs = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)]
  .map(({ 0: tag }) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
  .filter(Boolean);

test('bazi result retains the complete ordered long-report structure', () => {
  const html = read('result.html');
  const markers = [
    'section-dayun', 'section-liunian', 'section-sizhu',
    '>专业解读<', '>日主性格<', '>父母关系<', '>今年运势<',
    '>婚姻感情<', '>财运分析<', '>学业分析<', '>近5年流年运势<',
  ];
  let previous = -1;
  for (const marker of markers) {
    const current = html.indexOf(marker);
    assert.ok(current > previous, `${marker} is missing or out of order`);
    previous = current;
  }
  assert.match(html, /class="dayun-scroll-wrapper"/);
  assert.match(html, /class="liunian-scroll-wrapper"/);
  assert.match(html, /class="pp-col pp-liunian-col"/);
  assert.match(html, /class="pp-col pp-dayun-col"/);
  assert.match(html, /js\/ai-chat-integration\.js/);
});

test('hepan result keeps its existing result and AI integration hooks', () => {
  const html = read('hepan-result.html');
  for (const marker of ['section-dayun', 'section-liunian', 'section-sizhu', 'js/hepan-result.js', 'js/ai-chat-integration.js']) {
    assert.ok(html.includes(marker), `hepan-result.html lost ${marker}`);
  }
});

test('result-capable pages load the result skin after every existing stylesheet', () => {
  for (const page of ['result.html', 'hepan-result.html', 'ziwei.html', 'liuren.html']) {
    const hrefs = stylesheetHrefs(read(page));
    assert.equal(hrefs.at(-1), 'css/theme-light-results.css?v=1', `${page} must load the result skin last`);
  }

  for (const page of ['ziwei.html', 'liuren.html']) {
    const hrefs = stylesheetHrefs(read(page));
    assert.ok(
      hrefs.indexOf('css/theme-light-forms.css?v=1') < hrefs.indexOf('css/theme-light-results.css?v=1'),
      `${page} must keep the form skin before the result skin`,
    );
  }
});

test('result skin is additive and cannot convert or hide the existing layout', () => {
  const stylesheet = path.join(root, 'css', 'theme-light-results.css');
  assert.ok(fs.existsSync(stylesheet), 'missing result-only light theme');
  const css = read('css/theme-light-results.css');

  for (const selector of [
    '.result-container', '.result-header', '.section-dayun', '.section-liunian',
    '.section-sizhu', '.result-section', '.analysis-section', '.pro-section',
    '.dayun-col', '.liunian-col', '.pp-col', '.dayun-col.current',
    '.dayun-col.active', '.liunian-col.current-year', '.liunian-col.active-ln',
    '.pp-dayun-col.active-dayun', '.pp-liunian-col.active-liunian',
    '.dayun-scroll-wrapper', '.liunian-scroll-wrapper', '.dayun-scroll',
    '.liunian-scroll', '.ai-float-btn', '#aiFloatBtn',
  ]) {
    assert.ok(css.includes(selector), `result skin lost ${selector}`);
  }

  assert.match(css, /overflow-x\s*:\s*auto/);
  assert.match(css, /-webkit-overflow-scrolling\s*:\s*touch/);
  assert.doesNotMatch(css, /\bdisplay\s*:/i, 'result skin must not replace the existing display model');
  assert.doesNotMatch(css, /\b(?:grid-template|grid-area|order)\s*:/i, 'result skin must not reorder result modules');
  assert.doesNotMatch(css, /\b(?:visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)/i, 'result skin must not hide result modules');
});
