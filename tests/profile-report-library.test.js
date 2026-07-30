const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeBaziReportParams, makeReportKey } = require('../lib/report-identity.js');

const root = path.resolve(__dirname, '..');
const profilePath = path.join(root, 'profile.html');

function profileScript() {
  const profile = fs.readFileSync(profilePath, 'utf8');
  const script = profile.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(script, 'profile page must contain an inline renderer');
  return script[1];
}

async function renderProfile({ reports = [], reportStatus = 200, reportReject = false, profileReject = false, chartsReject = false }) {
  const content = { innerHTML: '' };
  const fetches = [];
  const context = {
    console,
    URLSearchParams,
    document: { getElementById(id) { return id === 'content' ? content : null; } },
    Auth: {
      onLogin() {},
      ready(fn) { fn(); },
      isLoggedIn() { return true; },
      getToken() { return 'account-token'; },
      getData(key) {
        assert.equal(key, 'saved_charts');
        if (chartsReject) return Promise.reject(new Error('saved charts unavailable'));
        return Promise.resolve(JSON.stringify([{ label: 'saved-chart', params: 'year=1988' }]));
      },
      getUser() { return { id: 42 }; }
    },
    fetch(url) {
      fetches.push(String(url));
      if (url === '/api/auth/profile') {
        if (profileReject) return Promise.reject(new Error('profile unavailable'));
        return Promise.resolve({ ok: true, json: async () => ({ credits: 3, history: [] }) });
      }
      if (url === '/api/reports') {
        if (reportReject) return Promise.reject(new Error('reports unavailable'));
        return Promise.resolve({ ok: reportStatus < 400, json: async () => ({ reports }) });
      }
      throw new Error(`unexpected request: ${url}`);
    },
    setTimeout() { return 1; },
    location: { href: '' },
    confirm() { return true; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(profileScript(), context);
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
  return { html: content.innerHTML, fetches };
}

function resultLinks(html) {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map(match => match[1].replace(/&amp;/g, '&'))
    .filter(href => href.startsWith('/result?'));
}

function readResultParams(search) {
  const source = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');
  const reader = source.match(/function getUrlParams\(\) \{[\s\S]*?\n\}/);
  assert.ok(reader, 'result page must expose getUrlParams');
  const context = { URLSearchParams, window: { location: { search }, PillarInput: null } };
  vm.createContext(context);
  vm.runInContext(`${reader[0]}; this.params = getUrlParams();`, context);
  return context.params;
}

test('purchased reports escape fields and restore normalized parameters in their own result URLs', async () => {
  const profile = fs.readFileSync(profilePath, 'utf8');
  assert.match(profile, /\/api\/reports/);
  assert.match(profile, /我的深度报告/);
  assert.match(profile, /查看报告/);
  assert.doesNotMatch(profile, /deleteReport/);

  const lunarNextDayDisabled = normalizeBaziReportParams({
    year: 1990, month: 6, day: 15, hour: 0, clock: 0, minute: 30,
    gender: 'female', cal: 'lunar', prov: 'Province', city: 'City', dist: 'District',
    zishi: '1', solar: '0'
  });
  const lunarReportKey = makeReportKey('bazi', lunarNextDayDisabled);
  const { html, fetches } = await renderProfile({
    reports: [
      {
        report_type: 'bazi', report_key: lunarReportKey,
        label: 'normal <img src=x onerror=alert(1)> & "report"',
        paid_at: '<script>2026-07-30', report_params: lunarNextDayDisabled
      },
      {
        report_type: 'bazi', report_key: 'b'.repeat(64),
        label: 'pillars <svg onload=alert(1)>', paid_at: '2026-07-31<unsafe>',
        report_params: {
          mode: 'pillars', pillars: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
          timing: 'unknown', gender: 'male', city: 'A&B'
        }
      }
    ]
  });

  assert.deepEqual(fetches.sort(), ['/api/auth/profile', '/api/reports']);
  assert.match(html, /normal &lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;report&quot;/);
  assert.match(html, /pillars &lt;svg onload=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;20/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html, /<svg onload=alert\(1\)>/);

  const links = resultLinks(html);
  assert.equal(links.length, 2, 'both purchased reports must have their own result links');
  const normal = new URL(`https://example.test${links[0]}`);
  assert.deepEqual(Object.fromEntries(normal.searchParams), {
    cal: 'lunar', zishi: '1', solar: '0', year: '1990', month: '6', day: '15', hour: '0',
    clock: '0', minute: '30', gender: 'female', prov: 'Province', city: 'City', dist: 'District'
  });
  assert.equal(makeReportKey('bazi', Object.fromEntries(normal.searchParams)), lunarReportKey);
  const resultParams = readResultParams(normal.search);
  assert.equal(resultParams.solar, '0');
  assert.equal(resultParams.zishi, '1');

  const pillars = new URL(`https://example.test${links[1]}`);
  assert.deepEqual(Object.fromEntries(pillars.searchParams), {
    yg: '甲', yz: '子', mg: '乙', mz: '丑', dg: '丙', dz: '寅', hg: '丁', hz: '卯',
    mode: 'pillars', timing: 'unknown', gender: 'male', city: 'A&B'
  });
});

test('a rejected report request leaves credits and saved charts visible', async () => {
  const { html, fetches } = await renderProfile({ reportReject: true });

  assert.deepEqual(fetches.sort(), ['/api/auth/profile', '/api/reports']);
  assert.match(html, /积分余额/);
  assert.match(html, />3</);
  assert.match(html, /saved-chart/);
  assert.doesNotMatch(html, /加载失败：/);
});

test('a normalized solar report maps enabled timing settings to result URL flags', async () => {
  const solarSameDayEnabled = normalizeBaziReportParams({
    year: 1990, month: 6, day: 15, hour: 0, clock: 0, minute: 30,
    gender: 'female', cal: 'solar', zishi: '0', solar: '1'
  });
  const { html } = await renderProfile({
    reports: [{ label: 'solar-report', paid_at: '2026-07-31', report_params: solarSameDayEnabled }]
  });

  const url = new URL(`https://example.test${resultLinks(html)[0]}`);
  assert.equal(url.searchParams.get('solar'), '1');
  assert.equal(url.searchParams.get('zishi'), '0');
  assert.equal(url.searchParams.get('cal'), null);
  assert.equal(makeReportKey('bazi', Object.fromEntries(url.searchParams)), makeReportKey('bazi', solarSameDayEnabled));
});

test('a rejected credits request leaves reports and saved charts visible', async () => {
  const { html } = await renderProfile({
    profileReject: true,
    reports: [{ label: 'paid-report', paid_at: '2026-07-31', report_params: { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' } }]
  });

  assert.match(html, /paid-report/);
  assert.match(html, /saved-chart/);
  assert.doesNotMatch(html, /加载失败：/);
});

test('a rejected saved charts request leaves credits and reports visible', async () => {
  const { html } = await renderProfile({
    chartsReject: true,
    reports: [{ label: 'paid-report', paid_at: '2026-07-31', report_params: { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' } }]
  });

  assert.match(html, /积分余额/);
  assert.match(html, />3</);
  assert.match(html, /paid-report/);
  assert.doesNotMatch(html, /加载失败：/);
});
