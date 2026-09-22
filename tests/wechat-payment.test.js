const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const gateway = require('../lib/xunhu-payment.js');
const channels = require('../lib/payment-channels.js');
const PaymentFlow = require('../js/payment.js');
const env = { XUNHU_APPID: 'fixture-app', XUNHU_APPSECRET: 'fixture-secret',
  XUNHU_API_URL: 'https://gateway.example/payment/do.html', SITE_URL: 'https://site.example',
  PAY_PID: 'legacy-fixture', PAY_KEY: 'legacy-secret', TOKEN_SECRET: 'fixture-token' };
const id = 'wx_' + '1'.repeat(24);
const order = { order_id: id, provider: 'xunhu', payment_method: 'wechat', provider_appid: env.XUNHU_APPID,
  kind: 'credits', amount_cents: 990, status: 'pending', return_path: '/pricing?paid=' + id };

// Recursively run application modules in a closed VM. Real auth, database, env and network never load.
function app(overrides = {}) {
  const events = [], orders = new Map();
  const store = {
    create: async o => { events.push('save'); orders.set(o.order_id, o); return o; },
    get: async oid => { events.push('get'); return orders.get(oid) || null; },
    fulfill: async (...args) => { events.push(['fulfill', ...args]); },
    entitlement: async () => ({ code: 'FIXTURE8', credits: 10, _type: 'credits' }),
    ...overrides.store
  };
  const effectiveEnv = { ...env, ...overrides.env };
  const modules = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (modules.has(file)) return modules.get(file).exports;
    const mod = { exports: {} }; modules.set(file, mod);
    const context = { module: mod, Buffer, URL, URLSearchParams, AbortSignal,
      process: { env: effectiveEnv }, console: { error() {}, log() {} },
      fetch: async (url, options) => {
        events.push('gateway');
        if (overrides.fetch) return overrides.fetch(url, options);
        const body = { errcode: 0, url: 'https://cashier.example/mobile', url_qrcode: 'https://cashier.example/qr.png' };
        body.hash = gateway.sign(body, env.XUNHU_APPSECRET);
        return { ok: true, json: async () => body };
      },
      require(dep) {
        if (dep === 'crypto') return crypto;
        if (/\/supabase\.js$/.test(dep)) return { hasPaidReport: async () => false, ...overrides.database };
        if (/\/auth\.js$/.test(dep)) return { verifyToken: token => token === 'valid-fixture' ? { uid: 123 } : null };
        if (/\/payment-order-store\.js$/.test(dep)) return store;
        if (dep.startsWith('.')) return load(path.resolve(path.dirname(file), dep));
        throw new Error('Unexpected dependency: ' + dep);
      }
    };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    return mod.exports;
  }
  async function call(name, body = {}, method = 'POST', query = {}) {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
      send(body) { this.body = body; return this; }, end() { return this; } };
    await load('api/' + name + '.js')({ method, body, query, headers: { referer: 'https://site.example/hepan-result.html?a=fixture', ...overrides.headers } }, res);
    return res;
  }
  return { call, events, orders };
}
function notification(fields = {}) {
  const n = { appid: env.XUNHU_APPID, trade_order_id: id, total_fee: '9.90', status: 'OD', open_order_id: 'tx_fixture', ...fields };
  n.hash = gateway.sign(n, env.XUNHU_APPSECRET); return n;
}

test('legacy credentials alone cannot re-enable Alipay; dual channels require opt-in', () => {
  assert.deepEqual(channels.availableMethods({ PAY_PID: 'p', PAY_KEY: 'k' }), []);
  assert.deepEqual(channels.availableMethods(env).map(m => m.id), ['wechat']);
  assert.deepEqual(channels.availableMethods({ ...env, PAY_ALIPAY_ENABLED: 'true' }).map(m => m.id), ['wechat', 'alipay']);
  assert.throws(() => channels.selectMethod('alipay', env));
  assert.equal(channels.selectMethod('', env), 'wechat');
});

