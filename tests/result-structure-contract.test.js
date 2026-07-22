const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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
