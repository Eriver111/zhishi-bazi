const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const origin = 'https://example.test';

function worker() {
  const events = {}, requests = [], stored = new Map(), deleted = [];
  let now = 100000, fail = false, responder;
  const cache = {
    match: async request => stored.get(typeof request === 'string' ? request : request.url),
    put: async (request, response) => stored.set(request.url, response),
    addAll: async () => {},
  };
  vm.runInNewContext(source, {
    URL, Response, Map, console, Date: { now: () => now },
    fetch: async (request, options) => {
      requests.push({ url: typeof request === 'string' ? request : request.url, options });
      if (fail) throw new Error('offline');
      return responder ? responder() : new Response('network-' + requests.length, { headers: { 'content-type': 'text/html' } });
    },
    caches: {
      open: async () => cache, match: cache.match,
      keys: async () => ['zhishi-v60', 'zhishi-v62', 'another-app'],
      delete: async key => deleted.push(key),
    },
    self: {
      location: { origin }, clients: { claim() {} }, skipWaiting() {},
      addEventListener: (name, handler) => { events[name] = handler; },
    },
  });
  async function dispatch(name, fields) {
    const tasks = []; let result;
    events[name]({ ...fields, waitUntil: p => tasks.push(p), respondWith: p => { result = p; } });
    const response = await result;
    await Promise.all(tasks);
    return response;
  }
  return {
    requests, stored, deleted,
    advance: ms => { now += ms; }, offline: () => { fail = true; },
    respond: fn => { responder = fn; },
    warm: (url, client = origin + '/') => dispatch('message', { data: { type: 'WARM_PUBLIC_PAGE', url }, source: { url: client } }),
    get: (url, extra = {}) => dispatch('fetch', { request: { url: new URL(url, origin).href, method: 'GET', mode: 'navigate', ...extra } }),
    activate: () => dispatch('activate', {}),
  };
}

test('prewarming accepts only public parameter-free documents from same-origin clients', async () => {
  const sw = worker();
  for (const url of ['/profile', '/archives', '/pricing', '/result', '/hepan-result', '/api/auth/me', '/paipan?year=2000', '/paipan#form', 'https://other.test/paipan']) await sw.warm(url);
  await sw.warm('/paipan', 'https://other.test/');
  assert.equal(sw.requests.length, 0);
  await sw.warm('/paipan');
  assert.equal(sw.requests.length, 1);
  assert.deepEqual(sw.requests[0].options && { ...sw.requests[0].options }, { credentials: 'omit', cache: 'no-store' });
  assert.equal(sw.stored.size, 0, 'HTML must never enter persistent cache storage');
});

test('a warmed document is consumed once and expires after 30 seconds', async () => {
  const sw = worker();
  await sw.warm('/paipan');
  assert.equal(await (await sw.get('/paipan')).text(), 'network-1');
  assert.equal(sw.requests.length, 1);
  assert.equal(await (await sw.get('/paipan')).text(), 'network-2');
  await sw.warm('/hepan');
  sw.advance(30000);
  assert.equal(await (await sw.get('/hepan')).text(), 'network-4');
});

test('warming keeps at most three documents and never serves them to parameterized requests', async () => {
  const sw = worker();
  for (const url of ['/paipan', '/hepan', '/ziwei', '/liuyao']) await sw.warm(url);
  await sw.get('/paipan');
  assert.equal(sw.requests.length, 5, 'oldest warm document was evicted');
  await sw.get('/hepan?person=synthetic');
  assert.equal(sw.requests.length, 6);
  await sw.get('/hepan');
  assert.equal(sw.requests.length, 6, 'parameterized request did not consume public warm document');
});

test('warming limits concurrency, deduplicates requests and recovers after failure', async () => {
  const sw = worker(), release = [];
  sw.respond(() => new Promise(resolve => release.push(resolve)));
  const a = sw.warm('/paipan'), b = sw.warm('/hepan');
  await sw.warm('/paipan'); await sw.warm('/ziwei');
  assert.equal(sw.requests.length, 2);
  release.forEach(resolve => resolve(new Response('ok', { headers: { 'content-type': 'text/html' } })));
  await Promise.all([a, b]);
  sw.respond(() => { throw new Error('temporary failure'); });
  await sw.warm('/ziwei');
  sw.respond(() => new Response('recovered'));
  assert.equal(await (await sw.get('/ziwei')).text(), 'recovered');
});

test('failed, redirected or non-HTML prefetches cannot replace navigation', async () => {
  for (const response of [new Response('bad', { status: 500 }), new Response('{}', { headers: { 'content-type': 'application/json' } }), { ok: true, redirected: true }]) {
    const sw = worker();
    sw.respond(() => response);
    await sw.warm('/paipan');
    sw.respond(() => new Response('fresh'));
    assert.equal(await (await sw.get('/paipan')).text(), 'fresh');
    assert.equal(sw.requests.length, 2);
  }
});

test('a quick tap reuses its in-flight prefetch instead of starting a competing request', async () => {
  const sw = worker(); let release;
  sw.respond(() => new Promise(resolve => { release = resolve; }));
  const warming = sw.warm('/paipan');
  const navigation = sw.get('/paipan');
  assert.equal(sw.requests.length, 1);
  release(new Response('one request', { headers: { 'content-type': 'text/html' } }));
  await warming;
  assert.equal(await (await navigation).text(), 'one request');
  assert.equal(sw.requests.length, 1);
});

test('API calls, mutations and external requests bypass the worker', async () => {
  const sw = worker();
  assert.equal(await sw.get('/api/create-order'), undefined);
  assert.equal(await sw.get('/paipan', { method: 'POST' }), undefined);
  assert.equal(await sw.get('https://other.test/paipan'), undefined);
  assert.equal(sw.requests.length, 0);
});

test('only exact versioned shell resources use cache-first; business scripts remain network-first', async () => {
  const sw = worker();
  const shell = '/js/mobile-app-shell.js?v=11';
  sw.stored.set(origin + shell, new Response('shell-cache'));
  assert.equal(await (await sw.get(shell, { mode: 'cors' })).text(), 'shell-cache');
  assert.equal(sw.requests.length, 0);
  for (const url of ['/js/bazi.js?v=9', '/js/payment.js', '/js/mobile-app-shell.js?v=12']) {
    sw.stored.set(origin + url, new Response('stale'));
    assert.match(await (await sw.get(url, { mode: 'cors' })).text(), /^network-/);
  }
  sw.offline();
  assert.match(await (await sw.get('/js/payment.js', { mode: 'cors' })).text(), /^network-/);
  assert.equal((await sw.get('/js/missing.js', { mode: 'cors' })).type, 'error');
});

test('activation removes only obsolete caches owned by this site', async () => {
  const sw = worker(); await sw.activate();
  assert.deepEqual(sw.deleted, ['zhishi-v60']);
});
