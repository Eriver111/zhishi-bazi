const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function responseRecorder() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return body; },
    end() { return this; }
  };
}

test('chat identity is stable for one chart and separated by mode or pillars', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'chat-persistence.js'), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window, fetch: async () => { throw new Error('not used'); }, setTimeout });
  const first = {
    birthInfo: { gender: 'male' },
    fourPillars: {
      year: { gan: '甲', zhi: '申' }, month: { gan: '壬', zhi: '申' },
      day: { gan: '乙', zhi: '丑' }, hour: { gan: '丁', zhi: '丑' }
    }
  };
  const sameWithExtraFacts = JSON.parse(JSON.stringify(first));
  sameWithExtraFacts.currentLiuNian = { ganZhi: '丙午' };
  const another = JSON.parse(JSON.stringify(first));
  another.fourPillars.hour = { gan: '戊', zhi: '寅' };

  assert.equal(window.ChatPersistence.chartIdentity('bazi', first), window.ChatPersistence.chartIdentity('bazi', sameWithExtraFacts));
  assert.notEqual(window.ChatPersistence.chartIdentity('bazi', first), window.ChatPersistence.chartIdentity('bazi', another));
  assert.notEqual(window.ChatPersistence.chartIdentity('bazi', first), window.ChatPersistence.chartIdentity('hepan', first));
});

test('hepan identity includes both people, their order and relationship type', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'chat-persistence.js'), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window, fetch: async () => { throw new Error('not used'); }, setTimeout });
  const person = (name, gender, pillars) => ({
    name, gender,
    fourPillars: Object.fromEntries(['year', 'month', 'day', 'hour'].map((pos, i) => [pos, { gan: pillars[i][0], zhi: pillars[i][1] }]))
  });
  const p1 = person('甲', 'male', ['甲子', '乙丑', '丙寅', '丁卯']);
  const p2 = person('乙', 'female', ['庚午', '辛未', '壬申', '癸酉']);
  const base = { type: 'hepan', relationType: '情侣', person1: p1, person2: p2 };
  const sameWithAnalysis = { ...base, analysis: { score: 99 }, score: { total: 88 } };
  const changedSecond = { ...base, person2: person('乙', 'female', ['庚午', '辛未', '壬申', '甲戌']) };
  const swapped = { ...base, person1: p2, person2: p1 };

  assert.equal(window.ChatPersistence.chartIdentity('hepan', base), window.ChatPersistence.chartIdentity('hepan', sameWithAnalysis));
  assert.notEqual(window.ChatPersistence.chartIdentity('hepan', base), window.ChatPersistence.chartIdentity('hepan', changedSecond));
  assert.notEqual(window.ChatPersistence.chartIdentity('hepan', base), window.ChatPersistence.chartIdentity('hepan', swapped));
  assert.notEqual(window.ChatPersistence.chartIdentity('hepan', base), window.ChatPersistence.chartIdentity('hepan', { ...base, relationType: '朋友' }));
});

test('history endpoint requires login and returns the chart-scoped conversation', async () => {
  const endpointPath = require.resolve(path.join(root, 'api', 'chat-history.js'));
  const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
  const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));
  const previous = { endpoint: require.cache[endpointPath], auth: require.cache[authPath], supabase: require.cache[supabasePath] };
  try {
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { requireAuth: () => null } };
    require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: {} };
    delete require.cache[endpointPath];
    let handler = require(endpointPath);
    let res = responseRecorder();
    await handler({ method: 'GET', query: { mode: 'bazi', chart_key: 'bazi:one' } }, res);
    assert.equal(res.statusCode, 401);

    require.cache[authPath].exports.requireAuth = () => ({ uid: 7 });
    require.cache[supabasePath].exports.getOrCreateChatConversation = async (_uid, mode, key) => ({ id: 'conversation-1', mode, chart_key: key, title: '命理解读', memory_summary: '记忆' });
    require.cache[supabasePath].exports.getConversationMessages = async () => [{ role: 'user', content: '上一问' }, { role: 'assistant', content: '上一答' }];
    delete require.cache[endpointPath];
    handler = require(endpointPath);
    res = responseRecorder();
    await handler({ method: 'GET', query: { mode: 'bazi', chart_key: 'bazi:one' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.conversation_id, 'conversation-1');
    assert.equal(res.body.messages.length, 2);
    assert.equal(res.body.memory_ready, true);
  } finally {
    if (previous.endpoint) require.cache[endpointPath] = previous.endpoint; else delete require.cache[endpointPath];
    if (previous.auth) require.cache[authPath] = previous.auth; else delete require.cache[authPath];
    if (previous.supabase) require.cache[supabasePath] = previous.supabase; else delete require.cache[supabasePath];
  }
});

test('chat pages load shared persistence and database migration keeps payment schema untouched', () => {
  for (const file of ['ai-chat.html', 'zw-ai-chat.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /chat-persistence\.js\?v=[12]/);
    assert.match(html, /ChatPersistence\.decorate/);
    assert.match(html, /登录保存/);
  }
  const migration = fs.readFileSync(path.join(root, 'schema-ai-conversations.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_conversations/);
  assert.match(migration, /UNIQUE\(user_id, mode, chart_key\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS conversation_id/);
  assert.doesNotMatch(migration, /orders|payment|credits/i);
});
