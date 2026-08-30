const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.style = {};
    this.textContent = '';
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    this.removed = true;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  querySelectorAll() { return []; }

  addEventListener() {}

  setAttribute(name, value) {
    this.attributes = this.attributes || {};
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    if (this.attributes) delete this.attributes[name];
  }
}

class FakeAbortController {
  constructor() { this.signal = {}; }
  abort() { this.signal.aborted = true; }
}

function createPaywallDocument() {
  const nodes = {};
  const register = element => {
    if (element.id) nodes[element.id] = element;
    return element;
  };
  const body = new FakeElement('body');
  const originalAppendChild = body.appendChild.bind(body);
  body.appendChild = child => {
    originalAppendChild(child);
    register(child);
    return child;
  };
  return {
    nodes,
    document: {
      body,
      getElementById(id) { return nodes[id] || null; },
      createElement(tagName) {
        const element = new FakeElement(tagName);
        Object.defineProperty(element, 'id', {
          get() { return this._id || ''; },
          set(value) { this._id = value; nodes[value] = this; }
        });
        return element;
      },
      register
    }
  };
}

function addReportSections(document) {
  const host = new FakeElement('div');
  ['thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection'].forEach(id => {
    const section = new FakeElement('section');
    section.id = id;
    section.offsetHeight = 160;
    section.classList = { remove() {}, add() {} };
    section.parentNode = host;
    document.register(section);
  });
  host.insertBefore = child => {
    child.parentNode = host;
    return child;
  };
}

function resultParamsFromSearch(search) {
  const source = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');
  const reader = source.match(/function getUrlParams\(\) \{[\s\S]*?\n\}/);
  assert.ok(reader, 'result page must expose URL parameter parsing');
  const context = { URLSearchParams, window: { location: { search }, PillarInput: null } };
  vm.createContext(context);
  vm.runInContext(`${reader[0]}; this.params = getUrlParams();`, context);
  return context.params;
}

test('AI credit products explicitly exclude deep-report access', () => {
  const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');
  const paywall = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const result = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');

  assert.match(pricing, /不会自动解锁深度报告/);
  assert.match(pricing, /AI积分包与深度报告相互独立/);
  assert.match(paywall, /支付 ¥9\.9 单独解锁报告/);
  assert.match(paywall, /不使用 AI 提问积分/);
  assert.doesNotMatch(paywall, /AI 会员也不包含本报告/);
  assert.match(result, /需单独购买深度报告/);
  assert.doesNotMatch(paywall, />积分解锁完整报告</);
  assert.doesNotMatch(result, /需使用积分兑换后查看完整报告/);
});

