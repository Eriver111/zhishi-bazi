// Synthetic only: no production page, credentials, storage or API is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});try{
 for(const width of [320,390,1280])for(const entry of ['report','ai']){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'}):r.abort());
  await page.goto('http://synthetic.test/?year=2000');
  await page.addStyleTag({content:'*{box-sizing:border-box}body{font:15px/1.7 sans-serif}'+fs.readFileSync(path.join(root,'css/chart-calibration.css'),'utf8')});
  for(const name of ['report-imagery','calibration-model','deep-report'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'js',name+'.js'),'utf8')});
  await page.evaluate(()=>{
   window.Auth={getToken:()=> 'synthetic-token',getUser:()=>({id:'synthetic-user'}),isLoggedIn:()=>true};
   window.ChatPersistence={chartIdentity:()=> 'synthetic'};window.ZhishiAIContext={buildChartData:()=>({fourPillars:{},birthInfo:{year:2000,gender:'male'}})};
   const option=ReportImagery.candidates('career',{triggers:[{type:'枭夺食',detail:'合成触发依据'}],reportLifeContext:{status:'unknown',age:24,historical:true}})[0];
   window.__events=[{event_key:'synthetic-2024',event_year:2024,prompt:'2024年前后，是否发生过下面这件事？',domain:'career',options:[option],evidence:['合成年度依据'],answer:null}];
   window.__original=JSON.stringify(option);window.__completed=0;
   window.fetch=async(url,opts)=>{
    if(!String(url).startsWith('/api/chart-calibration'))throw Error('Unexpected API');
    if(opts.method==='POST'){const body=JSON.parse(opts.body);if(body.action!=='answer')throw Error('Unexpected write');const normalized=ZhishiCalibrationModel.normalizeCalibrationResponse(__events[0],body);if(normalized.error)throw Error(normalized.error);Object.assign(__events[0],normalized.value);return {ok:true,json:async()=>({event:__events[0]})};}
    return {ok:true,json:async()=>({ready:true,calibration:{candidate_version:'bazi-cal-v10'},events:__events})};
   };
  });
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'js/chart-calibration.js'),'utf8')});
  await page.evaluate(entry=>ZhishiCalibration[entry==='report'?'beforeReport':'beforeAI'](()=>{__completed++;}),entry);
  if(entry==='report'){await page.locator('#reportLifeStatus').selectOption('working');await page.getByRole('button',{name:'下一步：核对往事'}).click();}
  const option=page.locator('.calibration-option').first();await option.waitFor();
  assert.match(await option.innerText(),/被退回重做.*延期或未能提交/);assert.match(await option.innerText(),/正常修改并按时完成不算/);
  assert.equal(await page.locator('.calibration-followup.is-visible').count(),0,'event is visible BEFORE confirmation');
  assert.equal(await page.evaluate(()=>__events[0].answer),null);assert.equal(await page.evaluate(()=>__completed),0);
  assert.ok(await page.locator('.calibration-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(width===390&&entry==='report'&&process.env.CALIBRATION_AUDIT_OUTPUT){fs.mkdirSync(process.env.CALIBRATION_AUDIT_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.CALIBRATION_AUDIT_OUTPUT,'owl-question-390.png')});}
  await option.click();await page.getByRole('button',{name:'大致符合',exact:true}).click();
  await page.locator('#calibrationFinish').click();await page.waitForFunction(()=>__completed===1);
  assert.equal(await page.evaluate(()=>__events[0].match_level),'partial');assert.equal(await page.evaluate(()=>JSON.stringify(__events[0].options[0])===__original),true);
  assert.equal(await page.evaluate(()=>ZhishiCalibrationModel.buildCalibrationProfile(__events).tentativePatterns.length),0);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('320/390/1280: report and AI entry show the same concrete owl event before selection; partial agreement stays partial, originals preserved, no overflow/errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
