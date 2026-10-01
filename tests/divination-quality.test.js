const test=require('node:test'),assert=require('node:assert/strict');
const {cleanReading,readingIssue}=require('../lib/divination-quality');
test('divination rejects medical specifics and guarantees, preserves concrete adverse readings',()=>{
 for(const s of ['建议去医院检查。','本年可能有肺部问题。','项目验收没问题，最终能交差。','待复核后再分析','体用比和，说明大家实力不差、地位也平等。'])assert.ok(readingIssue(s));
 assert.equal(readingIssue('家人身体状况变化可能打乱日常安排。先明确由谁接送，再安排原有任务。'),'');
 assert.equal(readingIssue('这次分工的阻力主要在交接反复：父母爻受克，文档标准容易来回修改。'),'');
 assert.equal(cleanReading('```json\n{"reading":"**核心判断**\\n先明确分工"}\n```'),'核心判断\n先明确分工');
});

const paths={auth:require.resolve('../lib/auth'),db:require.resolve('../lib/supabase'),guard:require.resolve('../lib/ai-abuse-guard'),endpoint:require.resolve('../api/divination')};
async function harness(run){
 const previous={fetch:global.fetch,cache:{}};for(const [k,p] of Object.entries(paths))previous.cache[k]=require.cache[p];
 const state={charges:0,releases:0,calls:0,guardOk:true,answers:['先确定各自负责的内容，再约定合并文档的标准，避免交接后反复返工。'],paid:false,messages:[]};
 const set=(p,exports)=>require.cache[p]={id:p,filename:p,loaded:true,exports};
 try{
  set(paths.auth,{requireAuth:()=>({uid:'synthetic-divination-qa'})});
  set(paths.guard,{beginAiRequest:()=>state.guardOk?{ok:true,release:()=>state.releases++}:{ok:false,reason:'concurrent'}});
  set(paths.db,{isMonthlyActiveByUserId:async()=>false,isMonthlyActive:async()=>false,
   trackFreeUsageByUser:async()=>({used:state.paid?99:0}),getUserCredits:async()=>3,
   bumpFreeUsageByUser:async()=>{state.charges++;},deductCreditByUser:async()=>{state.charges++;return true;},deductCredit:async()=>null,saveUserChatHistory:async()=>{}});
  global.fetch=async(_u,o)=>{state.calls++;state.messages.push(JSON.parse(o.body).messages);assert.equal(state.charges,0,'generation must precede charging');if(state.networkFail)throw Error('offline');return {ok:true,json:async()=>({choices:[{message:{content:state.answers[Math.min(state.calls-1,state.answers.length-1)]}}]})};};
  delete require.cache[paths.endpoint];const handler=require(paths.endpoint);
  const invoke=async()=>{const res={statusCode:200,setHeader(){},status(c){this.statusCode=c;return this;},json(x){this.body=x;return x;}};await handler({method:'POST',headers:{},body:{prompt:'【排盘专业数据】合成验收：下周小组课程作业怎么安排分工？'}},res);return res;};
  await run(state,invoke);
 }finally{global.fetch=previous.fetch;for(const [k,p]of Object.entries(paths)){if(previous.cache[k])require.cache[p]=previous.cache[k];else delete require.cache[p];}}
}
test('failed or empty generation never consumes credit and always releases request slot',async()=>{
 await harness(async(s,invoke)=>{s.networkFail=true;assert.equal((await invoke()).statusCode,500);assert.equal(s.charges,0);assert.equal(s.releases,1);});
 await harness(async(s,invoke)=>{s.answers=[''];assert.equal((await invoke()).statusCode,502);assert.equal(s.calls,2);assert.equal(s.charges,0);assert.equal(s.releases,1);});
});
test('one corrected reading consumes exactly one credit; no forced lunar month',async()=>harness(async(s,invoke)=>{
 s.paid=true;s.answers.unshift('核心结论：肯定能成，这次项目验收没问题。');
 const res=await invoke();assert.equal(res.statusCode,200);assert.equal(s.calls,2);assert.equal(s.charges,1);assert.equal(s.releases,1);assert.doesNotMatch(res.body.reading,/肯定能成/);
 const system=s.messages[0][0].content;assert.match(system,/当前北京时间日期：\d{4}-\d{2}-\d{2}/);assert.match(system,/不強制农历月份|不强制农历月份/);assert.match(system,/不得提供医疗建议/);
}));
test('repeated unsafe output and concurrent rejection consume no credit',async()=>{
 await harness(async(s,invoke)=>{s.answers=['建议去医院检查，确定具体病因。'];assert.equal((await invoke()).statusCode,502);assert.equal(s.charges,0);});
 await harness(async(s,invoke)=>{s.guardOk=false;assert.equal((await invoke()).statusCode,429);assert.equal(s.calls,0);assert.equal(s.charges,0);});
});
