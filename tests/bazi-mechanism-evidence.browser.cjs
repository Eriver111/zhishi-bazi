// Static synthetic fixtures; no application server, accounts, storage or network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.route('**/*',r=>r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--tx:#322e29;--tx2:#60594e;--tx3:#7b7367;--gold:#a57d34;--gold-l:#896421;--bd:#dacfb9}body{margin:0;background:#faf6eb;color:var(--tx);font:14px/1.8 system-ui}main{box-sizing:border-box;width:100%;max-width:760px;margin:auto;padding:16px}details{margin:8px 0}summary{cursor:pointer}p{overflow-wrap:anywhere}.deep-report-storyline{padding:16px;border:1px solid var(--bd);border-radius:16px;background:#fffcf5}.deep-report-storyline-basis{display:flex;gap:8px;flex-wrap:wrap;font-size:12px}</style><main><div id="story"></div><div id="patternAnalysis"></div><div id="yongJiAnalysis"></div></main></html>');
   for(const f of ['bazi.js','structural.js','bazi-chain.js','deep-report.js','result.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'js',f),'utf8')});
   for(const text of ['丙戌 丙申 丙申 戊戌','癸未 戊午 乙卯 丙戌','辛丑 辛卯 壬申 庚子']){
    const expected=await page.evaluate(text=>{
     const b=BaZiCalculator.buildFromPillars(Object.fromEntries(text.split(' ').map((s,i)=>[['year','month','day','hour'][i],{gan:s[0],zhi:s[1]}])),'male');
     const f=DeepReport.buildFacts(b,'male',{anchorYear:2026,deps:{calculator:BaZiCalculator,structural:StructuralAnalysis,chain:BaZiChain}});
     document.querySelector('#story').innerHTML=reportStoryline(f.storyline);
     renderPattern(b,{pattern:f.core.pattern});renderYongJi(b,{yongJi:f.core.yongJi});
     return f.core.yongJi.mechanismSummary;
    },text);
    const account=page.locator('[data-report-mechanism]');
    assert.equal(await account.getAttribute('open'),null);
    await account.locator('summary').click();
    const prose=await account.innerText();
    assert.ok(prose.includes(expected.mainCause));assert.ok(prose.includes(expected.help));assert.ok(prose.includes(expected.cost));
    if(width===390&&text.startsWith('丙戌')&&process.env.MECHANISM_SCREENSHOT)await page.screenshot({path:process.env.MECHANISM_SCREENSHOT,fullPage:false});
    await page.locator('#yongJiAnalysis > div > details > summary').click();
    const reviews=await page.locator('[data-mechanism-review]').allInnerTexts();
    assert.ok(reviews.length>0);
    if(text.startsWith('丙戌'))assert.match(reviews.join(' '),/食神生财：部分成立/);
    if(text.startsWith('癸未'))assert.match(reviews.join(' '),/食神生财：作用受阻/);
    if(text.startsWith('辛丑'))assert.match(reviews.join(' '),/印星制伤：作用成立/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // The PDF exporter expands this shared class; both new detail blocks must opt in.
    assert.ok(await account.evaluate(e=>e.classList.contains('report-claim-details')));
    assert.ok(await page.locator('#yongJiAnalysis > div > details').evaluate(e=>e.classList.contains('report-claim-details')));
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('320/390/1280: three charts, common report basis, action states, details and PDF expansion hooks; no overflow or page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
