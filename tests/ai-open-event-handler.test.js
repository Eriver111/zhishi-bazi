'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enrichRequestedYear } = require('../lib/ai-requested-year');

const source = fs.readFileSync(path.join(__dirname, '../api/ai-chat.js'), 'utf8');
const allowedLibraries = {
  '../lib/ziwei-context.js': require('../lib/ziwei-context'),
  '../lib/hepan-reply-scopes.js': require('../lib/hepan-reply-scopes'),
  '../lib/ai-conversation-evidence.js': require('../lib/ai-conversation-evidence'),
  '../lib/ai-chart-evidence.js': require('../lib/ai-chart-evidence'),
  '../lib/ai-annual-mechanisms.js': require('../lib/ai-annual-mechanisms'),
  '../lib/ai-requested-year.js': { enrichRequestedYear }
};

// Execute the entire production handler, message assembly, validation and
// response path. Only account/storage/model I/O are replaced. No production
// env, credentials, auth/datastore initialization or network can be reached.
async function outbound(question, chartData) {
  const payloads = [], noop = async () => null;
  const dependencies = {
    ...allowedLibraries,
    crypto: require('node:crypto'),
    '../lib/auth.js': { requireAuth: () => ({ uid: 'isolated-prompt-test' }) },
    '../lib/supabase.js': {
      trackFreeUsageByUser: async () => ({ used: 0 }),
      saveUserChatHistory: noop,
      bumpFreeUsageByUser: noop
    },
    '../lib/ai-abuse-guard.js': { beginAiRequest: () => ({ ok: true, release() {} }) }
  };
  const scope = {
    module: { exports: {} },
    process: { env: { AI_API_KEY: 'isolated-test-only', AI_API_URL: 'https://model.invalid/test' } },
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, AbortController,
    require(name) { assert.ok(Object.hasOwn(dependencies, name), 'unexpected dependency: ' + name); return dependencies[name]; },
    fetch: async (url, options) => {
      assert.equal(url, 'https://model.invalid/test');
      payloads.push(JSON.parse(options.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: {
        content: '学习与考试的影响需要结合当年的具体作用解释。这份回复仅用于隔离测试，验证年度证据如何送入模型；没有使用真实账号、外部模型服务或已经发生的事件标签。'
      } }] }) };
    }
  };
  vm.runInNewContext(source, scope, { filename: 'isolated-ai-chat.js', timeout: 5000 });
  const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return body; } };
  await scope.module.exports({ method: 'POST', body: { question, chartData, mode: 'simple', free_mode: true, free_id: 'isolated' }, headers: {} }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(payloads.length, 1, 'prompt checks use the actual initial upstream payload');
  return { text: payloads[0].messages.filter(m => m.role === 'system').map(m => m.content).join('\n'),
    messages: payloads[0].messages, api: scope.module.exports._test };
}

function synthetic() {
  const career = { domain: 'career', label: '事业工作', direction: '条件性', confidence: '中',
    hasIndependentAnnualTrigger: false, concreteOutcomeEstablished: false,
    evidence: ['原局与岁运的合成结构依据'], eventCandidate: '首位事件模板哨兵', scenarioCandidates: ['首位场景模板哨兵'] };
  const study = { domain: 'study', label: '学业考试', direction: '偏不利', confidence: '高',
    hasIndependentAnnualTrigger: true, concreteOutcomeEstablished: false,
    evidence: ['本年作用于月柱的合成依据'], eventCandidate: '学业事件模板哨兵', scenarioCandidates: ['明确学业提问场景哨兵'] };
  return { type: 'bazi', timingAdjudication: { requestedYear: { year: 2023,
    adjudication: { age: 36, primaryEvent: career, secondaryEvent: study, domainRecords: [career, study] } } } };
}

