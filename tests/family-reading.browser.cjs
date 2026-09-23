// Static synthetic fixtures only: no server, accounts, credentials or external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const css=[...fs.readFileSync(path.join(root,'result.html'),'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const baseCSS=['style.css','landing.css'].map(f=>fs.readFileSync(path.join(root,'css',f),'utf8')).join('\n');
const themeCSS=['theme-light.css','theme-light-results.css'].map(f=>fs.readFileSync(path.join(root,'css',f),'utf8')).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.abort());
  await page.setContent('<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="max-width:760px;margin:auto;padding:16px"><section class="section-drawer section-parents drawer-open" id="parentsSection"><div class="section-header"><h2>父母关系</h2></div><div class="drawer-body"><div class="parents-content" id="parentsContent"></div></div></section></main></body></html>');
  await page.addStyleTag({content:baseCSS+css+themeCSS+'body{display:block;min-width:0;margin:0}main{width:100%;box-sizing:border-box}'});
  for(const file of ['bazi.js','result.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'js',file),'utf8')});
  for(const pillars of ['癸未 庚申 甲寅 戊辰','己亥 癸酉 己未 甲戌','丁酉 癸卯 乙巳 丙戌','己未 戊辰 壬子 癸卯','癸未 乙卯 壬午 戊申','丙戌 己亥 丙寅 甲午']){
   const counts=await page.evaluate(pillars=>{
    _bazi=Object.fromEntries(pillars.split(' ').map((p,i)=>[['year','month','day','hour'][i],{gan:p[0],zhi:p[1]}]));
    _params={gender:'male',mode:'pillars'};
    const p=BaZiCalculator.analyzeParents(_bazi,'male');renderParents(_bazi,'male');
    window.__fixture=p;
    return {readable:p.claims.filter(c=>c.status!=='insufficient').length,limited:p.claims.filter(c=>c.status==='insufficient').length};
   },pillars);
   assert.equal(await page.locator('.pr-card').count(),counts.readable);
   const paragraphs=await page.evaluate(()=>[...document.querySelectorAll('.pr-card-text')].every(el=>el.querySelectorAll('p').length>0));
   assert.equal(paragraphs,true);
   assert.equal(await page.locator('.parents-limited[open]').count(),0);
   const visible=await page.locator('#parentsContent').innerText();
   assert.doesNotMatch(visible,/不足以|尚不能|无法确定|暂不单独/);
   assert.doesNotMatch(visible,/可以先抓住|这条线索指向|协调决定|不指定是哪位父母/);
   if(pillars==='己未 戊辰 壬子 癸卯')assert.match(visible,/你想按自己的打算做，家里更希望你照原来的规矩来/);
   if(pillars==='癸未 乙卯 壬午 戊申'){
    // Previously year official + month hurting officer fabricated a shared rules theme.
    assert.equal(await page.evaluate(()=>__fixture.judgements.child.direction),'insufficient');
    assert.doesNotMatch(visible,/原来的规矩/);
   }
   if(pillars==='丙戌 己亥 丙寅 甲午'){
    const child=await page.evaluate(()=>__fixture.childRelationshipText);
    assert.match(child,/你有想法时，更容易把它拿出来和家人商量/);
    assert.doesNotMatch(child,/原来的规矩|照说好的办法/);
   }
   if(counts.readable){
    const detail=page.locator('.pr-card details').first();await detail.locator('summary').click();
    assert.equal(await detail.getAttribute('open'),'');
    assert.ok((await detail.innerText()).includes('依据与条件'));
    await detail.locator('summary').click();
   }
   if(counts.limited){
    await page.locator('.parents-limited > summary').click();
    assert.equal(await page.locator('.parents-limited > section').count(),counts.limited);
    await page.locator('.parents-limited > summary').click();
   }
   const exported=await page.evaluate(()=>{
    const doc=new DOMParser().parseFromString(buildReportHTML(),'text/html');
    return {same:doc.getElementById('parentsContent').textContent===document.getElementById('parentsContent').textContent,
     closed:doc.querySelectorAll('details.report-claim-details:not([open])').length};
   });
   assert.equal(exported.same,true);assert.equal(exported.closed,0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390&&pillars.startsWith('癸未')&&process.env.FAMILY_SCREENSHOT)await page.screenshot({path:process.env.FAMILY_SCREENSHOT,fullPage:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('320/390/1280 family readings: useful conclusions first, scoped themes, one collapsed boundary, traceable evidence and matching export; no overflow/errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
