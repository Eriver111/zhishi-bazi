const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const apiPath = path.join(__dirname, '../api/ai-chat.js');
const apiRequire = createRequire(apiPath);
const source = fs.readFileSync(apiPath, 'utf8');
function fixture() {
  function person(name, gender, day, level, pattern, yong, xi, ji) {
    return { name, gender, dayMaster: { gan: day }, dayMasterStrength: { level },
      pattern: { name: pattern }, yongJi: { yongShen: yong, xiShen: xi, jiShen: ji },
      fourPillars: { year: { gan: '甲', zhi: '子' }, month: { gan: '乙', zhi: '丑' },
        day: { gan: day, zhi: '寅' }, hour: { gan: '丁', zhi: '卯' } } };
  }
  return { type: 'hepan', relationType: '情侣',
    person1: person('我', 'female', '丙', '中和', '正官格', ['木'], ['木', '火'], ['金', '水']),
    person2: person('对方', 'male', '壬', '偏弱', '七杀格', ['金'], ['金', '水'], ['土', '火']) };
}

// Run the real handler with isolated dependencies: no production env, local
// data-store, network calls, user records or billing can be touched by tests.
function load({ loggedIn = true, used = 0, monthly = false, replies = [] } = {}) {
  const events = [], requests = [];
  const db = {
    trackFreeUsageByUser: async () => ({ used }),
    getFreeUsage: async () => ({ used }),
    getUserCredits: async () => 10,
    getCreditsByCode: async () => ({ credits: 10 }),
    isMonthlyActive: async () => monthly,
    isMonthlyActiveByUserId: async () => monthly,
    bumpFreeUsageByUser: async () => events.push('free-user'),
    trackFreeUsage: async () => { events.push('free-anon'); return { remaining: 1 }; },
    deductCreditByUser: async () => { events.push('credit-user'); return { credits: 9 }; },
    deductCredit: async () => { events.push('credit-code'); return { credits: 9 }; },
    saveChatHistory: async (_, role) => events.push('save-' + role),
    saveUserChatHistory: async (_, role) => events.push('save-' + role)
  };
  const sandbox = { module: { exports: {} }, process: { env: { AI_API_KEY: 'test-only-not-a-real-key' } },
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, AbortController,
    require(name) {
      if (name === '../lib/supabase.js') return db;
      if (name === '../lib/auth.js') return { requireAuth: () => loggedIn ? { uid: 'test-user' } : null,
        getClientIp: () => '192.0.2.1' };
      if (name === '../lib/ai-abuse-guard.js') return { beginAiRequest: () => ({ ok: true,
        release: () => events.push('release') }) };
      return apiRequire(name);
    },
    async fetch(_, options) {
      requests.push(JSON.parse(options.body));
      const reply = replies[requests.length - 1];
      if (reply instanceof Error) throw reply;
      assert.equal(typeof reply, 'string', 'unexpected model call');
      return { ok: true, json: async () => ({ choices: [{ message: { content: reply } }] }) };
    }
  };
  vm.runInNewContext(source, sandbox, { filename: apiPath });
  return { handler: sandbox.module.exports, events, requests };
}
function response() {
  return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}
function conflicts(chart, text) {
  return load().handler._test.runReplyValidation(chart, text, '相处应注意什么').filter(w => w.startsWith('E1-合盘'));
}

test('same-line comparisons do not inherit the preceding person', () => {
  const chart = fixture();
  for (const previous of ['甲方', '乙方']) {
    assert.equal(conflicts(chart, previous + '：\n甲方是丙火日主，乙方是壬水日主。').length, 0);
    assert.equal(conflicts(chart, previous + '：\n乙方用神金，甲方用神木。').length, 0);
  }
  assert.ok(conflicts(chart, '甲方日主丙火，乙方日主丙火。').some(w => w.includes('乙方')));
  assert.ok(conflicts(chart, '甲方用神金，乙方用神木。').length >= 2);
});

test('pronouns, headings and names preserve independent facts', () => {
  const chart = fixture();
  assert.equal(conflicts(chart, '甲方：丙火日主，命局中和。\n他是壬水日主，命局偏弱。\n你是丙火日主。').length, 0);
  assert.equal(conflicts(chart, '乙方用神金，她的用神木。').length, 0);
  assert.equal(conflicts(chart, '甲方：\n- 用神木\n- 喜神火\n乙方：\n- 用神金\n- 忌神土').length, 0);
  chart.person1.name = '青禾'; chart.person2.name = '知夏';
  assert.equal(conflicts(chart, '青禾是丙火日主，知夏是壬水日主。').length, 0);
  assert.ok(conflicts(chart, '知夏是丙火日主。').length);
});

