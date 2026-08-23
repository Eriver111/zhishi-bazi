const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'meihua.html'), 'utf8');

function loadCore() {
  const start = html.indexOf("var TG=['乾'");
  const end = html.indexOf('function randomGua', start);
  assert.ok(start >= 0 && end > start, 'Meihua core must be extractable');
  const names = ['乾','兑','离','震','巽','坎','艮','坤'];
  const YIJING = [];
  names.forEach(upper => names.forEach(lower => YIJING.push({ name: upper + '/' + lower, upper, lower })));
  const sandbox = { YIJING };
  vm.runInNewContext(html.slice(start, end), sandbox);
  return sandbox;
}

test('Meihua uses canonical Earlier Heaven trigram lines and flips moving lines from bottom upward', () => {
  const core = loadCore();
  const first = core.getGua(1, 1, 1);
  assert.equal(first.orig.up, '乾');
  assert.equal(first.orig.dn, '乾');
  assert.equal(first.change.up, '乾');
  assert.equal(first.change.dn, '巽', 'changing line 1 must flip the bottom line');
  assert.equal(first.body.name, '乾');
  assert.equal(first.use.name, '乾');

  const sixth = core.getGua(1, 1, 6);
  assert.equal(sixth.change.up, '兑', 'changing line 6 must flip the top line');
  assert.equal(sixth.change.dn, '乾');
});

test('Meihua mutual hexagram follows lines 2-4 and 3-5', () => {
  const core = loadCore();
  const tun = core.getGua(6, 4, 1); // 坎上震下：水雷屯
  assert.equal(tun.mutual.up, '艮');
  assert.equal(tun.mutual.dn, '坤');
});

test('Meihua client explicitly selects its own AI rules', () => {
  assert.match(html, /divType:'meihua'/);
  assert.match(html, /体卦为.*用卦为.*体用关系/);
  assert.doesNotMatch(html, /返回JSON：/);
});
