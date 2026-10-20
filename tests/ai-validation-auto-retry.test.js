'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {createHarness, response} = require('./helpers/ai-release-harness.cjs');
const chart = {type:'bazi',gender:'female',fourPillars:{
  year:{gan:'甲',zhi:'寅'},month:{gan:'丙',zhi:'寅'},day:{gan:'乙',zhi:'巳'},hour:{gan:'癸',zhi:'未'}
}};
const question = '请解释父母关系的依据。';
const wrong = '年柱、月柱都是甲，所以父母办事的方式一致，你需要按他们的方式处理所有事情。';
const good = '你的年干是甲，月干是丙，不能把两柱当成同一个天干。具体父母关系需要按各自实际位置的关系解释。';

const routes = [
  {name:'signed-in free', options:{}, body:{}, charged:1},
  {name:'anonymous free', options:{anonymous:true}, body:{}, charged:1},
  {name:'signed-in purchased credits', options:{}, body:{free_mode:false}, charged:1},
  {name:'redeemed code', options:{anonymous:true}, body:{free_mode:false,code:'synthetic-code'}, charged:1},
  {name:'monthly member', options:{monthly:true}, body:{free_mode:false}, charged:0},
  {name:'free exhausted to credits', options:{freeUsed:4}, body:{}, charged:1},
  {name:'free exhausted to membership', options:{freeUsed:4,monthly:true}, body:{}, charged:0}
];

for (const route of routes) {
  test(`${route.name}: failed validation automatically regenerates original question; one save and charge`, async () => {
    const h = createHarness(async (_, n) => response(n < 3 ? wrong : good), route.options);
    const before = JSON.stringify(chart);
    const result = await h.request(question, chart, route.body);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.reply, good);
    assert.equal(h.payloads.length, 3);
    assert.deepEqual(h.payloads[2], h.payloads[0], 'fresh generation uses the exact original prompt, not failed answers');
    assert.equal(h.payloads[2].messages.at(-1).content, question);
    assert.equal(JSON.stringify(chart), before);
    assert.deepEqual(h.counters, {charged:route.charged,saved:1});
    assert.equal(h.savedMessages.filter(m=>m.role==='user').length, 1);
    assert.equal(h.savedMessages.filter(m=>m.content===wrong).length, 0);
    assert.equal(h.events.filter(e=>e==='guard-begin').length, 1);
    assert.equal(h.events.filter(e=>e==='guard-release').length, 1);
    assert(h.events.indexOf('model-3') < h.events.indexOf('guard-release'));
    if (route.charged) assert(h.events.indexOf('model-3') < h.events.indexOf('charge'));
  });
  test(`${route.name}: repeated invalid answers stop after one extra generation; no charge or invalid save`, async () => {
    const h = createHarness(async () => response(wrong), route.options);
    const result = await h.request(question, chart, route.body);
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.code, 'REPLY_EVIDENCE_VALIDATION_FAILED');
    assert.equal(result.body.charged, false);
    assert.equal(result.body.retryable, true, 'manual retry remains available');
    assert.equal(h.payloads.length, 4, 'each of two generations has at most one internal correction');
    assert.deepEqual(h.counters, {charged:0,saved:0});
    assert.equal(h.savedMessages.filter(m=>m.role==='user').length, 1);
    assert.equal(h.events.filter(e=>e==='guard-begin').length, 1);
    assert.equal(h.events.filter(e=>e==='guard-release').length, 1);
  });
}

test('successful first reply and successful first correction never trigger the new retry', async () => {
  for (const needsCorrection of [false, true]) {
    const h = createHarness(async (_,n)=>response(needsCorrection && n===1 ? wrong : good));
    const result = await h.request(question, chart);
    assert.equal(result.statusCode, 200);
    assert.equal(h.payloads.length, needsCorrection ? 2 : 1);
    assert.deepEqual(h.counters,{charged:1,saved:1});
  }
});

test('retry can itself use one correction, and only the final validated answer is saved', async () => {
  const h = createHarness(async (_,n)=>response(n < 4 ? wrong : good));
  const result = await h.request(question, chart, {free_mode:false,qa_debug:true});
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.validation_retry_count, 1);
  assert.equal(h.payloads.length,4);
  assert.deepEqual(h.counters,{charged:1,saved:1});
  assert.equal(h.savedMessages.at(-1).content,good);
});

test('transport, upstream rate limit, empty reply, exhausted quota and concurrent request do not auto-retry', async () => {
  for (const respond of [
    async()=>{throw new Error('synthetic network unavailable');},
    async()=>({ok:false,status:429,text:async()=>'synthetic rate limit'}),
    async()=>response('')
  ]) {
    const h = createHarness(respond);
    const result = await h.request(question,chart);
    assert.equal(result.statusCode,500);
    assert.equal(h.payloads.length,1);
    assert.deepEqual(h.counters,{charged:0,saved:0});
  }
  for (const options of [{freeUsed:4,credits:0},{guardBlocked:true}]) {
    const h = createHarness(async()=>{throw Error('must not call provider');}, options);
    const result = await h.request(question,chart);
    assert([403,429].includes(result.statusCode));
    assert.equal(h.payloads.length,0);
    assert.deepEqual(h.counters,{charged:0,saved:0});
  }
});

test('transport failure during the additional generation stops immediately and does not charge', async () => {
  const h = createHarness(async (_,n)=>{
    if(n===3)throw new Error('synthetic retry network failure');
    return response(wrong);
  });
  const result=await h.request(question,chart);
  assert.equal(result.statusCode,500);
  assert.equal(h.payloads.length,3);
  assert.deepEqual(h.counters,{charged:0,saved:0});
  assert.equal(h.savedMessages.filter(m=>m.role==='user').length,1);
  assert.equal(h.events.filter(e=>e==='guard-release').length,1);
});

// A small boundary test covers error categories without inventing astrology
// fixtures. The endpoint tests above execute the actual validation and billing.
const source = fs.readFileSync(path.join(__dirname,'../api/ai-chat.js'),'utf8');
const retrySource = source.slice(source.indexOf('async function callAIWithValidationRetry('),source.indexOf('async function callAI('));
test('all terminal validation codes retry once with unchanged inputs; unrelated failures never retry', async () => {
  for (const code of ['REPLY_EVIDENCE_VALIDATION_FAILED','TIMING_VALIDATION_FAILED','YONGJI_VALIDATION_FAILED','HEPAN_VALIDATION_FAILED','AbortError','SOME_OTHER_FAILURE']) {
    const args=[question,chart,{year:2000},[{role:'user',content:'已有背景'}],'simple','pro',{},'原记忆','原反馈'];
    const calls=[], retryable=code.endsWith('_VALIDATION_FAILED');
    const scope={console:{log(){}},callAI:async(...received)=>{
      calls.push(received);
      if(calls.length===1)throw Object.assign(new Error(code),{code});
      received[6].warnings=[];return good;
    }};
    vm.runInNewContext(retrySource,scope);
    if(retryable) {
      assert.equal(await scope.callAIWithValidationRetry(...args),good);
      assert.equal(calls.length,2);
      for(const i of [0,1,2,3,4,5,7,8]) assert.equal(calls[1][i],args[i]);
      assert.notEqual(calls[0][6],calls[1][6], 'attempt metadata is isolated');
      assert.equal(args[6].validationRetryCount,1);
    } else {
      await assert.rejects(scope.callAIWithValidationRetry(...args),{code});
      assert.equal(calls.length,1);
    }
  }
});
