const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));

function eventTarget(extra = {}) {
  const handlers = new Map();
  return Object.assign(extra, {
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
    emit(name) { for (const fn of [...(handlers.get(name) || [])]) fn({ type: name }); },
    count() { return [...handlers.values()].reduce((n, set) => n + set.size, 0); }
  });
}

function harness(initial = {}) {
  const nodes = {}, intervals = new Map(), timeouts = new Map(), storage = new Map(Object.entries(initial));
  let id = 0, now = 100000000, result = {status:'pending'};
  const calls = [];
  const document = eventTarget({ visibilityState:'visible',
    getElementById: name => nodes[name] || null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: tag => element(tag), body: {appendChild(){} }
  });
  function element(tag) {
    return { tagName:tag, style:{}, children:[], classList:{add(){}, remove(){}},
      setAttribute(){}, removeAttribute(){}, appendChild(child){this.children.push(child);},
      replaceChildren(){this.children=[];}, querySelectorAll(){return [];},
      addEventListener(){}, remove(){this.removed=true;}, showModal(){}, close(){} };
  }
  const context = eventTarget({ console, URLSearchParams, AbortController,
    Date: class extends Date { static now(){return now;} },
    navigator:{userAgent:'iPhone'}, location:{href:'',search:''}, document,
    localStorage:{ getItem:key=>storage.get(key)||null, setItem:(key,value)=>storage.set(key,String(value)), removeItem:key=>storage.delete(key) },
    setInterval(fn){intervals.set(++id,fn);return id;}, clearInterval(key){intervals.delete(key);},
    setTimeout(fn){timeouts.set(++id,fn);return id;}, clearTimeout(key){timeouts.delete(key);},
    fetch:async (url,options)=>{ calls.push({url,options}); return {ok:true,json:async()=>result}; }
  });
  context.window=context; vm.createContext(context);
  function load(file) { vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context); }
  load('js/payment.js');
  return {context,document,nodes,storage,calls,intervals,timeouts,load,
    setResult(value){result=value;}, advance(ms){now+=ms;},
    tick(){for(const fn of [...intervals.values()])fn();},
    node(name){return nodes[name]=element('div');},
    watch(extra={}) {return context.PaymentFlow.watchOrder({orderId:'wx_fixture',isPaid:d=>d.status==='paid',onPaid(){},...extra});}
  };
}

function inlineScript(file, marker) {
  return [...fs.readFileSync(path.join(root,file),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m=>m[1]).find(s=>s.includes(marker));
}

test('mobile app return confirms exactly once with fresh server state', async () => {
  const h=harness(); let unlocked=0;
  h.watch({expectedType:'bazi',onPaid(){unlocked++;}}); await flush();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.cache,'no-store');
  assert.equal(new URL(h.calls[0].url,'https://fixture.test').searchParams.get('expected_type'),'bazi');
  h.document.visibilityState='hidden';h.document.emit('visibilitychange');assert.equal(h.intervals.size,0);
  h.setResult({status:'paid'});
  h.document.visibilityState='visible';h.document.emit('visibilitychange');h.context.emit('focus');h.context.emit('pageshow');await flush();
  assert.equal(h.calls.length,2);assert.equal(unlocked,1);
  assert.equal(h.intervals.size,0);assert.equal(h.document.count()+h.context.count(),0);
  h.context.emit('focus');await flush();assert.equal(unlocked,1);
});

test('six-minute pause preserves order; browser-back and manual refresh resume without creating orders', async () => {
  const h=harness();let unlocked=0;const messages=[];
  const watcher=h.watch({onPaid(){unlocked++;},onState:m=>messages.push(m)});
  await flush();h.advance(7*60*1000);h.tick();assert.equal(h.intervals.size,0);
  assert.match(messages.at(-1),/原订单.*勿重复支付/);
  h.context.emit('pageshow');await flush();assert.equal(h.calls.length,2);
  h.setResult({status:'paid'});await watcher.check();assert.equal(unlocked,1);
  assert.ok(h.calls.every(c=>c.url.startsWith('/api/check-order?')));
});

