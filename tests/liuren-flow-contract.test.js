const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'liuren.html'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'lr-ai-chat.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');

test('Liuren chat always routes as Liuren while response style remains separate', () => {
  assert.match(chat, /mode:'liuren',response_mode:AI\.mode/);
  assert.match(chat, /ChatPersistence\.decorate\(body,'liuren'/);
  assert.match(chat, /hideThinking\(\);AI\.isWaiting=false;document\.getElementById\('sendBtn'\)\.disabled=false;[\s\S]*?return;/);
  assert.doesNotMatch(chat, /paipan\.html.*八字排盘/);
  assert.match(api, /mode === 'liuren' && responseMode === 'pro'/);
  assert.match(api, /不把八字流年、流月规则混入课盘/);
});

test('Liuren candidate patterns do not overstate good or bad outcomes', () => {
  assert.match(page, /idxs\[0\]===6&&idxs\[1\]===3&&idxs\[2\]===0/);
  assert.match(page, /午卯子 · 轩盖候选/);
  assert.match(page, /巳戌卯 · 铸印候选/);
  assert.doesNotMatch(page, /三传俱空事必无成/);
  assert.doesNotMatch(page, /占前程大利/);
});

test('Liuren chart passes all computed facts into AI storage', () => {
  assert.match(page, /yinYangGuiRen:d\.yinYangGuiRen,derivedPatterns:pats/);
  assert.match(api, /前端规则识别的候选线索（不得当作已成吉凶格）/);
});
