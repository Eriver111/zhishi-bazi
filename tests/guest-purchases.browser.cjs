// Synthetic browser only: no production server, user account, gateway or database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const proof=require('../lib/purchase-proof.js');
const root=path.resolve(__dirname,'..');
const secret='browser-fixture-secret';

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  for(const width of [390,1280]){
   for(const scenario of ['paid','retry','late-callback']){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    const orders=[],errors=[];let fail=scenario==='retry';
    await context.route('**/*',async route=>{
     const req=route.request(),url=new URL(req.url());
     if(url.origin!=='https://purchase.example')return route.abort();
     const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
     const token=req.headers().authorization;
     if(url.pathname==='/api/payment-methods')return json({methods:[{id:'wechat'}]});
     if(url.pathname==='/api/create-order'){
      const body=req.postDataJSON(),id='wx_'+(orders.length+1).toString(16).padStart(24,'0');
      orders.push({id,kind:body.mode||'bazi',owner:null,status:'pending'});
      return json({out_trade_no:id,amount:9.9,payment_method:'wechat',purchase_receipt:proof.issue(id,secret),pay_url:'https://cashier.invalid'});
     }
     if(url.pathname==='/api/auth/register')return json({token:'fixture-token',user:{id:123,email:'fixture@example.test'}});
     if(url.pathname==='/api/auth/verify')return json({valid:token==='Bearer fixture-token',user:{id:123,email:'fixture@example.test'}});
     if(url.pathname==='/api/auth/migrate')return json({success:true});
     if(url.pathname==='/api/auth/claim-purchases'){
      if(fail)return json({error:'temporary failure'},503);
      if(token!=='Bearer fixture-token')return json({error:'unauthorized'},401);
      const results=req.postDataJSON().receipts.map(r=>{
       const o=orders.find(o=>o.id===r.order_id);
       if(!proof.verify(r,secret))return {order_id:r.order_id,status:'invalid'};
       if(!o||(o.owner&&o.owner!==123))return {order_id:r.order_id,status:'unavailable'};
       o.owner=123;return {order_id:o.id,status:o.status};
      });
      return json({results});
     }
     const paid=orders.filter(o=>o.owner===123&&o.status==='paid');
     if(url.pathname==='/api/auth/profile')return json({credits:paid.some(o=>o.kind==='credit_10')?10:0,
      is_monthly:paid.some(o=>o.kind==='monthly'),monthly_expires:'2026-10-24',
      history:paid.filter(o=>['monthly','credit_10'].includes(o.kind)).map(o=>({type:o.kind==='monthly'?'月度会员':'积分包',detail:'已购买',date:'2026-09-24'})),
      hepan_reports:paid.filter(o=>o.kind==='hepan').map(()=>({report_type:'hepan',label:'合盘分析报告',paid_at:'2026-09-24',return_path:'/hepan-result.html?a=fixture'}))});
     if(url.pathname==='/api/reports')return json({reports:paid.filter(o=>o.kind==='bazi').map(()=>({report_type:'bazi',label:'八字完整报告',paid_at:'2026-09-24',report_params:{year:2000,month:1,day:1,hour:1,gender:'male'}}))});
     if(url.pathname==='/api/auth/get-data')return json({value:'[]'});
     if(url.pathname.startsWith('/api/'))return json({});
     if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="zhishi-nav"></div><script src="/js/auth.js"></script><script src="/js/payment.js"></script>'});
     if(url.pathname==='/profile')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'profile.html'),'utf8')});
     if(['/js/auth.js','/js/payment.js'].includes(url.pathname))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,url.pathname.slice(1)),'utf8')});
     if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:''});
     if(url.pathname.endsWith('.css')){
      const p=path.join(root,url.pathname.slice(1));
      return route.fulfill({contentType:'text/css',body:fs.existsSync(p)?fs.readFileSync(p,'utf8'):''});
     }
     return route.fulfill({status:204,body:''});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://purchase.example/fixture');
    await page.evaluate(async()=>{
     for(const mode of ['credit_10','monthly','bazi','hepan'])await PaymentFlow.createOrder({mode});
     if(JSON.parse(localStorage.getItem('zhishi_purchase_receipts')).length!==4)throw new Error('receipts missing before cashier');
    });
    if(scenario!=='late-callback')orders.forEach(o=>o.status='paid');
    await page.evaluate(async()=>{
     const account=await Auth.register('fixture@example.test','synthetic-password',undefined,'fixture-code');
     await Auth.setAuth(account.token,account.user);
    });
    await page.goto('https://purchase.example/profile');
    await page.locator('#content h3').first().waitFor();
    if(scenario!=='paid'){
     const pending=await page.locator('#content').innerText();
     assert.doesNotMatch(pending,/暂无购买记录|还没有已购报告/);
     assert.match(pending,/不需要重新购买|不需要再次支付/);
     assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhishi_purchase_receipts')).length),4);
     fail=false;orders.forEach(o=>o.status='paid');
     await page.getByRole('button',{name:'重试同步'}).click();
    }
    await page.getByText('八字完整报告',{exact:true}).waitFor();
    assert.equal(await page.getByText('合盘分析报告',{exact:true}).count(),1);
    assert.equal(await page.locator('a[href^="/hepan-result.html?"]').count(),1);
    assert.match(await page.locator('#content').innerText(),/积分包/);
    assert.match(await page.locator('#content').innerText(),/月度会员/);
    assert.doesNotMatch(await page.locator('#content').innerText(),/暂无购买记录|还没有已购报告/);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhishi_purchase_receipts')).length),0);
    assert.ok(orders.every(o=>o.owner===123));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS '+width+' '+scenario);
   }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
