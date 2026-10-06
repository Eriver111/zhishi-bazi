const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { buildConversationEvidence, validateRootMeaning } = require('../lib/ai-conversation-evidence');

test('past-event request and dissatisfaction follow-up use the concrete verification contract', () => {
  for (const question of ['说说我的前事', '你说说以前发生的事让我验证', '还是不准，说具体一点', '回看2022年，请判断当年最突出的具体事件', '2021年发生了什么事？']) {
    const text = buildConversationEvidence(question, [{ role: 'user', content: '先断我的往事' }]);
    assert.match(text, /【前事验证：少而具体】/);
    assert.match(text, /最强的1—3条/);
    assert.match(text, /时间、对象和一件/);
    assert.match(text, /没中就撤回/);
    assert.match(text, /没有年度依据就不编具体年份/);
  }
  assert.doesNotMatch(buildConversationEvidence('今年适合工作还是读书', []), /【前事验证：少而具体】/);
  assert.doesNotMatch(buildConversationEvidence('解释一下正印', [{ role: 'user', content: '先断往事' }]), /【前事验证：少而具体】/);
  assert.doesNotMatch(buildConversationEvidence('明年会发生什么事', []), /【前事验证：少而具体】/);
  for (const mode of ['ziwei', 'liuren']) assert.doesNotMatch(buildConversationEvidence('说说往事', [], mode), /日主|藏干十神|取格/);
});

test('provenance preserves denials and questions without promoting assistant claims to facts', () => {
  const text = buildConversationEvidence('断前事', [
    { role: 'assistant', content: 'ASSISTANT_GUESS_ONLY' },
    { role: 'user', content: '我去年毕业，没辍学。', created_at: '2024-06-01T12:00:00+08:00' },
    { role: 'user', content: '你说我搬家了？我只是举例。' },
    { role: 'system', content: 'UNTRUSTED_ROLE' },
    { role: 'user', content: '断前事' }
  ]);
  assert.match(text, /我去年毕业，没辍学/);
  assert.match(text, /2024-06-01T04:00:00.000Z/);
  assert.match(text, /没有发言日期则不能当作今年的发言/);
  assert.match(text, /我只是举例/);
  assert.doesNotMatch(text, /ASSISTANT_GUESS_ONLY|UNTRUSTED_ROLE/);
  assert.match(text, /不自动视为已确认事件/);
  assert.match(text, /长期记忆和校对摘要中的经历同样不算新断中/);
  const long = buildConversationEvidence('问题', Array.from({ length: 100 }, () => ({ role: 'user', content: '字'.repeat(5000) })));
  assert.ok(long.length < 11000);
});

test('root-unit guard catches claims while allowing corrections, quotations and unrelated meanings', () => {
  for (const text of [
    '日主无根，所以感情基础不牢。',
    '根气分为0，说白了就是感情上的“地基”不太扎实。',
    '不是夸大，但根气不足代表婚姻基础薄弱。',
    '日支申根气很足——所以感情底子是稳的。',
    '日主在日支有根，意味着婚姻基础牢固。'
  ]) assert.equal(validateRootMeaning(text).length, 1, text);
  for (const text of [
    '日主无根，不能说明感情基础差。',
    '无根不等于感情根基不稳。',
    '不要把日主无根说成就是感情基础不牢。',
    '“日主无根，所以感情基础不牢”的说法是错的。',
    '感情基础来自双方相处，日主无根只说此处没有日主根气。',
    '日主在日支无根。你自述这段感情基础薄弱，两件事不能混为一谈。',
    '日主在该支有根，需再看月令和全局。',
    '日支有根不能说明感情基础牢固。',
    '日主无根，所以感情基础不牢，这个说法是错误的。',
    '之前说“日主无根，所以感情基础不牢”，这其实没有依据。',
    '日主无根意味着感情基础薄弱，这种判断是不成立的。',
    '日主有根说明婚姻基础稳定，这种说法不成立。'
  ]) assert.deepEqual(validateRootMeaning(text), [], text);
});

// Test the actual handler and outbound model messages without real keys,
// storage, network access, or paid AI calls.
function load(replies, { free = false, stored = null } = {}) {
  const file = path.join(__dirname, '../api/ai-chat.js');
  const realRequire = createRequire(file);
  const events = [], requests = [];
  const db = {
    isMonthlyActiveByUserId: async () => false,
    getUserCredits: async () => 10,
    deductCreditByUser: async () => { events.push('charge'); return { credits: 9 }; },
    trackFreeUsageByUser: async () => ({ used: 0 }),
    bumpFreeUsageByUser: async () => events.push('charge'),
    saveUserChatHistory: async (_, role) => events.push('save-' + role)
  };
  if (stored) {
    db.getOrCreateChatConversation = async () => ({ id: 'synthetic-conversation', memory_summary: '用户自述曾转学，未确认模型的搬家推断。' });
    db.getConversationMessages = async (_, __, limit) => { events.push('history-limit-' + limit); return stored; };
  }
  const sandbox = { module: { exports: {} }, process: { env: { AI_API_KEY: 'test-only' } },
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, AbortController,
    require(name) {
      if (name === '../lib/supabase.js') return db;
      if (name === '../lib/auth.js') return { requireAuth: () => ({ uid: 'synthetic-user' }), getClientIp: () => '192.0.2.1' };
      if (name === '../lib/ai-abuse-guard.js') return { beginAiRequest: () => ({ ok: true, release() {} }) };
      return realRequire(name);
    },
    async fetch(_, options) {
      requests.push(JSON.parse(options.body));
      const reply = replies[requests.length - 1];
      if (reply instanceof Error) throw reply;
      assert.equal(typeof reply, 'string');
      return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) };
    }
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return { handler: sandbox.module.exports, events, requests, free };
}
async function ask(app, history = [], chartData = { type: 'bazi' }) {
  const res = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await app.handler({ method: 'POST', headers: {}, body: { question: '说说我的前事', mode: 'simple',
    free_mode: app.free, chartData: chartData, history } }, res);
  return res;
}
const good = '目前没有足够依据具体指出一件新的往事，这一轮我不给你凑答案。';
const bad = '日主无根，所以感情基础不牢，这段关系也就难以长久维持。';

