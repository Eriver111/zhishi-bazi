const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const proof = require('../lib/purchase-proof.js');
const root = path.resolve(__dirname, '..');
const id = 'wx_' + 'a'.repeat(24), secret = 'synthetic-secret-only';

test('binding proof is order-specific, signed, time-limited and independent of payment status', () => {
  const now = 1790000000000;
  const r = proof.issue(id, secret, now);
  assert.equal(proof.verify(r, secret, now + 86400000), true);
  for (const bad of [{...r,order_id:'wx_'+'b'.repeat(24)}, {...r,expires_at:r.expires_at+1},
    {...r,proof:'0'.repeat(64)}, {...r,expires_at:NaN}, null]) assert.equal(proof.verify(bad,secret,now),false);
  assert.equal(proof.verify(r, secret, r.expires_at), false);
  assert.equal(proof.verify(r, 'other', now), false);
  assert.equal(proof.verify(r, '', now), false);
  assert.throws(()=>proof.issue(id,''));
});

function api({user={uid:123},claim=async()=> 'paid'}={}) {
  const calls=[];
  const context={module:{exports:{}},process:{env:{XUNHU_APPSECRET:secret}},require(name){
    if(name.endsWith('/auth.js'))return {requireAuth:()=>user};
    if(name.endsWith('/purchase-proof.js'))return proof;
    if(name.endsWith('/payment-order-store.js'))return {claim:async(...args)=>{calls.push(args);return claim(...args)}};
    throw new Error(name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'api/auth/claim-purchases.js'),'utf8'),context);
  return {calls,async call(receipts,method='POST'){
    const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(v){this.body=v;return this}};
    await context.module.exports({method,body:{receipts},headers:{}},res);return res;
  }};
}
test('claim API requires login and signed proof; one expired receipt cannot block a valid purchase',async()=>{
  const good=proof.issue(id,secret),expired=proof.issue('wx_'+'b'.repeat(24),secret,1);
  const a=api();const r=await a.call([expired,good]);
  assert.equal(r.code,200);assert.equal(r.headers['Cache-Control'],'no-store');
  assert.deepEqual(a.calls,[[id,123]]);assert.equal(r.body.results[0].status,'invalid');
  assert.equal(r.body.results[1].status,'paid');
  assert.equal((await api({user:null}).call([good])).code,401);
  assert.equal((await a.call(Array(51).fill(good))).code,400);
  assert.equal((await a.call([good],'GET')).code,405);
});
test('claim API never reports success when durable binding fails and does not leak internals',async()=>{
  const a=api({claim:async()=>{throw new Error('private database details')}});
  const r=await a.call([proof.issue(id,secret)]);
  assert.equal(r.code,503);assert.doesNotMatch(JSON.stringify(r.body),/private/);
});