test('desktop report payment renders the gateway QR image instead of treating QR content as an image', async () => {
  const nodes = {
    qrModal: new FakeElement('div'),
    qrStatus: new FakeElement('p'),
    qrRetryBtn: new FakeElement('button'),
    qrContainer: new FakeElement('div')
  };
  const storage = new Map();
  let orderBody;
  const context = {
    console,
    URL,
    AbortController: FakeAbortController,
    navigator: { userAgent: 'Desktop Browser' },
    document: {
      getElementById(id) { return nodes[id] || null; },
      createElement(tagName) { return new FakeElement(tagName); }
    },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    fetch: async (_url, options) => {
      orderBody = JSON.parse(options.body);
      return { async json() {
        return {
          out_trade_no: 'bazi_example',
          report_key: 'example',
          pay_url: 'https://cashier.example/pay/1',
          qr_content: 'alipays://platformapi/startapp?saId=10000007',
          qr_image: 'https://zpayz.cn/qrcode/example.jpg',
          qrcode: 'alipays://platformapi/startapp?saId=10000007'
        };
      } };
    },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'payment.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  context.initPaywall({ year: 1990, month: 6, day: 15, hour: 8, gender: 'female' });
  context.startRP();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(nodes.qrContainer.children.length, 1);
  assert.equal(nodes.qrContainer.children[0].tagName, 'IMG');
  assert.equal(nodes.qrContainer.children[0].src, 'https://zpayz.cn/qrcode/example.jpg');
  assert.equal(nodes.qrStatus.textContent, '请扫码支付 ¥9.9（支付后自动解锁）');
  assert.deepEqual(orderBody, {
    report_params: { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' },
    token: '',
    amount: 9.9,
    description: '八字完整分析报告'
  });
});

test('purchased account access removes the report paywall before any new order is created', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  let accessCalls = 0;
  let orderCalls = 0;
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch: async url => {
      if (String(url).startsWith('/api/reports/access?')) {
        accessCalls++;
        return { ok: true, async json() { return { unlocked: true }; } };
      }
      orderCalls++;
      return { ok: true, async json() { return {}; } };
    },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  await context.initPaywall({ year: 1990, month: 6, day: 15, hour: 8, gender: 'female' });

  assert.equal(accessCalls, 1);
  assert.equal(orderCalls, 0);
  assert.ok(!nodes.rptPaywall || nodes.rptPaywall.removed);
});

test('locked report keeps paid copy out of the DOM and uses an opaque purchase surface', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  let paidRenderCalls = 0;
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    renderPaidContent() { paidRenderCalls++; },
    setInterval() { return 1; }, clearInterval() {},
    setTimeout() { return 1; }, clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  await context.initPaywall({ year: 2004, month: 8, day: 14, hour: 1, clock: 2, gender: 'male' });

  assert.equal(paidRenderCalls, 0);
  for (const id of ['thisYearSection', 'marriageSection', 'wealthSection', 'studySection', 'fortuneSection']) {
    assert.equal(nodes[id].style.display, 'none');
    assert.equal(nodes[id].attributes['aria-hidden'], 'true');
  }
  assert.ok(nodes.rptPaywall && !nodes.rptPaywall.removed);
  assert.match(nodes.rptPaywall.style.cssText, /background:#14110d/);
  assert.doesNotMatch(nodes.rptPaywall.style.cssText, /backdrop-filter|rgba\(/);
});

test('saved account token restores a purchased report while user verification is still pending', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  let accessCalls = 0;
  let authInitialized = false;
  let restoredToken = '';
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: {
      init() { authInitialized = true; restoredToken = 'saved-account-token'; },
      isLoggedIn() { return false; }, // /api/auth/verify 尚未恢复 _user
      getToken() { return restoredToken; }
    },
    fetch: async (url, options) => {
      assert.match(String(url), /^\/api\/reports\/access\?/);
      assert.equal(options.headers.Authorization, 'Bearer saved-account-token');
      accessCalls++;
      return { ok: true, async json() { return { unlocked: true, paid_at: '2026-08-23T12:00:00.000Z' }; } };
    },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  await context.initPaywall({ year: 2007, month: 2, day: 2, hour: 6, clock: 11, minute: 25, gender: 'male' });

  assert.equal(authInitialized, true);
  assert.equal(accessCalls, 1);
  assert.ok(!nodes.rptPaywall || nodes.rptPaywall.removed);
});

test('lunar result URL keeps calendar identity in the logged-in report access request', async () => {
  const { document } = createPaywallDocument();
  addReportSections(document);
  const params = resultParamsFromSearch('?year=1990&month=6&day=15&hour=8&gender=female&cal=lunar');
  let accessUrl = '';
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch: async url => {
      accessUrl = String(url);
      return { ok: true, async json() { return { unlocked: false }; } };
    },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  await context.initPaywall(params);

  const query = new URL(accessUrl, 'https://example.test').searchParams;
  assert.equal(params.cal, 'lunar');
  assert.equal(query.get('cal'), 'lunar');
  assert.equal(params.solar, '');
  assert.equal(query.get('solar'), '');
});

test('logged-in local guest unlock still checks account access before granting report access', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  const storage = new Map();
  let accessCalls = 0;
  const params = { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' };
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch: async url => {
      assert.match(String(url), /^\/api\/reports\/access\?/);
      accessCalls++;
      return { ok: true, async json() { return { unlocked: false }; } };
    },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);
  storage.set('bazi_rpt', JSON.stringify({ h: context.makeLocalReportKey(params), e: Date.now() + 60_000 }));

  await context.initPaywall(params);

  assert.equal(accessCalls, 1);
  assert.ok(nodes.rptPaywall && !nodes.rptPaywall.removed);
  assert.notEqual(nodes.downloadBanner && nodes.downloadBanner.style.display, 'flex');
});

test('account access verification shows a blocking gate while its request is pending', () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch() { return new Promise(() => {}); },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  context.initPaywall({ year: 1990, month: 6, day: 15, hour: 8, gender: 'female' });

  assert.ok(nodes.rptAccessGate && !nodes.rptAccessGate.removed);
  assert.equal(nodes.rptAccessGate.style.pointerEvents, 'auto');
  assert.ok(!nodes.rptPaywall);
});

test('rejected or timed-out account access replaces the gate with a locked paywall', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  const timeoutHandlers = [];
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch() { return new Promise(() => {}); },
    setTimeout(fn) { timeoutHandlers.push(fn); return timeoutHandlers.length; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  const restored = context.initPaywall({ year: 1990, month: 6, day: 15, hour: 8, gender: 'female' });
  assert.equal(timeoutHandlers.length, 1);
  timeoutHandlers[0]();
  await restored;

  assert.ok(nodes.rptAccessGate.removed);
  assert.ok(nodes.rptPaywall && !nodes.rptPaywall.removed);
  assert.notEqual(nodes.downloadBanner && nodes.downloadBanner.style.display, 'flex');
});