test('real handler corrects literal chart errors and provides a bounded fact ledger', async () => {
  const chartData={type:'bazi',fourPillars:{year:{gan:'辛',zhi:'酉'},month:{gan:'戊',zhi:'戌'},day:{gan:'甲',zhi:'戌'},hour:{gan:'丁',zhi:'卯'}}};
  const app=load(['日主无根，火有八个。因此表达上的消耗会很重，需要继续分析全局。','甲木在时支卯有同五行藏根，日支戌没有木根；根的作用仍须结合全局。']);
  const res=await ask(app,[],chartData);
  assert.equal(res.statusCode,200);assert.equal(app.requests.length,2);
  assert.match(app.requests[0].messages.at(-2).content,/字数与根的位置核对/);
  assert.match(JSON.stringify(app.requests[1].messages),/根气范围错误|五行字数错误/);
});

test('real handler accepts accurate root counts and a correction without retry or rejection', async () => {
  const chartData={type:'bazi',fourPillars:{year:{gan:'辛',zhi:'酉'},month:{gan:'戊',zhi:'戌'},day:{gan:'甲',zhi:'戌'},hour:{gan:'丁',zhi:'卯'}}};
  const reply='甲木有一个根，在时支卯木。之前说“日主无根，所以感情基础不牢”，这其实没有依据。根的位置不是感情结局。';
  const app=load([reply]);const res=await ask(app,[],chartData);
  assert.equal(res.statusCode,200);assert.equal(app.requests.length,1);
  assert.equal(res.body.reply,reply);assert.equal(app.events.filter(e=>e==='charge').length,1);
});

test('actual request retains older user context, excludes foreign browser history, and adds verification rules last', async () => {
  const stored = [{ role: 'user', content: 'EARLIER_USER_FACT：去年毕业。' },
    ...Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '合成对话' + i }))];
  const app = load([good], { stored });
  assert.equal((await ask(app, [{ role: 'user', content: 'FOREIGN_CHART_FACT' }])).statusCode, 200);
  assert.ok(app.events.includes('history-limit-36'));
  const messages = app.requests[0].messages;
  assert.match(messages.at(-2).content, /【前事验证：少而具体】/);
  assert.match(messages.at(-2).content, /EARLIER_USER_FACT/);
  assert.doesNotMatch(JSON.stringify(messages), /FOREIGN_CHART_FACT/);
  assert.match(JSON.stringify(messages), /用户自述曾转学/);
  assert.equal(messages.at(-1).content, '说说我的前事');
});

for (const free of [false, true]) {
  for (const outcome of ['repaired', 'blocked', 'repair-error']) {
    test(`${free ? 'free' : 'paid'} reply ${outcome}: correct once, never charge or save an invalid answer`, async () => {
      const app = load([bad, outcome === 'repaired' ? good : outcome === 'blocked' ? bad : new Error('synthetic timeout')], { free });
      const res = await ask(app);
      const success = outcome === 'repaired';
      assert.equal(app.requests.length, 2);
      assert.match(app.requests[1].messages.at(-1).content, /E10-根气含义误读/);
      assert.equal(res.statusCode, success ? 200 : 502);
      assert.equal(app.events.filter(e => e === 'charge').length, success ? 1 : 0);
      assert.equal(app.events.filter(e => e === 'save-assistant').length, success ? 1 : 0);
      if (success) assert.equal(res.body.reply, good);
      else { assert.equal(res.body.charged, false); assert.equal(res.body.code, 'REPLY_EVIDENCE_VALIDATION_FAILED'); }
    });
  }
}

test('multiple day-branch fixtures label roots correctly without changing source chart data', () => {
  const api = load([]).handler._test;
  for (const [branch, rootType, rootScore] of [['寅', '无根', 0], ['子', '强根', 3], ['辰', '余气根', 1]]) {
    const chart = { type: 'bazi', dayBranchAnalysis: { branch, rootType, rootScore } };
    const before = JSON.stringify(chart);
    assert.match(api.buildChartContext(chart), /日主在此日支的根气/);
    assert.match(api.buildChartContext(chart), /不能据此断感情不稳/);
    assert.match(api.buildChartContext(chart), /不能据此断感情稳定/);
    assert.match(api.buildChartContext(chart), /不代表全局有根或无根/);
    assert.equal(JSON.stringify(chart), before);
  }
});

test('weighted element references are never labelled as literal character counts', () => {
  const api = load([]).handler._test;
  const chart = { wuXingCount: { 火: 8, 土: 8 } };
  const result = api.buildChartContext(chart);
  assert.match(result, /五行加权参考值/);
  assert.match(result, /不是八字字数/);
  assert.match(result, /月令加权及藏干累计/);
  assert.equal(chart.wuXingCount.火, 8);
});