test('full handler open retrospective payload has one exact-year brief and no compulsory first-domain answer or templates', async () => {
  const { text, messages } = await outbound('回看2023年，最突出的具体事情是什么？', synthetic());
  assert.equal((text.match(/【岁运应事裁决数据】/g) || []).length, 1);
  assert.match(text, /本轮年份强制锚点.*2023年，年龄36岁/);
  assert.match(text, /同年其他领域依据：学业考试/);
  assert.match(text, /本年作用于月柱的合成依据/);
  assert.match(text, /不强制保留排序首位领域或其方向/);
  assert.match(text, /局部标记不代表全年没有结构作用/);
  assert.doesNotMatch(text, /首位事件模板哨兵|首位场景模板哨兵|学业事件模板哨兵|明确学业提问场景哨兵/);
  assert.doesNotMatch(text, /候选落点=|最可能落点=|本轮回答须保留|没有当年刑冲合害等独立结构触发|回答必须明确只能定主题/);
  assert.match(text, /成年人也可能在读、备考或考证/);
  assert.match(text, /父母的婚姻与本人的婚恋必须区分主体/);
  assert.equal(messages.at(-1).role, 'user');
});

test('full handler explicit-domain payload retains that domain, quality limits and evidence without importing unrelated templates', async () => {
  const { text, api } = await outbound('2023年学业考试如何？', synthetic());
  assert.match(text, /首要回答领域=学业考试/);
  assert.match(text, /本轮回答须保留所问领域“学业考试·偏不利”/);
  assert.match(text, /明确学业提问场景哨兵/);
  assert.doesNotMatch(text, /首位场景模板哨兵|首位事件模板哨兵|学业事件模板哨兵/);
  assert.ok(api.runReplyValidation(synthetic(), '2023年学业方向偏有利，录取更容易推进。', '2023年学业考试如何？')
    .some(w => w.startsWith('E8-应期方向冲突')));
});

test('full handler real requested-year recomputation keeps stem/path evidence when the top domain lacks a branch trigger', async () => {
  const chart = { type: 'bazi', birthInfo: { year: 1977 },
    fourPillars: Object.fromEntries(['year', 'month', 'day', 'hour'].map((p, i) => [p, { gan: ['丁', '己', '丁', '癸'][i], zhi: ['巳', '酉', '丑', '卯'][i] }])),
    daYun: { cycles: [{ gan: '乙', zhi: '巳', startYear: 2011, endYear: 2020 }] } };
  const before = JSON.stringify(chart), actual = enrichRequestedYear(chart, 2013).timingAdjudication.requestedYear;
  assert.equal(actual.adjudication.primaryEvent.hasIndependentAnnualTrigger, false);
  assert.ok(actual.annualStemInteractions.length > 0);
  const { text } = await outbound('回看2013年，当年最突出的事情是什么？', chart);
  assert.equal(JSON.stringify(chart), before);
  assert.match(text, /本年天干作用事实/);
  assert.match(text, /流年癸.*生大运乙/);
  assert.match(text, /【岁运补入后的节点通路】/);
  assert.match(text, /节点连续不等于有效/);
  assert.match(text, /这个局部标记不代表全年没有结构作用/);
  assert.doesNotMatch(text, /没有当年刑冲合害等独立结构触发|本轮回答须保留/);
  assert.equal((text.match(/【岁运補入后的节点通路】|【岁运补入后的节点通路】/g) || []).length, 1);
  assert.doesNotMatch(text, /"constraintsById"|"carrierEvidenceById"/);
});

test('open no-year ranking omits preset event text while preserving actual evidence and year identity', async () => {
  const row = { year: 2022, age: 30, domain: 'career', label: '事业工作', direction: '条件性', confidence: '中',
    daYunGan: '甲', daYunZhi: '子', liuNianGan: '壬', liuNianZhi: '寅',
    eventCandidate: '无年份泛化模板哨兵', evidence: ['保留该年度事实哨兵'] };
  const { text } = await outbound('早年发生过哪些明显的事情？', { type: 'bazi', timingAdjudication: { overall: [row] } });
  assert.match(text, /2022年/);
  assert.match(text, /保留该年度事实哨兵/);
  assert.doesNotMatch(text, /无年份泛化模板哨兵|优先回答排名第一的年份和主事件/);
});
