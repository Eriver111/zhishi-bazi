const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const profilePath = path.join(root, 'profile.html');

function profileScript() {
  const profile = fs.readFileSync(profilePath, 'utf8');
  const script = profile.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(script, 'profile page must contain an inline renderer');
  return script[1];
}

async function renderProfile({ reports, reportStatus = 200, reportReject = false }) {
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
        return Promise.resolve(JSON.stringify([{ label: '既有排盘', params: 'year=1988' }]));
      },
      getUser() { return { id: 42 }; }
    },
    fetch(url) {
      fetches.push(String(url));
      if (url === '/api/auth/profile') {
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

test('purchased reports render escaped labels with their own normalized result URLs', async () => {
  const profile = fs.readFileSync(profilePath, 'utf8');
  assert.match(profile, /\/api\/reports/);
  assert.match(profile, /我的深度报告/);
  assert.match(profile, /查看报告/);
  assert.doesNotMatch(profile, /deleteReport/);

  const { html, fetches } = await renderProfile({
    reports: [
      {
        report_type: 'bazi',
        report_key: 'a'.repeat(64),
        label: '常规 <img src=x onerror=alert(1)> & \"报告\"',
        paid_at: '<script>2026-07-30',
        report_params: {
          year: 1990, month: 6, day: 15, hour: 8, clock: '08:30', minute: 30,
          gender: 'female', cal: 'solar', prov: '浙江', city: '杭州', dist: '西湖', ziHourRule: 'late'
        }
      },
      {
        report_type: 'bazi',
        report_key: 'b'.repeat(64),
        label: '四柱 <svg onload=alert(1)>',
        paid_at: '2026-07-31<unsafe>',
        report_params: {
          mode: 'pillars',
          pillars: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
          timing: 'known', gender: 'male', cal: 'lunar', city: '甲&乙'
        }
      }
    ]
  });

  assert.deepEqual(fetches.sort(), ['/api/auth/profile', '/api/reports']);
  assert.match(html, /常规 &lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;报告&quot;/);
  assert.match(html, /四柱 &lt;svg onload=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;20/);
  assert.match(html, /2026-07-31/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html, /<svg onload=alert\(1\)>/);

  const links = resultLinks(html);
  assert.equal(links.length, 2, 'both purchased reports must have their own result links');
  const reportLinks = links;

  const normal = new URL(`https://example.test${reportLinks[0]}`);
  assert.deepEqual(Object.fromEntries(normal.searchParams), {
    year: '1990', month: '6', day: '15', hour: '8', clock: '08:30', minute: '30',
    gender: 'female', cal: 'solar', prov: '浙江', city: '杭州', dist: '西湖', ziHourRule: 'late'
  });
  const pillars = new URL(`https://example.test${reportLinks[1]}`);
  assert.deepEqual(Object.fromEntries(pillars.searchParams), {
    yg: '甲', yz: '子', mg: '乙', mz: '丑', dg: '丙', dz: '寅', hg: '丁', hz: '卯',
    mode: 'pillars', timing: 'known', gender: 'male', cal: 'lunar', city: '甲&乙'
  });
});

test('a rejected report request leaves credits and saved charts visible', async () => {
  const { html, fetches } = await renderProfile({ reports: [], reportReject: true });

  assert.deepEqual(fetches.sort(), ['/api/auth/profile', '/api/reports']);
  assert.match(html, /积分余额/);
  assert.match(html, />3</);
  assert.match(html, /既有排盘/);
  assert.doesNotMatch(html, /加载失败：/);
});
