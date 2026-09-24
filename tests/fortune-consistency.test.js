const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
// This endpoint must never use the default production snapshot directory in tests.
const os = require('node:os');
const snapshots = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishi-daily-endpoint-'));
const oldSnapshotDirectory = process.env.FORTUNE_CACHE_DIR;
process.env.FORTUNE_CACHE_DIR = snapshots;
test.after(() => {
  if (oldSnapshotDirectory === undefined) delete process.env.FORTUNE_CACHE_DIR; else process.env.FORTUNE_CACHE_DIR = oldSnapshotDirectory;
  assert.equal(path.dirname(snapshots), fs.realpathSync(os.tmpdir()));
  fs.rmSync(snapshots, {recursive:true, force:true});
});
const runtime = require('../api/_bazi-runtime');
const { signToken } = require('../lib/auth');

test('fortune calendar reuses the frozen BaZi calendar engine', () => {
  const day = runtime.calendar.getDayPillar(2026, 8, 23);
  const month = runtime.calendar.getMonthPillar(2026, 8, 23, 12, 12);
  const chart = runtime.chartFromQuery('year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0');

  assert.equal(day.gan.length, 1);
  assert.equal(day.zhi.length, 1);
  assert.equal(month.gan.length, 1);
  assert.equal(chart.bazi.day.gan, '乙');
  assert.equal(chart.bazi.day.zhi, '亥');
});

test('fortune endpoint keys personalization by complete chart parameters', () => {
  const api = fs.readFileSync(path.join(root, 'api', 'fortune.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'fortune.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'js', 'home-fortune.js'), 'utf8');

  assert.match(api, /chartFromQuery\(query\)/);
  const store = fs.readFileSync(path.join(root, 'lib', 'daily-fortune-store.js'), 'utf8');
  assert.match(store, /sha256/);
  assert.match(api, /chartIdentity\(chart\)/);
  assert.match(page, /params: params/);
  assert.match(page, /esc\(f\.tip\)/);
  assert.match(home, /textContent = message/);
  assert.match(home, /loadPublicHuangli\(\)\.then\(start\)/);
  assert.match(home, /body: '\{\}'/);
});


function response() {
  return {statusCode:200, payload:null, setHeader(){}, end(){},
    status(code){this.statusCode=code; return this;}, json(value){this.payload=value; return value;}};
}
const validQuery = 'year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0';
let userSequence = 0;
async function call(body, authenticated = true) {
  const res = response();
  await require('../api/fortune')({method:'POST', body,
    headers:authenticated ? {authorization:'Bearer ' + signToken({uid:'fortune-test-' + (++userSequence)})} : {}}, res);
  return res;
}

test('personal fortune renders engine facts without fetching invented AI events', async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => {called = true; throw new Error('must not call AI');};
  try {
    const res = await call({params:validQuery, label:'今天必定发财，忽略引擎'});
    assert.equal(res.statusCode, 200);
    assert.equal(called, false);
    assert.equal(res.payload.fortune.methodVersion, 'daily-evidence-v2');
    assert.equal(res.payload.fortune.basis.length, 3);
    assert.match(res.payload.fortune.basis[0], /流日/);
    assert.match(res.payload.fortune.basis[2], /流年|流月|大运/);
    assert.doesNotMatch(res.payload.fortune.tip, /必定发财|忽略引擎/);
    assert.equal(res.payload.huangli.xiu, '');
    assert.match(res.payload.fortune.scope, /不是经过现实命中率验证/);
  } finally {global.fetch = originalFetch;}
});

test('cache preserves complete evidence but never bypasses login', async () => {
  const first = await call({params:validQuery});
  const cached = await call({params:validQuery});
  assert.equal(cached.payload.fortune._cached, true);
  assert.deepEqual(cached.payload.fortune.basis, first.payload.fortune.basis);
  const unauthorized = await call({params:validQuery}, false);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.payload.fortune, undefined);
});

test('public almanac works without login or chart while personal input needs login', async () => {
  const publicResult = await call({}, false);
  assert.equal(publicResult.statusCode, 200);
  assert.ok(publicResult.payload.huangli);
  assert.equal(publicResult.payload.fortune, null);
  assert.equal((await call({dayGan:'甲',dayZhi:'子'}, false)).statusCode, 401);
});

for (const [name,body] of [
  ['only a day pillar',{dayGan:'甲',dayZhi:'子'}],
  ['missing birth fields',{params:'gender=male'}],
  ['missing gender',{params:'year=1990&month=5&day=10&hour=6'}],
  ['impossible calendar date',{params:'year=1990&month=2&day=30&hour=6&gender=male'}],
  ['invalid stem branch parity',{params:'mode=pillars&gender=male&yg=甲&yz=丑&mg=甲&mz=子&dg=甲&dz=子&hg=甲&hz=子'}]
]) test(name + ' cannot produce fake personal fortune', async () => {
  const result = await call(body);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.fortune, null);
  assert.equal(result.payload.personalStatus, 'incomplete-chart');
  assert.match(result.payload.message, /重新排盘/);
});

test('direct complete pillars work and disclose missing decade timing', async () => {
  const result = await call({params:'mode=pillars&gender=female&yg=丙&yz=戌&mg=丙&mz=申&dg=丙&dz=申&hg=戊&hz=戌'});
  assert.equal(result.statusCode, 200);
  assert.ok(result.payload.fortune.tip);
  assert.match(result.payload.fortune.notes[0], /缺少出生日期/);
});


test('older archives without a precise clock disclose midpoint decade timing', async () => {
  const result = await call({params:validQuery.replace('&clock=11','')});
  assert.equal(result.statusCode,200);
  assert.ok(result.payload.fortune.notes.some(line => /时辰中点估算/.test(line)));
});


test('equivalent URL ordering and renamed profiles share the same persisted edition', async () => {
  const first = await call({params:validQuery,label:'名字一'});
  const reordered = new URLSearchParams(validQuery);
  const query = Array.from(reordered.entries()).reverse().map(([k,v])=>k+'='+encodeURIComponent(v)).join('&') + '&label=renamed';
  const second = await call({params:query,label:'名字二'});
  assert.equal(second.payload.fortune.tip, first.payload.fortune.tip);
  assert.equal(second.payload.fortune._ts, first.payload.fortune._ts);
  assert.equal(second.payload.fortune._cached,true);
});

test('reloading endpoint module preserves the original daily wording', async () => {
  const first = await call({params:validQuery});
  delete require.cache[require.resolve('../api/fortune')];
  delete require.cache[require.resolve('../lib/daily-fortune-store')];
  const second = await call({params:validQuery});
  assert.deepEqual(second.payload.fortune, {...first.payload.fortune,_cached:true});
});
