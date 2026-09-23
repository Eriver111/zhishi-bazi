// Isolated browser audit. Serves only public static files; all accounts and writes
// below are synthetic. Never starts server.js or loads an environment/data store.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const {resolvePublicFile}=require('../lib/static-security');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Synthetic audit: no account API'}));return;}
 const name=url.pathname==='/'?'/index.html':path.extname(url.pathname)?url.pathname:url.pathname+'.html',file=resolvePublicFile(root,name);
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
});
const authMock=`window.__records=Array.from({length:65},(_,i)=>({name:'合成档案'+i,params:'mode=pillars&yg=甲&yz=子&mg=丙&mz=寅&dg=甲&dz=辰&hg=甲&hz=子&gender=male&name='+encodeURIComponent('合成档案'+i),label:'合成档案'+i}));window.__writes=[];window.__owner='test-A';window.__login=[];window.__logged=true;window.Auth={getUser:()=>({id:__owner}),getToken:()=>'',isLoggedIn:()=>__logged,ready:fn=>fn(),onLogin:fn=>__login.push(fn),getData:()=>Promise.resolve(JSON.stringify(__records)),syncData:(key,value)=>{__writes.push({key,value});__records=JSON.parse(value);return Promise.resolve();},showModal:()=>{}};`;
async function waitClosed(page){await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&!(history.state&&history.state.zhishiTouchSheet));}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}
async function timeIntegrity(page,base){
 // Freeze only Date, leaving timers/animation live so delayed writes can be observed.
 await page.clock.setFixedTime(new Date(2026,8,23,18,37,0));
 await page.goto(base+'/paipan',{waitUntil:'networkidle'});
 const state=()=>page.evaluate(()=>['sYear','sMonth','sDay','sHour','sMinute'].map(id=>{const e=document.getElementById(id);return id==='sHour'?e.selectedOptions[0]?.getAttribute('data-clock'):e.value;}));
 for(const clock of [7,8,0,23]){
  await page.evaluate(clock=>{
   for(const [id,value] of [['sYear','2000'],['sMonth','2'],['sDay','29'],['sMinute','41']]){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}
   setPaipanHourClock('sHour',Math.floor((clock+1)%24/2),clock);document.getElementById('sHour').dispatchEvent(new Event('change',{bubbles:true}));
  },clock);
  await page.waitForTimeout(180);await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await state(),['2000','2','29',String(clock),'41'],'draft reload preserves exact clock and minute');
  await page.locator('[data-birth-sheet-open="time"]').click();
  assert.match(await page.locator('[data-target-id="sHour"] .selected').innerText(),new RegExp('^'+clock+'点'));
  await page.locator('.mobile-birth-sheet-confirm').click();await page.waitForTimeout(300);
 }
 await page.locator('[data-birth-sheet-open="time"]').click();
 await page.locator('.mobile-birth-sheet-today').click();
 assert.deepEqual(await state(),['2026','9','23','18','37'],'today uses current year and 24-hour clock');
 // A pending old wheel must not write after Today rebuilds the controls.
 await page.waitForTimeout(100);
 await page.evaluate(()=>{
  const rail=document.querySelector('[data-target-id="sHour"] .mobile-wheel-rail');
  rail._programmatic=false;rail.dispatchEvent(new Event('wheel'));
  const button=rail.querySelectorAll('button')[5],a=rail.getBoundingClientRect(),b=button.getBoundingClientRect();rail.scrollTop+=(b.top+b.height/2)-(a.top+a.height/2);rail.dispatchEvent(new Event('scroll'));
  document.querySelector('.mobile-birth-sheet-today').click();
 });
 await page.waitForTimeout(500);assert.deepEqual(await state(),['2026','9','23','18','37'],'discarded wheel cannot overwrite Today');
 // Closing animation must not remove the freshly reopened picker.
 await page.evaluate(()=>{ZhishiBirthSheet.close();ZhishiBirthSheet.open('time');});
 await page.waitForTimeout(350);assert.equal(await page.locator('.mobile-birth-sheet').isVisible(),true,'rapid reopen remains visible');
 assert.equal(await page.locator('.mobile-wheel-column').count(),5);
 // Closing commits the current position once; detached/stale wheel events never write again.
 await page.evaluate(()=>{
  window.__oldRail=document.querySelector('[data-target-id="sMinute"] .mobile-wheel-rail');
  __oldRail._programmatic=false;__oldRail.dispatchEvent(new Event('wheel'));__oldRail.dispatchEvent(new Event('scroll'));
  ZhishiBirthSheet.close();document.getElementById('sMinute').value='19';
  __oldRail.dispatchEvent(new Event('wheel'));__oldRail.dispatchEvent(new Event('scroll'));__oldRail.querySelector('button').click();
 });
 await page.waitForTimeout(550);assert.equal((await state())[4],'19','closed wheel cannot perform a late write');
 // Check all clock-to-branch mappings, including both midnight choices.
 for(let clock=0;clock<24;clock++){
  await page.clock.setFixedTime(new Date(2026,8,23,clock,37,0));
  await page.evaluate(()=>{ZhishiBirthSheet.open('time');document.querySelector('.mobile-birth-sheet-today').click();});
  assert.equal((await state())[3],String(clock));
  assert.equal(await page.locator('#sHour').inputValue(),String(Math.floor((clock+1)%24/2)));
 }
 await page.evaluate(()=>ZhishiBirthSheet.close());await page.waitForTimeout(300);
 // Lunar draft uses the same duplicate-value hour selector, with independent minutes.
 for(const clock of [11,12]){
  await page.evaluate(clock=>{
   switchMode('lunar');
   for(const [id,value] of [['lYear','2000'],['lMonth','1'],['lDay','2'],['lMinute','53']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}
   setPaipanHourClock('lHour',6,clock);document.getElementById('lHour').dispatchEvent(new Event('change',{bubbles:true}));
  },clock);
  await page.waitForTimeout(180);await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await page.evaluate(()=>[currentMode,document.getElementById('lHour').selectedOptions[0].getAttribute('data-clock'),document.getElementById('lMinute').value]),['lunar',String(clock),'53']);
 }
 // Switching calendars while a wheel is pending cannot overwrite the inactive calendar.
 await page.evaluate(()=>{switchMode('solar');ZhishiBirthSheet.open('time');});await page.waitForTimeout(100);
 await page.evaluate(()=>{
  const rail=document.querySelector('[data-target-id="sMinute"] .mobile-wheel-rail');rail._programmatic=false;rail.dispatchEvent(new Event('wheel'));rail.dispatchEvent(new Event('scroll'));
  document.querySelector('[data-sheet-mode="lunar"]').click();document.getElementById('sMinute').value='17';
 });
 await page.waitForTimeout(350);assert.equal((await state())[4],'17');
 await page.evaluate(()=>ZhishiBirthSheet.close());await page.waitForTimeout(300);
 // Existing member-local restore must finish in one guarded turn, including minutes.
 await page.evaluate(()=>{sessionStorage.clear();localStorage.setItem('ai_chat_type','monthly');localStorage.setItem('last_bazi_params','year=1998&month=6&day=12&hour=4&clock=8&minute=42&gender=male');});
 await page.addInitScript(()=>{if(location.search==='?audit=member-restore')sessionStorage.clear();});
 await page.goto(base+'/paipan?audit=member-restore',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('sYear').value==='1998');
 assert.deepEqual(await state(),['1998','6','12','8','42']);
 await page.evaluate(()=>{document.getElementById('sDay').value='15';document.getElementById('sDay').dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForTimeout(350);assert.equal((await state())[2],'15','member restore cannot overwrite subsequent edits');
 // Inspect actual outgoing result URL without loading result data or starting an API.
 await page.route('**/result?*',r=>r.fulfill({contentType:'text/html',body:'<style>@view-transition { navigation: auto; }</style><p>Synthetic result target</p>'}));
 await page.evaluate(()=>document.getElementById('birthForm').requestSubmit());await page.waitForURL('**/result?*');
 const sent=new URL(page.url()).searchParams;assert.equal(sent.get('hour'),'4');assert.equal(sent.get('clock'),'8');assert.equal(sent.get('minute'),'42');assert.equal(sent.get('day'),'15');
 await page.waitForTimeout(400);
 await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});
 console.log('time integrity: exact-clock restore, Today 24 hours, stale wheel and rapid reopen passed');
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  for(const width of [320,390,700,1280]){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<=700,serviceWorkers:'block'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   for(const route of ['paipan','hepan','ziwei']){
    await page.goto(base+'/'+route,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.ZhishiTouchSheet);await noOverflow(page);
    const ids=route==='paipan'?['province','city','district']:route==='hepan'?['province-p1','city-p1','district-p1']:['zwProv','zwCity','zwDist'];
    const before=await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids);
    if(width>700){if(route!=='paipan')await page.locator('[data-chart-open="location"]').first().click();assert.equal(await page.locator('#'+ids[0]).isVisible(),true);assert.equal(await page.locator('.touch-place-open').first().isVisible(),false);if(route!=='paipan')await page.locator('.chart-editor[open] .chart-editor-head button').click();continue;}
    const opener=route==='paipan'?page.locator('[data-birth-sheet-open="location"]'):page.locator('[data-chart-open="location"]').first();
    await opener.click();assert.equal(await page.locator('dialog[open]').count(),1);
    await page.getByRole('searchbox',{name:'搜索出生地点'}).fill('西湖区');
    await page.locator('.touch-place-option').filter({hasText:'浙江省 · 杭州市'}).click();
    assert.deepEqual(await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids),before,'draft must not write live fields');
    await page.getByRole('button',{name:'取消',exact:true}).click();await waitClosed(page);
    assert.deepEqual(await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids),before);
    await opener.click();await page.getByRole('searchbox',{name:'搜索出生地点'}).fill('西湖区');
    await page.locator('.touch-place-option').filter({hasText:'浙江省 · 杭州市'}).click();await noOverflow(page);
    if(width===390&&route==='hepan'&&process.env.TOUCH_AUDIT_OUTPUT){fs.mkdirSync(process.env.TOUCH_AUDIT_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.TOUCH_AUDIT_OUTPUT,'place-picker-390.png')});}
    await page.getByRole('button',{name:'确认出生地点'}).click();await waitClosed(page);
    assert.deepEqual(await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids),['浙江省','杭州市','西湖区']);
    if(route==='hepan'){
     assert.deepEqual(await page.evaluate(()=>['province-p2','city-p2','district-p2'].map(id=>document.getElementById(id).value)),['','','']);
     await page.locator('[data-person-toggle="p2"]').click();await page.locator('[data-chart-open="location"]').nth(1).click();
     await page.getByRole('searchbox',{name:'搜索出生地点'}).fill('海淀区');await page.locator('.touch-place-option').filter({hasText:'北京市'}).click();await page.getByRole('button',{name:'确认出生地点'}).click();await waitClosed(page);
     assert.deepEqual(await page.evaluate(()=>['province-p2','city-p2','district-p2'].map(id=>document.getElementById(id).value)),['北京市','北京市','海淀区']);
     assert.deepEqual(await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids),['浙江省','杭州市','西湖区']);
     if(await page.locator('[data-person-toggle="p1"]').getAttribute('aria-expanded')==='false')await page.locator('[data-person-toggle="p1"]').click();
    }
    await opener.click();await page.goBack();await waitClosed(page);assert.equal(new URL(page.url()).pathname,'/'+route);
    assert.deepEqual(await page.evaluate(ids=>ids.map(id=>document.getElementById(id).value),ids),['浙江省','杭州市','西湖区']);
    await opener.click();await page.keyboard.press('Escape');await waitClosed(page);
    assert.ok(await opener.evaluate(e=>document.activeElement===e));
   }
   if(width===390)await timeIntegrity(page,base);
   await context.route('**/js/auth.js*',r=>r.fulfill({contentType:'application/javascript',body:authMock}));
   await page.goto(base+'/archives',{waitUntil:'networkidle'});await page.waitForSelector('.archive-record');await noOverflow(page);
   if(width<=700){
    assert.equal(await page.locator('.archive-record').count(),20);assert.equal(await page.locator('.archive-record__ai').first().isVisible(),false);
    await page.locator('.archive-record__more').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(new URL(page.url()).pathname,'/archives');
    await page.keyboard.press('Escape');await waitClosed(page);
    const row=page.locator('.archive-record').first();await row.dispatchEvent('pointerdown',{pointerType:'touch',clientX:100,clientY:100});await row.dispatchEvent('pointermove',{pointerType:'touch',clientX:100,clientY:135});await page.waitForTimeout(550);assert.equal(await page.locator('dialog[open]').count(),0);
    await row.dispatchEvent('pointerdown',{pointerType:'touch',clientX:100,clientY:100});await page.waitForSelector('dialog[open]');await page.goBack();await waitClosed(page);
    await page.locator('.archive-record__more').first().click();if(width===390&&process.env.TOUCH_AUDIT_OUTPUT)await page.screenshot({path:path.join(process.env.TOUCH_AUDIT_OUTPUT,'archive-actions-390.png')});
    page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'删除这份档案',exact:true}).click();await waitClosed(page);assert.equal(await page.evaluate(()=>__writes.length),0);
    await page.locator('.archive-record__more').first().click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'删除这份档案',exact:true}).click();await page.waitForFunction(()=>__writes.length===1);assert.equal(await page.evaluate(()=>__records.length),64);
    await page.locator('.archive-load-more').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.archive-record').length>=40);await noOverflow(page);
    await page.locator('#archiveSearch').fill('合成档案64');assert.equal(await page.locator('.archive-record').count(),1);
    await page.reload({waitUntil:'networkidle'});await page.waitForSelector('.archive-record');assert.equal(await page.locator('#archiveSearch').inputValue(),'合成档案64');assert.equal(await page.locator('.archive-record').count(),1);
    await page.locator('#archiveSearch').fill('');
    await page.evaluate(()=>{Auth.getData=()=>new Promise(resolve=>{window.__resolveOld=resolve;});__login[0]();});
    await page.evaluate(()=>{__owner='test-B';__logged=false;window.dispatchEvent(new Event('zhishi:identitychange'));__resolveOld(JSON.stringify([{name:'旧账号迟到数据',params:''}]));});
    await page.waitForSelector('#archiveLogin');assert.equal(await page.locator('.archive-record').count(),0);assert.doesNotMatch(await page.locator('#archiveContent').innerText(),/旧账号/);
   }else{assert.equal(await page.locator('.archive-record').count(),65);assert.equal(await page.locator('.archive-record__ai').first().isVisible(),true);}
   assert.deepEqual(errors,[]);await context.close();console.log(width+': place draft/cancel/confirm, persons, back/focus, archive batching/actions/state/account checks passed');
  }
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
