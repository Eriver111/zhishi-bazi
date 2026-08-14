const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildZiweiContext } = require('../lib/ziwei-context.js');
const ZiweiChat = require('../js/ziwei-chat.js');

const chartData = {
  type: 'ziwei',
  birth: {
    year: 2004, month: 8, day: 14, gender: 'male',
    effectiveSolarDate: '2004-8-14', chineseDate: '甲申 辛未 乙丑 丁丑',
    correctedTime: '真太阳时 00:26 · 子时',
  },
  wuxingJu: '土五局', mingGong: '午', bodyPalace: '福德', bodyPalaceZhi: '申',
  mingZhu: '破军', shenZhu: '天梁',
  sihua: [{ star: '武曲', hua: '科', palace: '财帛' }],
  palaces: [{
    index: 0, name: '财帛', hStem: '丙', eBranch: '寅', cs12: '病',
    major: [{ name: '武曲', brightness: '得', mutagen: '科' }],
    minor: [{ name: '禄存', brightness: '', mutagen: '' }],
    adj: ['凤阁'], decadal: { range: [85, 94], heavenlyStem: '丙', earthlyBranch: '寅' }, ages: [5, 17, 29],
  }],
  currentHoroscope: {
    asOf: '2026-8-14',
    decadal: { name: '大限', heavenlyStem: '辛', earthlyBranch: '未', palaceNames: ['疾厄', '财帛'], mutagen: ['巨门', '太阳', '文曲', '文昌'] },
    yearly: { name: '流年', heavenlyStem: '丙', earthlyBranch: '午', palaceNames: ['财帛', '子女'], mutagen: ['天同', '天机', '文昌', '廉贞'] },
    monthly: { name: '流月', heavenlyStem: '丙', earthlyBranch: '申', palaceNames: ['迁移', '疾厄'], mutagen: ['天同', '天机', '文昌', '廉贞'] },
  },
};

test('Ziwei AI context serializes star objects and current scopes as readable facts', () => {
  const context = buildZiweiContext(chartData);
  assert.match(context, /命宫：午宫/);
  assert.match(context, /身宫：申宫，落福德宫/);
  assert.match(context, /主星：武曲\[得\]化科/);
  assert.match(context, /辅星：禄存/);
  assert.match(context, /长生：病/);
  assert.match(context, /流年：丙午/);
  assert.match(context, /流月：丙申/);
  assert.doesNotMatch(context, /\[object Object\]/);
  assert.doesNotMatch(context, /日主|八字/);
});

test('Ziwei chat request keeps style, removes the duplicate current question and spends free allowance first', () => {
  const request = ZiweiChat.buildRequest({
    question: '今年事业怎么样', responseMode: 'pro', chartData,
    messages: [
      { role: 'user', content: '上一问' },
      { role: 'assistant', content: '上一答' },
      { role: 'user', content: '今年事业怎么样' },
    ],
    freeRemaining: 2, credits: 10, isMonthly: false, freeId: 'free-1', code: '',
  });

  assert.equal(request.mode, 'ziwei');
  assert.equal(request.response_mode, 'pro');
  assert.deepEqual(request.history, [
    { role: 'user', content: '上一问' },
    { role: 'assistant', content: '上一答' },
  ]);
  assert.equal(request.free_mode, true);
  assert.equal(request.free_id, 'free-1');
  assert.equal(request.code, undefined);
});

test('Ziwei chat prelude contains Ziwei facts without BaZi pattern language', () => {
  const prelude = ZiweiChat.buildPrelude(chartData);
  assert.match(prelude, /命宫：午宫/);
  assert.match(prelude, /身宫：申宫（落福德宫）/);
  assert.match(prelude, /五行局：土五局/);
  assert.doesNotMatch(prelude, /日主|旺衰|格局/);
  assert.deepEqual(ZiweiChat.THINK_STEPS, ['定位命身十二宫', '核对三方四正', '梳理四化运限']);
});

function responseRecorder() {
  return {
    statusCode: 200, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return body; },
    end() { return this; },
  };
}

test('Ziwei endpoint sends a readable Ziwei-only context and honors professional response mode', async () => {
  const root = path.join(__dirname, '..');
  const endpointPath = require.resolve(path.join(root, 'api', 'ai-chat.js'));
  const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
  const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));
  const previous = {
    key: process.env.AI_API_KEY, url: process.env.AI_API_URL, fetch: global.fetch,
    endpoint: require.cache[endpointPath], auth: require.cache[authPath], supabase: require.cache[supabasePath],
  };
  let upstream;
  const asyncNull = async () => null;
  try {
    process.env.AI_API_KEY = 'ziwei-test-key';
    process.env.AI_API_URL = 'https://example.invalid/chat/completions';
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { requireAuth: () => ({ uid: 'ziwei-user' }) } };
    require.cache[supabasePath] = {
      id: supabasePath, filename: supabasePath, loaded: true,
      exports: {
        deductCredit: asyncNull, deductCreditByUser: asyncNull, getCreditsByCode: async () => ({ credits: 1 }),
        getFreeUsage: async () => ({ used: 0 }), getUserCredits: async () => 1,
        isMonthlyActive: async () => null, isMonthlyActiveByUserId: async () => ({ expires_at: '2099-01-01' }),
        saveChatHistory: asyncNull, saveUserChatHistory: asyncNull, trackFreeUsage: async () => ({ remaining: 1 }),
        trackFreeUsageByUser: async () => ({ used: 0 }), bumpFreeUsageByUser: asyncNull,
      },
    };
    global.fetch = async (_url, options) => {
      upstream = JSON.parse(options.body);
      return {
        ok: true, status: 200,
        json: async () => ({ choices: [{ message: { content: '这是一段足够长的紫微斗数专业测试回答内容。' } }] }),
        text: async () => '',
      };
    };
    delete require.cache[endpointPath];
    const handler = require(endpointPath);
    const res = responseRecorder();
    await handler({
      method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' },
      body: { question: '分析今年事业', mode: 'ziwei', response_mode: 'pro', chartData, free_mode: true, free_id: 'ziwei-free' },
    }, res);

    assert.equal(res.statusCode, 200);
    const systemText = upstream.messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n');
    assert.match(systemText, /紫微斗数命盘（排盘事实）/);
    assert.match(systemText, /本轮使用专业紫微模式/);
    assert.match(systemText, /辅星：禄存/);
    assert.match(systemText, /流年：丙午/);
    assert.doesNotMatch(systemText, /完整八字排盘数据|\[object Object\]|日主旺衰/);
  } finally {
    if (previous.key === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previous.key;
    if (previous.url === undefined) delete process.env.AI_API_URL; else process.env.AI_API_URL = previous.url;
    global.fetch = previous.fetch;
    if (previous.endpoint) require.cache[endpointPath] = previous.endpoint; else delete require.cache[endpointPath];
    if (previous.auth) require.cache[authPath] = previous.auth; else delete require.cache[authPath];
    if (previous.supabase) require.cache[supabasePath] = previous.supabase; else delete require.cache[supabasePath];
  }
});
