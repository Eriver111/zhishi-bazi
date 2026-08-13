const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return body; },
    end() { return this; }
  };
}

function installDependencyStubs() {
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: { requireAuth: () => ({ uid: 'model-routing-user' }) }
  };
  const asyncNull = async () => null;
  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: {
      deductCredit: asyncNull,
      deductCreditByUser: asyncNull,
      getCreditsByCode: async () => ({ credits: 1 }),
      getFreeUsage: async () => ({ used: 0 }),
      getUserCredits: async () => 1,
      isMonthlyActive: async () => null,
      isMonthlyActiveByUserId: async () => ({ expires_at: '2099-01-01' }),
      saveChatHistory: asyncNull,
      saveUserChatHistory: asyncNull,
      trackFreeUsage: async () => ({ remaining: 1 }),
      trackFreeUsageByUser: async () => ({ used: 0 }),
      bumpFreeUsageByUser: asyncNull
    }
  };
}

test('stale PM2 pro environment cannot route text AI endpoints to the pro model', async () => {
  const previous = {
    AI_MODEL: process.env.AI_MODEL,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_API_URL: process.env.AI_API_URL,
    fetch: global.fetch,
    auth: require.cache[authPath],
    supabase: require.cache[supabasePath]
  };
  const payloads = [];

  try {
    process.env.AI_MODEL = 'deepseek-v4-pro';
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_API_URL = 'https://example.invalid/chat/completions';
    installDependencyStubs();
    global.fetch = async (_url, options) => {
      payloads.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"tip":"A safe flash response long enough for the endpoint."}' } }] }),
        text: async () => ''
      };
    };

    for (const name of ['ai-chat', 'divination', 'fortune']) {
      const endpointPath = require.resolve(path.join(root, 'api', name + '.js'));
      delete require.cache[endpointPath];
      const handler = require(endpointPath);
      const res = responseRecorder();
      const body = name === 'ai-chat'
        ? { question: 'Please analyze this chart.', free_mode: true, free_id: 'model-route' }
        : name === 'divination'
          ? { prompt: 'A sufficiently detailed divination prompt for routing verification only.' }
          : { dayGan: '甲', dayZhi: '子', label: 'test-chart-' + Date.now() };
      await handler({ method: 'POST', body, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
      assert.equal(res.statusCode, 200, `${name} should reach its upstream request path`);
      delete require.cache[endpointPath];
    }

    assert.equal(payloads.length, 3);
    assert.deepEqual(payloads.map(item => item.model), [
      'deepseek-v4-flash',
      'deepseek-v4-flash',
      'deepseek-v4-flash'
    ]);
    assert.deepEqual(payloads.map(item => item.thinking), [
      { type: 'disabled' },
      { type: 'disabled' },
      { type: 'disabled' }
    ]);
  } finally {
    if (previous.AI_MODEL === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = previous.AI_MODEL;
    if (previous.AI_API_KEY === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previous.AI_API_KEY;
    if (previous.AI_API_URL === undefined) delete process.env.AI_API_URL; else process.env.AI_API_URL = previous.AI_API_URL;
    global.fetch = previous.fetch;
    if (previous.auth) require.cache[authPath] = previous.auth; else delete require.cache[authPath];
    if (previous.supabase) require.cache[supabasePath] = previous.supabase; else delete require.cache[supabasePath];
  }
});
