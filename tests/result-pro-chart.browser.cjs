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
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{for(const width of [320,390,414,1280]){const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<700,serviceWorkers:'block'});
await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(base+'/result?year=1996&month=11&day=19&hour=7&clock=14&minute=30&gender=female&name=UI测试',{waitUntil:'networkidle'});
await p.waitForSelector('#gan-day');
console.log(width,await p.locator('#gan-day').innerText(),errors);
assert.equal(await p.locator('.pp-shensha-row').isVisible(),false);
assert.equal(await p.locator('.pp-xingyun-row').isVisible(),true);
assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow');
if(width<700){assert.equal(await p.locator('.result-header').isVisible(),true);assert.equal(await p.locator('.pp-fuxing-row').isVisible(),false);}
let docs=0;p.on('request',r=>{if(r.isNavigationRequest())docs++;});
await p.locator('.dayun-col').nth(0).click();
assert.equal(await p.locator('.liunian-col.active-ln').count(),1);assert.notEqual(await p.locator('#gan-liunian').innerText(),'—');
await p.locator('.liunian-col').nth(4).click();const selected=await p.locator('#gan-liunian').innerText()+await p.locator('#zhi-liunian').innerText();
if(width<700){assert.equal(await p.locator('[data-result-tab="info"]').count(),0);assert.equal(await p.locator('.pp-kongwang-row,.pp-nayin-row').count(),0);assert.equal(await p.locator('#basicInfoSection #dayunDirection').count(),1);await p.locator('[data-result-tab="basic"]').click();assert.equal(await p.locator('#gan-liunian').innerText()+await p.locator('#zhi-liunian').innerText(),selected);await p.locator('[data-result-tab="professional"]').click();assert.equal(await p.locator('#proSection').isVisible(),true);await p.locator('[data-result-tab="reading"]').click();assert.equal(await p.locator('#parentsSection').isVisible(),true);await p.locator('[data-result-tab="basic"]').click();}
assert.equal(docs,0);assert.deepEqual(errors,[]);
// Rapid timing changes must leave columns and selection in agreement.
const natal = await p.locator('#gan-day').innerText();
await p.evaluate(()=>{showLiuNian(1);showLiuNian(2);showLiuNian(0);selectLiuNian(7);});
await p.waitForTimeout(80);
assert.equal(await p.locator('.dayun-col.active').getAttribute('data-index'),'0');
assert.equal(await p.locator('.liunian-col.active-ln').getAttribute('data-index'),'7');
assert.equal(await p.locator('#gan-day').innerText(),natal);
const yearBefore=await p.locator('#gan-liunian').innerText();
await p.reload({waitUntil:'networkidle'});
assert.equal(await p.locator('.liunian-col.active-ln').getAttribute('data-index'),'7');
assert.equal(await p.locator('#gan-liunian').innerText(),yearBefore);
const exported=await p.evaluate(()=>{const doc=new DOMParser().parseFromString(buildReportHTML(),'text/html');return {dayun:doc.querySelectorAll('.dayun-col').length,years:doc.querySelectorAll('.liunian-col').length,duplicates:doc.querySelectorAll('.chart-hidden-god').length,shensha:doc.querySelectorAll('.pp-shensha-row').length};});
assert.ok(exported.dayun>0);assert.equal(exported.years,10);assert.equal(exported.duplicates,0);assert.equal(exported.shensha,0);
if(process.env.CHART_AUDIT_OUTPUT){await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(process.env.CHART_AUDIT_OUTPUT,'pro-chart-'+width+'.png')});}
// A direct-pillar chart with no matched birthday must not fabricate timing rows.
await p.goto(base+'/result?mode=pillars&yg=甲&yz=子&mg=丙&mz=寅&dg=甲&dz=辰&hg=甲&hz=子&gender=male',{waitUntil:'networkidle'});
assert.equal(await p.locator('#timingLimitNotice').isVisible(),true);
assert.equal(await p.locator('#dayunSection').isVisible(),false);
assert.equal(await p.locator('#liunianSection').isVisible(),false);
assert.equal(await p.locator('.pp-xingyun-row').isVisible(),true);
assert.deepEqual(errors,[]);
console.log('PASS',width,'layout, tabs, selection, rapid changes, reload, export and unavailable timing');
await ctx.close();}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