test('rejected account access replaces the gate with a locked paywall', async () => {
  const { document, nodes } = createPaywallDocument();
  addReportSections(document);
  const context = {
    console,
    URLSearchParams,
    navigator: { userAgent: 'Desktop Browser' },
    document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Auth: { isLoggedIn() { return true; }, getToken() { return 'account-token'; } },
    fetch: async () => { throw new Error('network unavailable'); },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  await context.initPaywall({ year: 1990, month: 6, day: 15, hour: 8, gender: 'female' });

  assert.ok(nodes.rptAccessGate.removed);
  assert.ok(nodes.rptPaywall && !nodes.rptPaywall.removed);
  assert.notEqual(nodes.downloadBanner && nodes.downloadBanner.style.display, 'flex');
});

test('guest unlocks for direct pillar charts remain isolated by all four pillars', () => {
  const storage = new Map();
  const context = {
    console,
    document: { getElementById() { return null; } },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  context.initPaywall({
    mode: 'pillars', gender: 'female',
    enteredPillars: { year: { gan: '甲', zhi: '子' }, month: { gan: '乙', zhi: '丑' }, day: { gan: '丙', zhi: '寅' }, hour: { gan: '丁', zhi: '卯' } }
  });
  context.sru();
  context.initPaywall({
    mode: 'pillars', gender: 'female',
    enteredPillars: { year: { gan: '戊', zhi: '辰' }, month: { gan: '己', zhi: '巳' }, day: { gan: '庚', zhi: '午' }, hour: { gan: '辛', zhi: '未' } }
  });

  assert.equal(context.iru(), false);
});

test('two simultaneous BaZi report orders keep independent pending recovery records', () => {
  const storage = new Map();
  const context = {
    console,
    document: { getElementById() { return null; } },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  const first = { year: 1990, month: 6, day: 15, hour: 8, clock: 16, gender: 'male' };
  const second = { year: 1992, month: 8, day: 20, hour: 3, clock: 6, gender: 'female' };
  context.initPaywall(first);
  const firstHash = context._baziHash;
  context.saveBaziPending({ oid: 'bazi_first', h: firstHash, k: 'first-key' });
  context.initPaywall(second);
  const secondHash = context._baziHash;
  context.saveBaziPending({ oid: 'bazi_second', h: secondHash, k: 'second-key' });

  assert.equal(Object.keys(JSON.parse(storage.get('rpt_orders_v2'))).length, 2);
  context.initPaywall(first);
  assert.equal(context.getBaziPending().oid, 'bazi_first');
  context.clearBaziPending(context.getBaziPending());
  context.initPaywall(second);
  assert.equal(context.getBaziPending().oid, 'bazi_second');
});

test('ordinary report local keys ignore absent and explicit default calendar fields', () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  const preAc92 = { year: 1990, month: 6, day: 15, hour: 8, gender: 'female', prov: '', minute: 0, clock: 0, solar: '', zishi: '', mode: '', timing: '', enteredPillars: null };
  assert.equal(context.makeLocalReportKey(preAc92), context.makeLocalReportKey({ ...preAc92, cal: '' }));
  assert.equal(context.makeLocalReportKey(preAc92), context.makeLocalReportKey({ ...preAc92, cal: 'solar' }));
});

test('guest ordinary reports restore old pipe keys but direct pillars never do', () => {
  const storage = new Map();
  const context = {
    console,
    document: { getElementById() { return null; } },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8'), context);

  const ordinary = { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' };
  storage.set('bazi_rpt', JSON.stringify({ h: '1990|6|15|8|female', e: Date.now() + 60_000 }));
  context.initPaywall(ordinary);
  assert.equal(context.iru(), true);

  context.initPaywall({
    ...ordinary, mode: 'pillars',
    enteredPillars: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' }
  });
  assert.equal(context.iru(), false);
});

test('hepan deep report creates a hepan order instead of falling through to the generic report branch', async () => {
  const nodes = {
    hepanQrModal: new FakeElement('div'),
    hepanQrStatus: new FakeElement('p'),
    hepanQrRetry: new FakeElement('button'),
    hepanQrContainer: new FakeElement('div')
  };
  let orderBody;
  const context = {
    console,
    URL,
    AbortController: FakeAbortController,
    alert() {},
    navigator: { userAgent: 'Desktop Browser' },
    document: {
      getElementById(id) { return nodes[id] || null; },
      createElement(tagName) { return new FakeElement(tagName); }
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    fetch: async (_url, options) => {
      orderBody = JSON.parse(options.body);
      return {
        async json() {
          return {
            out_trade_no: 'hepan_example',
            report_key: 'example',
            pay_url: 'https://cashier.example/pay/2',
            qr_content: 'alipays://platformapi/startapp?saId=10000007',
            qr_image: 'https://zpayz.cn/qrcode/hepan.jpg',
            qrcode: 'alipays://platformapi/startapp?saId=10000007'
          };
        }
      };
    },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'payment.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'hepan-paywall.js'), 'utf8'), context);

  context.initHePanPaywall(
    { dayGan: '甲', dayZhi: '子' },
    { dayGan: '乙', dayZhi: '丑' },
    '婚恋'
  );
  context.hstartPay();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(orderBody, {
    hash: '甲|子|乙|丑|婚恋',
    amount: 13.9,
    description: '合盘完整分析报告'
  });
  assert.equal(nodes.hepanQrContainer.children[0].src, 'https://zpayz.cn/qrcode/hepan.jpg');
});

test('payment pages load the shared QR resolver before their payment code', () => {
  const result = fs.readFileSync(path.join(root, 'result.html'), 'utf8');
  const hepan = fs.readFileSync(path.join(root, 'hepan-result.html'), 'utf8');
  const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');

  const resultResolver = result.indexOf('js/payment.js');
  const hepanResolver = hepan.indexOf('js/payment.js');
  const pricingResolver = pricing.indexOf('js/payment.js');
  assert.ok(resultResolver >= 0 && resultResolver < result.indexOf('js/paywall.js'));
  assert.ok(hepanResolver >= 0 && hepanResolver < hepan.indexOf('js/hepan-paywall.js'));
  assert.ok(pricingResolver >= 0 && pricingResolver < pricing.indexOf('function buyCredits'));
});

test('each deep-report paywall polls and unlocks only its own report type', () => {
  const bazi = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const hepan = fs.readFileSync(path.join(root, 'js', 'hepan-paywall.js'), 'utf8');

  assert.match(bazi, /expected_type=bazi/);
  assert.match(bazi, /d\.report_type==='bazi'/);
  assert.match(bazi, /d\.report_key===pending\.k/);
  assert.match(bazi, /pending\.h===_baziHash/);
  assert.match(bazi, /startsWith\('credit_'\)/);
  assert.match(bazi, /pending\.legacy&&d\.paid/);
  assert.match(hepan, /expected_type=hepan/);
  assert.match(hepan, /d\.report_type==='hepan'/);
  assert.match(hepan, /d\.report_key===pending\.k/);
  assert.match(hepan, /pending\.h===_hepanHash/);
  assert.match(hepan, /startsWith\('rpt_'\)/);
  assert.match(hepan, /pending\.legacy&&d\.report_key==='legacy'/);
});

test('service worker rolls the static cache so deployed payment scripts replace stale copies', async () => {
  const events = {};
  let openedCache = '';
  let cachedAssets = [];
  const context = {
    URL,
    fetch: async () => ({}),
    caches: {
      async open(name) {
        openedCache = name;
        return {
          async addAll(assets) {
            cachedAssets = Array.from(assets);
          }
        };
      },
      async keys() { return ['zhishi-v4']; },
      async delete() { return true; },
      async match() { return null; }
    },
    self: {
      addEventListener(name, handler) { events[name] = handler; },
      skipWaiting() {},
      clients: { claim() {} }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  let installPromise;
  events.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;

  assert.equal(openedCache, 'zhishi-v24');
  assert.ok(cachedAssets.includes('/js/payment.js'));
  assert.ok(cachedAssets.includes('/js/paywall.js?v=10'));
  assert.ok(cachedAssets.includes('/js/result.js?v=19'));
  assert.ok(cachedAssets.includes('/js/ai-chat-integration.js?v=20260830a'));
  assert.ok(cachedAssets.includes('/js/hepan-paywall.js?v=2'));
});

test('bazi paywall sends account credentials and supports account report recovery', () => {
  const paywallSource = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const resultSource = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');

  assert.match(paywallSource, /Authorization/);
  assert.match(paywallSource, /Auth\.getToken\(\)/);
  assert.match(paywallSource, /\/api\/reports\/access/);
  assert.match(paywallSource, /already_unlocked/);
  assert.match(paywallSource, /登录后购买可在个人中心长期查看/);
  assert.doesNotMatch(paywallSource, /report_year/);
  assert.match(resultSource, /delete\s+_params\.reportYear/);
  assert.match(resultSource, /initPaywall\(_reportIdentityParams \|\| _params\)/);
});