test('signature sorts ASCII keys, keeps zero, excludes empty/hash, and uses raw UTF-8', () => {
  const p = { z: '', time: 0, title: '知时 + A&B', appid: 'fixture', hash: 'ignored', empty: null };
  const expected = crypto.createHash('md5').update('appid=fixture&time=0&title=知时 + A&Bsecret').digest('hex');
  assert.equal(gateway.sign(p, 'secret'), expected);
  assert.equal(gateway.verify({ ...p, hash: expected }, 'secret'), true);
  assert.equal(gateway.verify({ ...p, title: 'tampered', hash: expected }, 'secret'), false);
  assert.equal(gateway.verify({ hash: expected, nested: {} }, 'secret'), false);
  assert.equal(gateway.verify({ hash: expected }, ''), false);
});

test('money rejects ambiguous or rounded values', () => {
  for (const v of ['9.901', '9e0', ' 9.90', null, {}, '-9.90']) assert.equal(gateway.moneyCents(v), null);
  assert.equal(gateway.moneyCents('9.9'), 990);
  assert.equal(gateway.moneyCents('9.90'), 990);
});

test('payment-methods exposes only display choices and disables new Alipay orders', async () => {
  const a = app(); const res = await a.call('payment-methods', {}, 'GET');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(JSON.stringify(res.body), JSON.stringify({ methods: [{id:'wechat',label:'微信支付',in_app_supported:false}], default_method:'wechat' }));
  const blocked = await a.call('create-order', { mode: 'credit_10', payment_method: 'alipay' });
  assert.equal(blocked.code, 503); assert.deepEqual(a.events, []);
});

test('ordinary channel rejects in-WeChat creation before storage or gateway; capability requires server opt-in',async()=>{
  const a=app({headers:{'user-agent':'iPhone MicroMessenger/8.0'}});
  const res=await a.call('create-order',{mode:'credit_10',in_app_supported:true});
  assert.equal(res.code,409);assert.equal(res.body.code,'EXTERNAL_BROWSER_REQUIRED');assert.deepEqual(a.events,[]);
  const b=app({headers:{'user-agent':'iPhone MicroMessenger/8.0'},env:{XUNHU_WECHAT_IN_APP_ENABLED:'true'}});
  assert.equal((await b.call('payment-methods',{},'GET')).body.methods[0].in_app_supported,true);
  assert.equal((await b.call('create-order',{mode:'credit_10'})).code,200);
});

test('WeChat frontend explains external-browser flow without creating an order',async()=>{
  const urls=[];
  const context={module:{exports:{}},navigator:{userAgent:'iPhone MicroMessenger/8.0'},AbortController,setTimeout,clearTimeout,
    fetch:async url=>{urls.push(url);return {ok:true,json:async()=>({methods:[{id:'wechat',in_app_supported:false}]})};}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/payment.js'),'utf8'),context);
  await assert.rejects(context.module.exports.createOrder({mode:'credit_3'}),/在浏览器打开/);
  assert.deepEqual(urls,['/api/payment-methods']);
});

for (const [mode, cents, kind, count] of [['credit_3',490,'credits',3],['credit_10',990,'credits',10],
  ['credit_20',1490,'credits',20],['credit_pack',990,'credits',10],['monthly',2990,'monthly',30],['ai-chat',500,'credits',5]]) {
  test(mode + ' saves server-owned price/user/product before signed JSON gateway request', async () => {
    const a = app({ env: { PAY_PID: '', PAY_KEY: '' }, fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(url, env.XUNHU_API_URL); assert.match(options.headers['Content-Type'], /application\/json/);
      assert.equal(body.version, '1.1'); assert.equal(body.total_fee, (cents/100).toFixed(2));
      assert.ok(body.trade_order_id.length <= 32); assert.equal(gateway.verify(body, env.XUNHU_APPSECRET), true);
      assert.equal(body.notify_url, 'https://site.example/api/payment-notify');
      assert.ok(body.return_url.length <= 128); assert.doesNotMatch(body.title, /injected/);
      const data = {errcode:0,url:'https://cashier.example/mobile',url_qrcode:'https://cashier.example/qr.png'};
      data.hash=gateway.sign(data,env.XUNHU_APPSECRET); return {ok:true,json:async()=>data};
    }});
    const res = await a.call('create-order', { mode, amount:0.01, money:0.01, name:'injected', user_id:999, token:'valid-fixture' });
    assert.equal(res.code,200); assert.deepEqual(a.events,['save','gateway']);
    const saved = a.orders.get(res.body.out_trade_no);
    assert.equal(saved.amount_cents,cents); assert.equal(saved.user_id,123); assert.equal(saved.kind,kind);
    assert.equal(kind==='monthly'?saved.days:saved.credits,count); assert.equal(res.body.payment_method,'wechat');
    assert.equal(PaymentFlow.resolvePayment(res.body).qrImageUrl,'https://cashier.example/qr.png');
  });
}