test('hung query times out; its late paid response cannot overtake a replacement', async () => {
  const h=harness();let resolveOld,unlocked=0;
  h.context.fetch=()=>new Promise(resolve=>{resolveOld=resolve;});
  const watcher=h.watch({onPaid(){unlocked++;}});await flush();
  for(const timeout of [...h.timeouts.values()])timeout();
  h.context.fetch=async()=>({ok:true,json:async()=>({status:'pending'})});await watcher.check();
  resolveOld({ok:true,json:async()=>({status:'paid'})});await flush();assert.equal(unlocked,0);
  h.context.fetch=async()=>({ok:true,json:async()=>({status:'paid'})});await watcher.check();assert.equal(unlocked,1);
});

test('offline and HTTP errors keep locked; online event retries', async () => {
  const h=harness();let unlocked=0;
  h.context.fetch=async()=>{throw new Error('offline');};h.watch({onPaid(){unlocked++;}});await flush();
  h.context.fetch=async()=>({ok:false,json:async()=>({status:'paid'})});h.context.emit('online');await flush();assert.equal(unlocked,0);
  h.context.fetch=async()=>({ok:true,json:async()=>({status:'paid'})});h.context.emit('online');await flush();assert.equal(unlocked,1);
});

test('stopped query ignores a late payment and never closes another order cashier', async () => {
  const h=harness();let resolve,unlocked=0;
  h.context.fetch=()=>new Promise(r=>{resolve=r;});
  const dialog=h.node('paymentCashier');dialog._paymentOrderId='other-order';
  const watcher=h.watch({onPaid(){unlocked++;}});await flush();watcher.stop();
  resolve({ok:true,json:async()=>({status:'paid'})});await flush();assert.equal(unlocked,0);assert.ok(!dialog.removed);
  h.context.fetch=async()=>({ok:true,json:async()=>({status:'paid'})});h.watch();await flush();assert.ok(!dialog.removed);
});

for(const variant of ['bazi','hepan']) test(`${variant} unlocks only its own product and report key after return`, async()=>{
  const h=harness();h.load(variant==='bazi'?'js/paywall.js':'js/hepan-paywall.js');
  let unlocked=0;const isBazi=variant==='bazi';
  h.context[isBazi?'_baziHash':'_hepanHash']='chart-A';h.context[isBazi?'unlock':'hunlock']=()=>{unlocked++;};
  const modal=h.node(isBazi?'qrModal':'hepanQrModal');modal.style.display='flex';
  h.context[isBazi?'startQRPoll':'hpoll']({oid:'wx_report',h:'chart-A',k:'key-A'});await flush();
  for(const data of [{status:'paid',report_type:isBazi?'hepan':'bazi',report_key:'key-A'},
    {status:'paid',report_type:variant,report_key:'key-B'}, {status:'pending',report_type:variant,report_key:'key-A'}]) {
    h.setResult(data);h.context.emit('focus');await flush();assert.equal(unlocked,0);
  }
  h.context.emit('pagehide');h.setResult({status:'paid',report_type:variant,report_key:'key-A'});
  h.context.emit('pageshow');await flush();assert.equal(unlocked,1);assert.equal(modal.style.display,'none');
});

test('Hepan inline recovery restores a saved order and removes its cashier upon confirmation', async()=>{
  const h=harness();vm.runInContext(inlineScript('hepan-result.html','function initHePanPay('),h.context);
  h.storage.set('hpo2',JSON.stringify({oid:'wx_hepan',h:'甲|子|乙|丑|情侣',k:'key-A'}));
  const dialog=h.node('paymentCashier');dialog._paymentOrderId='wx_hepan';const paywall=h.node('hpPaywall');
  h.context._initHePanPay({dayGan:'甲',dayZhi:'子'},{dayGan:'乙',dayZhi:'丑'},'情侣');await flush();assert.equal(h.calls.length,1);
  h.setResult({status:'paid',report_type:'hepan',report_key:'key-A'});h.context.emit('pageshow');await flush();
  assert.ok(dialog.removed);assert.ok(paywall.removed);assert.equal(h.storage.has('hpo2'),false);
});

