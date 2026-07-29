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
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener() {}
}

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
    setTimeout(fn) { fn(); return 1; }
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
    year: 1990,
    month: 6,
    day: 15,
    hour: 8,
    gender: 'female',
    amount: 9.9,
    description: '八字完整分析报告'
  });
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
    clearInterval() {}
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

  assert.equal(openedCache, 'zhishi-v5');
  assert.ok(cachedAssets.includes('/js/payment.js'));
  assert.ok(cachedAssets.includes('/js/paywall.js'));
  assert.ok(cachedAssets.includes('/js/hepan-paywall.js'));
});