test('both report types retain their identity and return address', async () => {
  const a=app();
  const b=await a.call('create-order',{year:2000,month:6,day:15,hour:6,gender:'female',amount:0.01});
  assert.equal(b.code,200); const bo=a.orders.get(b.body.out_trade_no);
  assert.equal(bo.report_type,'bazi'); assert.equal(bo.amount_cents,990); assert.match(bo.return_path,/^\/result\.html\?/);
  const h=await a.call('create-order',{hash:'synthetic-chart-pair',amount:0.01});
  const ho=a.orders.get(h.body.out_trade_no); assert.equal(ho.report_type,'hepan'); assert.equal(ho.amount_cents,1390);
  assert.equal(ho.return_path,'/hepan-result.html?a=fixture'); assert.notEqual(bo.report_key,ho.report_key);
});

test('storage failure stops gateway creation and conceals internal errors', async () => {
  const a=app({store:{create:async()=>{throw new Error('fixture-private-detail');}}});
  const res=await a.call('create-order',{mode:'credit_10'});
  assert.equal(res.code,500); assert.doesNotMatch(JSON.stringify(res.body),/fixture|secret/); assert.deepEqual(a.events,[]);
});

test('unsigned or tampered gateway responses cannot yield a payable URL', async () => {
  const a=app({fetch:async()=>({ok:true,json:async()=>({errcode:0,url:'https://bad.example',hash:'0'.repeat(32)})})});
  const res=await a.call('create-order',{mode:'credit_10'}); assert.equal(res.code,500); assert.equal(res.body.pay_url,undefined);
});

test('callback grants only after exact signed order/app/amount/status validation', async () => {
  for (const fields of [{total_fee:'0.01'}, {appid:'wrong'}, {trade_order_id:'wx_'+'2'.repeat(24)}, {hash:'0'.repeat(32)}]) {
    const a=app();a.orders.set(id,order); const n=notification(fields); if(fields.hash)n.hash=fields.hash;
    const res=await a.call('payment-notify',n); assert.equal(res.code,400);
    assert.equal(a.events.some(e=>Array.isArray(e)&&e[0]==='fulfill'),false);
  }
  const a=app();a.orders.set(id,order);const res=await a.call('payment-notify',notification());
  assert.equal(res.body,'success');assert.deepEqual(a.events[1],['fulfill',id,'fixture-app',990,'tx_fixture']);
});

test('refund/nonpaid messages do not grant, and fulfillment failures are retried by gateway',async()=>{
  for(const status of ['CD','RD','UD','WP']){
    const a=app();a.orders.set(id,order);assert.equal((await a.call('payment-notify',notification({status}))).body,'success');
    assert.deepEqual(a.events,['get']);
  }
  const a=app({store:{fulfill:async()=>{throw new Error('DB unavailable');}}});a.orders.set(id,order);
  const res=await a.call('payment-notify',notification());assert.equal(res.code,503);assert.equal(res.body,'fail');
});

test('disabling new WeChat orders preserves historical callback and polling',async()=>{
  const a=app({env:{PAY_WECHAT_ENABLED:'false'}});a.orders.set(id,order);
  assert.equal((await a.call('create-order',{mode:'credit_10'})).code,503);
  assert.equal((await a.call('payment-notify',notification())).body,'success');
  assert.equal((await a.call('check-order',{},'GET',{out_trade_no:id})).body.status,'pending');
  a.orders.set(id,{...order,status:'paid'});
  const res=await a.call('check-order',{},'GET',{out_trade_no:id});assert.equal(res.body.code,'FIXTURE8');
  assert.equal(a.events.includes('gateway'),false);
});