test('create-order stores the receipt before the caller can navigate to the cashier',async()=>{
  const events=[],receipt=proof.issue(id,secret);
  const order={purchase_receipt:receipt,pay_url:'https://cashier.example',out_trade_no:id};
  const context={module:{exports:{}},AbortController,setTimeout,clearTimeout,navigator:{userAgent:'fixture'},
    Auth:{rememberPurchase(r){events.push(['saved',r.order_id])}},fetch:async(url)=>{
      if(url==='/api/payment-methods')return {ok:true,json:async()=>({methods:[{id:'wechat'}]})};
      return {ok:true,clone:()=>({json:async()=>order}),json:async()=>order};
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/payment.js'),'utf8'),context);
  const response=await context.module.exports.createOrder({mode:'credit_3'});
  events.push(['returned',(await response.json()).out_trade_no]);
  assert.deepEqual(events,[['saved',id],['returned',id]]);
  context.Auth.rememberPurchase=()=>{throw new Error('storage blocked')};
  await assert.rejects(context.module.exports.createOrder({}),/storage blocked/);
});

function client(claim) {
  const storage=new Map(),events=[];
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const context={AbortController,setTimeout,clearTimeout,localStorage,sessionStorage:{removeItem(){}},Event,
    document:{getElementById:()=>null},window:{dispatchEvent(){}},fetch:async(url,options)=>{
      if(url==='/api/auth/claim-purchases')return claim(options);
      if(url==='/api/auth/migrate'){events.push('legacy-migrated');return {json:async()=>({success:true})};}
      throw new Error('Unexpected URL '+url);
    }};
  const source=fs.readFileSync(path.join(root,'js/auth.js'),'utf8').split('// 手机端统一导航外壳。')[0];
  vm.runInNewContext(source,context);
  return {auth:context.Auth,storage,events};
}
test('login waits for purchase and legacy binding before account listeners load history',async()=>{
  let release;
  const c=client(()=>new Promise(r=>{release=r}));
  c.auth.rememberPurchase(proof.issue(id,secret));
  c.auth.onLogin(()=>c.events.push('account-loaded'));
  const login=c.auth.setAuth('fixture-token',{id:123});
  assert.deepEqual(c.events,[]);
  release({ok:true,json:async()=>({results:[{order_id:id,status:'paid'}]})});
  await login;
  assert.deepEqual(c.events,['legacy-migrated','account-loaded']);
  assert.equal(c.storage.get('zhishi_purchase_receipts'),'[]');
});
test('failed/pending synchronization retains proof, retry binds without losing another tab new order',async()=>{
  let status='fail';
  const c=client(async()=>{
    if(status==='fail')throw new Error('offline');
    if(status==='paid')c.auth.rememberPurchase(proof.issue('wx_'+'b'.repeat(24),secret));
    return {ok:true,json:async()=>({results:[{order_id:id,status}]})};
  });
  c.auth.rememberPurchase(proof.issue(id,secret));
  await c.auth.setAuth('fixture-token',{id:123});
  assert.match(c.auth.purchaseStatus().error,/不需要重新购买/);
  assert.equal(JSON.parse(c.storage.get('zhishi_purchase_receipts')).length,1);
  status='pending';await c.auth.syncPurchases();
  assert.equal(c.auth.purchaseStatus().pending,true);
  assert.equal(JSON.parse(c.storage.get('zhishi_purchase_receipts')).length,1);
  status='paid';await c.auth.syncPurchases();
  assert.equal(c.auth.purchaseStatus().error,'');
  assert.deepEqual(JSON.parse(c.storage.get('zhishi_purchase_receipts')).map(r=>r.order_id),['wx_'+'b'.repeat(24)]);
});
test('late response after logout cannot clear receipts, migrate to another identity or notify account views',async()=>{
  let release;
  const c=client(()=>new Promise(r=>{release=r}));
  c.auth.rememberPurchase(proof.issue(id,secret));
  c.auth.onLogin(()=>c.events.push('notified'));
  const login=c.auth.setAuth('fixture-token',{id:123});c.auth.logout();
  release({ok:true,json:async()=>({results:[{order_id:id,status:'paid'}]})});await login;
  assert.equal(JSON.parse(c.storage.get('zhishi_purchase_receipts')).length,1);
  assert.deepEqual(c.events,[]);
});

test('account hepan restore checks the logged-in owner and exact report hash',async()=>{
  const crypto=require('node:crypto');const hash='fixture-day-a|fixture-day-b|couple';
  let uid=123,requested;
  const context={module:{exports:{}},require(name){
    if(name==='crypto')return crypto;
    if(name.endsWith('/auth.js'))return {requireAuth:()=>uid?{uid}:null};
    if(name.endsWith('/report-identity.js')||name.endsWith('/supabase.js'))return {};
    if(name.endsWith('/payment-order-store.js'))return {hepanReports:async user=>{
      requested=user;return user===123?[{report_key:crypto.createHash('sha256').update(hash).digest('hex')}]:[];
    }};
    throw new Error(name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'api/reports/access.js'),'utf8'),context);
  async function call(value){
    const res={code:200,setHeader(){},status(c){this.code=c;return this},json(d){this.body=d;return this}};
    await context.module.exports({method:'GET',headers:{},query:{type:'hepan',hash:value}},res);return res;
  }
  assert.equal((await call(hash)).body.unlocked,true);assert.equal(requested,123);
  assert.equal((await call(hash+'other')).body.unlocked,false);
  uid=456;assert.equal((await call(hash)).body.unlocked,false);assert.equal(requested,456);
  uid=null;assert.equal((await call(hash)).code,401);
});