test('ambiguous pronouns clear ownership instead of attaching to previous heading', () => {
  const chart = fixture(); chart.person1.gender = 'male';
  assert.equal(conflicts(chart, '甲方：丙火日主。\n他是壬水日主。').length, 0);
  assert.ok(conflicts(chart, '甲方：壬水日主。').length);
  assert.ok(conflicts(fixture(), '乙方：其他建议暂略。日主丙火。').length);
});

test('joint assertions and real swaps are still rejected', () => {
  assert.ok(conflicts(fixture(), '甲方与乙方都是丙火日主。').some(w => w.includes('乙方')));
  assert.ok(conflicts(fixture(), '双方用神木。').some(w => w.includes('乙方')));
  assert.ok(conflicts(fixture(), '甲方主格七杀格，乙方主格正官格。').length >= 2);
  assert.ok(conflicts(fixture(), '甲方命局偏弱，乙方命局中和。').length >= 2);
});

test('same-line comparisons keep separate age ranges and luck cycles', () => {
  const chart = fixture();
  chart.person1.daYun = { startAge: 5.2, cycles: [{ displayAge: '6', gan: '甲', zhi: '申' }] };
  chart.person2.daYun = { startAge: 3.4, cycles: [{ displayAge: '4', gan: '癸', zhi: '丑' }] };
  assert.equal(conflicts(chart, '乙方：\n甲方6-15岁：甲申；乙方4-13岁：癸丑。').length, 0);
  assert.ok(conflicts(chart, '甲方6-15岁：癸丑；乙方4-13岁：甲申。').length >= 2);
});

test('gender pronouns follow reversed person order, not a fixed male/female slot', () => {
  const chart = fixture();
  [chart.person1, chart.person2] = [chart.person2, chart.person1];
  assert.equal(conflicts(chart, '甲方：壬水日主。她是丙火日主，命局中和。\n你用神木，他用神金。').length, 0);
  assert.ok(conflicts(chart, '她是壬水日主，他是丙火日主。').length >= 2);
});

const bad = '甲方是壬水日主，乙方是丙火日主。相处时需要分别看各自的需要。';
const good = '甲方是丙火日主，乙方是壬水日主。相处时建议明确表达需求，讨论具体分歧。';
const routes = [
  { name: 'logged-in free', free: true, charge: 'free-user' },
  { name: 'anonymous free', free: true, loggedIn: false, charge: 'free-anon' },
  { name: 'free exhausted to credits', free: true, used: 4, charge: 'credit-user' },
  { name: 'free exhausted to membership', free: true, used: 4, monthly: true },
  { name: 'account credits', charge: 'credit-user' },
  { name: 'redemption credits', loggedIn: false, code: 'test-code', charge: 'credit-code' },
  { name: 'monthly membership', monthly: true }
];
for (const route of routes) {
  for (const outcome of ['blocked', 'repair-unavailable', 'repaired', 'valid']) {
    test(route.name + ': ' + outcome, async () => {
      const replies = outcome === 'valid' ? [good] : [bad,
        outcome === 'repaired' ? good : outcome === 'repair-unavailable' ? new Error('test timeout') : bad];
      const { handler, events, requests } = load({ ...route, replies });
      const res = response();
      await handler({ method: 'POST', headers: {}, body: {
        question: '相处应注意什么', chartData: fixture(),
        free_mode: route.free, free_id: route.free ? 'test-device' : undefined, code: route.code
      } }, res);
      const success = outcome === 'repaired' || outcome === 'valid';
      assert.equal(res.statusCode, success ? 200 : 502);
      assert.equal(requests.length, outcome === 'valid' ? 1 : 2);
      const charges = events.filter(e => /^(free-|credit-)/.test(e));
      assert.deepEqual(charges, success && route.charge ? [route.charge] : []);
      assert.equal(events.filter(e => e === 'save-assistant').length, success ? 1 : 0);
      assert.equal(events.filter(e => e === 'release').length, 1);
      if (success) assert.equal(res.body.reply, good);
      else {
        assert.equal(res.body.code, 'HEPAN_VALIDATION_FAILED');
        assert.equal(res.body.charged, false);
        assert.match(res.body.error, /未扣次数/);
        assert.equal(res.body.reply, undefined);
      }
    });
  }
}

test('legacy fallback notice is excluded from model history', async () => {
  const { handler, requests } = load({ replies: [good] });
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { question: '相处应注意什么', chartData: fixture(),
    history: [{ role: 'assistant', content: '刚才生成的合盘回答未通过双方身份归属校验。以下只列系统冻结事实：旧通知' },
      { role: 'user', content: '请继续讨论沟通方式' }] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(requests[0].messages.some(m => m.role === 'assistant' && m.content.includes('旧通知')), false);
  assert.ok(requests[0].messages.some(m => m.content === '请继续讨论沟通方式'));
});