test('disabled Alipay still fulfills and queries its own historical order, never a WeChat order',async()=>{
  let granted=null;
  const a=app({env:{PAY_ALIPAY_ENABLED:'false'},database:{
    getCreditsByOrderId:async()=>granted,
    insertCredits:async(code,oid,credits,channel,userId)=>{granted={code,credits};assert.equal(userId,123);return granted;}
  }});
  const n={out_trade_no:'credit10_u123_fixture',trade_status:'TRADE_SUCCESS',money:'9.90'};
  n.sign=require('../lib/payment-contract.js').md5Sign(n,env.PAY_KEY);
  assert.equal((await a.call('callback',n)).body,'success');assert.equal(granted.credits,10);
  assert.equal((await a.call('check-order',{},'GET',{out_trade_no:n.out_trade_no})).body.paid,true);
  const wrong={...n,out_trade_no:id};wrong.sign=require('../lib/payment-contract.js').md5Sign(wrong,env.PAY_KEY);
  assert.equal((await a.call('callback',wrong)).code,400);assert.equal(a.events.includes('gateway'),false);
});

test('durable storage rejects missing database, failed writes and false RPC results',async()=>{
  let database=null;
  const context={module:{exports:{}},require(name){assert.equal(name,'./supabase.js');return {getSupabase:()=>database};}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'lib/payment-order-store.js'),'utf8'),context);
  const store=context.module.exports;
  await assert.rejects(store.create(order),/unavailable/);
  const chain={insert(){return this;},select(){return this;},eq(){return this;},single:async()=>({data:null,error:{message:'private detail'}}),maybeSingle:async()=>({data:null,error:{}})};
  database={from:()=>chain,rpc:async(name,params)=>{assert.equal(name,'fulfill_wechat_payment');assert.equal(params.p_amount_cents,990);return {data:false,error:null};}};
  await assert.rejects(store.create(order),/could not be saved/);await assert.rejects(store.get(id),/could not be read/);
  await assert.rejects(store.fulfill(id,'fixture',990,'tx'),/fulfillment failed/);
  await assert.rejects(store.entitlement(order),/unavailable/);
});

test('report polling enforces identity, redirects never fulfill and reject external destinations',async()=>{
  const a=app();a.orders.set(id,{...order,kind:'report',report_type:'hepan',report_key:'report-fixture',status:'paid'});
  assert.equal((await a.call('check-order',{},'GET',{out_trade_no:id,expected_type:'bazi'})).code,409);
  const paid=await a.call('check-order',{},'GET',{out_trade_no:id,expected_type:'hepan'});
  assert.equal(paid.body.report_key,'report-fixture');assert.match(paid.body.token,/^tk_/);
  const r=await a.call('payment-return',{},'GET',{order:id});assert.equal(r.code,302);assert.equal(r.headers.Location,order.return_path);
  for(const url of ['//evil.example','https://evil.example','/pricing?x=\r\nX:1','/pricing?x=\\evil']){
    a.orders.set(id,{...order,return_path:url});assert.equal((await a.call('payment-return',{},'GET',{order:id})).code,404);
  }
  assert.equal(a.events.some(Array.isArray),false);
});

test('WeChat mobile-only cashier is never encoded as desktop QR fallback',()=>{
  assert.equal(PaymentFlow.resolvePayment({payment_method:'wechat',pay_url:'https://cashier.example/mobile'}).qrImageUrl,'');
});

test('URL-encoded callback parsing preserves spaces/equals and rejects duplicate keys',async()=>{
  const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const start=source.indexOf('function readRequestBody('), end=source.indexOf('\nconst server',start);
  // Extract by balanced function braces to avoid ever running server startup code.
  let braces=0, stop=source.indexOf('{',start);
  for(let i=stop;i<source.length;i++){if(source[i]==='{')braces++;if(source[i]==='}'&&--braces===0){stop=i+1;break;}}
  const context={Buffer,URLSearchParams,drainRequest(){},RequestBodyTooLargeError:Error};
  vm.runInNewContext(source.slice(start,stop),context);
  const {EventEmitter}=require('node:events');
  function parse(body){const req=new EventEmitter();req.headers={};const p=context.readRequestBody(req,{});req.emit('data',Buffer.from(body));req.emit('end');return p;}
  const parsed=await parse('title=AI+%2B+%E7%9F%A5%E6%97%B6&attach=a=b');
  assert.equal(parsed.title,'AI + 知时');assert.equal(parsed.attach,'a=b');
  await assert.rejects(parse('appid=a&appid=b'),/Duplicate/);
});
