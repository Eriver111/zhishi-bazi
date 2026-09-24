const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const {createDailyStore,chartIdentity} = require('../lib/daily-fortune-store');
const {narrativePlan,acceptRewrite,generateDailyCopy} = require('../api/_daily-fortune-copy');
const daily = require('../api/_daily-fortune');
const runtime = require('../api/_bazi-runtime');
const id = 'a'.repeat(64), date='2026-09-24';
const output = tip => ({headline:'固定标题',tip,basis:['合成测试依据']});
async function fixture(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'zhishi-daily-store-'));
  t.after(async()=>{assert.equal(path.dirname(directory),await fs.realpath(os.tmpdir()));await fs.rm(directory,{recursive:true,force:true});});
  return directory;
}

test('same-process concurrent requests generate once and return the identical edition',async t=>{
  const store=createDailyStore(await fixture(t));let calls=0;
  const generate=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return output('第一版');};
  const results=await Promise.all(Array.from({length:12},()=>store.getOrCreate(date,id,generate)));
  assert.equal(calls,1);
  assert.ok(results.every(row=>row.output.tip==='第一版'));
  assert.equal((await store.getOrCreate(date,id,()=>output('不应替换'))).output.tip,'第一版');
});

test('independent workers racing publication both serve the winning complete snapshot',async t=>{
  const directory=await fixture(t),a=createDailyStore(directory),b=createDailyStore(directory);
  let ready=0,release;const barrier=new Promise(resolve=>release=resolve);
  const generate=tip=>async()=>{if(++ready===2)release();await barrier;return output(tip);};
  const [left,right]=await Promise.all([a.getOrCreate(date,id,generate('甲版')),b.getOrCreate(date,id,generate('乙版'))]);
  assert.deepEqual(left.output,right.output);
  assert.ok(['甲版','乙版'].includes(left.output.tip));
  assert.equal((await fs.readdir(directory)).filter(file=>file.endsWith('.tmp')).length,0);
});

test('a fresh process reads the saved wording without regeneration',async t=>{
  const directory=await fixture(t);await createDailyStore(directory).getOrCreate(date,id,()=>output('重启仍是这一版'));
  const modulePath=require.resolve('../lib/daily-fortune-store');
  const script=`require(${JSON.stringify(modulePath)}).createDailyStore(${JSON.stringify(directory)}).getOrCreate(${JSON.stringify(date)},${JSON.stringify(id)},()=>{throw new Error('must not regenerate')}).then(row=>process.stdout.write(JSON.stringify(row.output)))`;
  const saved=JSON.parse(cp.execFileSync(process.execPath,['-e',script],{encoding:'utf8'}));
  assert.equal(saved.tip,'重启仍是这一版');
});

test('new date creates a new edition but code changes cannot overwrite the same date',async t=>{
  const store=createDailyStore(await fixture(t));
  await store.getOrCreate(date,id,()=>output('旧规则版'));
  assert.equal((await store.getOrCreate(date,id,()=>output('新规则版'))).output.tip,'旧规则版');
  assert.equal((await store.getOrCreate('2026-09-25',id,()=>output('第二天'))).output.tip,'第二天');
});

test('corrupt storage fails closed instead of manufacturing a different edition',async t=>{
  const directory=await fixture(t);let called=false;
  await fs.writeFile(path.join(directory,date+'-'+id+'.json'),'broken');
  await assert.rejects(createDailyStore(directory).getOrCreate(date,id,()=>{called=true;return output('新版');}));
  assert.equal(called,false);
});

test('unwritable destination fails before generation and public-root paths are rejected',async t=>{
  const directory=await fixture(t),blocked=path.join(directory,'file');await fs.writeFile(blocked,'x');let called=false;
  await assert.rejects(createDailyStore(blocked).getOrCreate(date,id,()=>{called=true;return output('临时版');}));
  assert.equal(called,false);
  await assert.rejects(createDailyStore(path.resolve(__dirname,'..')).read(date,id),/public web root/);
  await assert.rejects(createDailyStore(directory).read(date,'../elsewhere'),/Invalid daily snapshot key/);
});

test('retention only removes old owned snapshot files and preserves current day',async t=>{
  const directory=await fixture(t),store=createDailyStore(directory);
  await store.getOrCreate('2026-08-01',id,()=>output('过期版'));
  await fs.writeFile(path.join(directory,'unrelated.txt'),'保留');
  await store.getOrCreate(date,id,()=>output('今天'));
  assert.equal(await store.read('2026-08-01',id),null);
  assert.equal((await store.read(date,id)).tip,'今天');
  assert.equal(await fs.readFile(path.join(directory,'unrelated.txt'),'utf8'),'保留');
});

