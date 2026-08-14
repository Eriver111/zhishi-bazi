const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));
const endpointPath = require.resolve(path.join(root, 'api', 'divination.js'));

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

test('divination system prompt treats the computed chart as authoritative and uses real response-time rules', async () => {
  const previous = {
    fetch: global.fetch,
    auth: require.cache[authPath],
    supabase: require.cache[supabasePath],
    endpoint: require.cache[endpointPath]
  };
  let upstream;

  try {
    require.cache[authPath] = {
      id: authPath, filename: authPath, loaded: true,
      exports: { requireAuth: () => ({ uid: 'liuyao-professional-user' }) }
    };
    const asyncNull = async () => null;
    require.cache[supabasePath] = {
      id: supabasePath, filename: supabasePath, loaded: true,
      exports: {
        deductCredit: asyncNull,
        deductCreditByUser: asyncNull,
        getUserCredits: async () => 1,
        isMonthlyActive: async () => null,
        isMonthlyActiveByUserId: async () => ({ expires_at: '2099-01-01' }),
        saveUserChatHistory: asyncNull,
        trackFreeUsageByUser: async () => ({ used: 0 }),
        bumpFreeUsageByUser: asyncNull
      }
    };
    global.fetch = async (_url, options) => {
      upstream = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '这是一段足够长的六爻测试解读内容。' } }] }),
        text: async () => ''
      };
    };

    delete require.cache[endpointPath];
    const handler = require(endpointPath);
    const res = responseRecorder();
    await handler({
      method: 'POST',
      body: { prompt: '【排盘专业数据】本卦天风姤，月建丙申，日辰庚申，旬空子丑。', divType: 'liuyao' },
      headers: {}
    }, res);

    assert.equal(res.statusCode, 200);
    const system = upstream.messages[0].content;
    assert.match(system, /排盘专业数据.*最高优先级/);
    assert.match(system, /禁止.*自行改卦/);
    assert.match(system, /出旬.*冲空.*填实/);
    assert.match(system, /不得只把地支机械转成月份/);
    assert.doesNotMatch(system, /到了对应的月份才会发力/);
  } finally {
    global.fetch = previous.fetch;
    if (previous.auth) require.cache[authPath] = previous.auth; else delete require.cache[authPath];
    if (previous.supabase) require.cache[supabasePath] = previous.supabase; else delete require.cache[supabasePath];
    if (previous.endpoint) require.cache[endpointPath] = previous.endpoint; else delete require.cache[endpointPath];
  }
});