test('mobile pricing starts a watcher before navigation and browser-back delivers credits', async()=>{
  const h=harness();for(const name of ['creditQrModal','qrStatus','qrRetryBtn','qrContainer'])h.node(name);
  vm.runInContext(inlineScript('pricing.html','function buyCredits('),h.context);
  h.context.PaymentFlow.createOrder=async()=>({json:async()=>({out_trade_no:'wx_credit',pay_url:'https://cashier.example/pay',payment_method:'wechat'})});
  let atNavigation=false,success;Object.defineProperty(h.context.location,'href',{set(){atNavigation=h.context.count()>0;}});
  h.context.onPaySuccess=data=>{success=data;};h.context.buyCredits('credit_10',9.9,'提问');await flush();assert.ok(atNavigation);
  h.context.emit('pagehide');h.setResult({paid:true,status:'paid',code:'FIXTURE',credits:10});
  h.context.emit('pageshow');await flush();assert.equal(success.code,'FIXTURE');
});

for (const fromUrl of [false,true]) test(`pricing recovers from ${fromUrl?'paid URL':'same-day local order'} only after server confirmation`, async()=>{
  const h=harness({credit_ord:'wx_credit',credit_ord_ts:String(100000000-60*60*1000)});
  for(const name of ['creditQrModal','qrStatus','qrRetryBtn'])h.node(name);
  h.context.location.search=fromUrl?'?paid=wx_credit':'';h.context.history={replaceState(){}};
  vm.runInContext(inlineScript('pricing.html','function buyCredits('),h.context);
  await flush();assert.equal(h.calls.length,1);assert.equal(h.storage.get('last_paid_code'),undefined);
  h.setResult({paid:true,code:'FIXTURE',credits:10});h.context.emit('focus');await flush();
  assert.equal(h.storage.get('last_paid_code'),'FIXTURE');assert.equal(h.storage.has('credit_ord'),false);
  assert.equal(h.nodes.creditQrModal.style.display,'none');
});

test('AI pending purchase uses the shared recovery and delivers credits once after return', async()=>{
  const h=harness({ai_pending_order:'wx_ai',ai_pending_mode:'credit_pack'});
  h.document.readyState='loading';
  const source=fs.readFileSync(path.join(root,'js/ai-chat-integration.js'),'utf8');
  // Expose the real closure to exercise payment handling without generating AI UI or requests.
  vm.runInContext(source.replace('window.ZhishiAIContext.buildChartData = buildChartData;',`
    window.ZhishiAIContext.buildChartData = buildChartData;
    window.testRestorePayment = restoreSession;
    window.testDeliveries = [];
    handlePaymentSuccess = function(code, credits) { window.testDeliveries.push({code:code,credits:credits}); };
    handleMonthlySuccess = function(code) { window.testDeliveries.push({code:code,monthly:true}); };
  `),h.context);
  const cashier=h.node('paymentCashier');cashier._paymentOrderId='wx_ai';
  h.context.testRestorePayment();await flush();assert.equal(h.context.testDeliveries.length,0);
  h.context.emit('pagehide');h.setResult({paid:true,status:'paid',code:'AI-FIXTURE',credits:10});
  h.context.emit('pageshow');await flush();
  assert.equal(h.context.testDeliveries.length,1);assert.equal(h.context.testDeliveries[0].credits,10);
  assert.equal(h.storage.has('ai_pending_order'),false);assert.ok(cashier.removed);
  h.context.emit('focus');await flush();assert.equal(h.context.testDeliveries.length,1);
});