test('normalized identity ignores parameter order and equivalent clock spelling, but not birth minutes',()=>{
  const query='year=1990&month=5&day=10&hour=6&clock=11&minute=30&gender=male&solar=0';
  const first=runtime.chartFromQuery(query);
  const reordered=runtime.chartFromQuery(query.split('&').reverse().join('&')+'&label=other');
  const decimal=runtime.chartFromQuery(query.replace('clock=11&minute=30','clock=11.5'));
  assert.equal(chartIdentity(first),chartIdentity(reordered));
  assert.equal(chartIdentity(first),chartIdentity(decimal));
  assert.notEqual(chartIdentity(first),chartIdentity(runtime.chartFromQuery(query.replace('minute=30','minute=45'))));
  assert.notEqual(chartIdentity(first),chartIdentity(runtime.chartFromQuery(query.replace('gender=male','gender=female'))));
});

function factsFixture() {
  return {tendency:'需要留意',focus:['相处与日常安排'],decision:{hasTrigger:true},
    day:{gan:'壬',zhi:'子',ganReview:{level:'中性双向'},zhiReview:{level:'中性双向'}},
    allEvents:[{id:'natal-zhi-午',symbol:'午',strong:true,risk:true,layer:'地支',types:['六冲'],domains:['相处与日常安排'],
      detail:'流日子与夫妻宫午有六冲关系；涉及原局喜用，需要留意其承接是否受影响'}]};
}
const acceptedText='流日子与夫妻宫午是六冲关系。这条关系涉及原局喜用，重点是其承接条件，不直接断定现实结果。';

test('AI rewrites one referenced relation while conclusion and other fields stay engine-owned',async()=>{
  let request;
  const result=await generateDailyCopy(factsFixture(),null,{apiKey:'synthetic',fetch:async(_url,options)=>{
    request=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({id:'lead',text:acceptedText})}}]})};
  }});
  assert.equal(request.model,'deepseek-v4-flash');
  assert.equal(request.temperature,0);
  assert.equal(result.copySource,'ai-rewrite');
  assert.ok(result.tip.includes(acceptedText));
  assert.match(result.headline,/六冲/);
  assert.match(result.tip,/原局所忌|喜用承接/);
});

for(const text of ['流日子与午是六冲，今天必定破财，夫妻关系也会分手。',
  '流日子与夫妻宫午是六冲关系，另外寅申相冲已导致严重失业。',
  '流日子与夫妻宫午已经六合成局，今天一定顺利。']) {
  test('reject unsupported daily additions: '+text.slice(0,16),()=>{
    assert.equal(acceptRewrite(JSON.stringify({id:'lead',text}),narrativePlan(factsFixture(),null)),null);
  });
}

test('an AI failure freezes the fallback edition even if the provider recovers later',async t=>{
  const store=createDailyStore(await fixture(t));let recoveredCalled=false;
  const first=await store.getOrCreate(date,id,async()=>({...await generateDailyCopy(factsFixture(),null,{apiKey:'synthetic',fetch:async()=>{throw new Error('offline');}}),basis:['合成依据']}));
  const later=await store.getOrCreate(date,id,async()=>{recoveredCalled=true;return output('模型恢复后的另一种措辞');});
  assert.equal(first.output.copySource,'rules');assert.equal(recoveredCalled,false);assert.deepEqual(first.output,later.output);
});

test('a continuous month varies by relationship evidence and honestly identifies repeated themes',async()=>{
  const chart=runtime.chartFromQuery('year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0');
  function at(day) {return daily.buildDailyFacts(runtime.calculator,chart.bazi,chart.gender,{yearNumber:2026,monthNumber:9,dayNumber:day,
    year:runtime.calendar.getYearPillar(2026,9,day,12),month:runtime.calendar.getMonthPillar(2026,9,day,12,12),day:runtime.calendar.getDayPillar(2026,9,day)});}
  const topics=new Set();let previous=null;
  for(let day=1;day<=30;day++) {
    const facts=at(day),plan=narrativePlan(facts,previous);
    const first=await generateDailyCopy(facts,previous,{apiKey:''});
    const repeat=await generateDailyCopy(facts,previous,{apiKey:''});
    assert.deepEqual(first,repeat);
    topics.add(plan.topicKey);
    if(plan.lead) assert.ok(first.tip.includes(plan.lead.detail));
    if(previous&&narrativePlan(previous,null).topicKey===plan.topicKey) assert.match(first.tip,/延续昨天的同类主题/);
    previous=facts;
  }
  assert.ok(topics.size>=6,'semantic topics must change beyond mere synonyms or date labels');
});
