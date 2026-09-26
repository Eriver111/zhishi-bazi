const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildCases}=require('../scripts/build-library-cases.cjs');
const manifest=require('../scripts/library-cases.json');
const books={ditian:require('../books/ditian.json'),ziping:require('../books/ziping.json')};
test('case chart facts use the normal chart engine, preserving day-master and hidden-stem semantics',()=>{
  const {buildChart}=require('../scripts/library-chart-data.cjs');
  const chart=buildChart(['丁亥','庚戌','甲辰','壬申'],['己酉','戊申']);
  assert.deepEqual(chart.pillars.map(p=>p.god),['伤官','七杀','日主','偏印']);
  assert.deepEqual(chart.pillars[1].hidden,[{gan:'戊',element:'土',god:'偏财'},{gan:'辛',element:'金',god:'正官'},{gan:'丁',element:'火',god:'伤官'}]);
  assert.equal(chart.pillars[3].star,'绝');assert.equal(chart.pillars[3].seat,'长生');
  assert.equal(chart.luck[0].god,'正财');assert.equal(chart.luck[0].star,'胎');
  assert.deepEqual(buildChart(['壬申','癸丑','己丑','甲戌'],[]).luck,[]);
  assert.throws(()=>buildChart(['壬申','癸丑','己丑','甲丑'],[]),/Invalid/);
  for(const item of buildCases(books,manifest).cases){
    assert.deepEqual(item.chart.pillars.map(p=>p.gan+p.zhi),item.pillars);
    assert.deepEqual(item.chart.luck.map(p=>p.gan+p.zhi),item.luck);
    assert.equal(item.chart.pillars[2].god,'日主');
    assert.deepEqual(Object.keys(item.chart).sort(),['luck','pillars']);
  }
});
test('all twelve published cases retain exact sources, current translations, editions and stable source links',()=>{
  const result=buildCases(books,manifest);
  assert.deepEqual(result,require('../books/cases.json'));
  assert.equal(result.cases.length,12);assert.equal(new Set(result.cases.map(c=>c.id)).size,12);
  assert.deepEqual(new Set(result.cases.map(c=>c.book)),new Set(['ditian','ziping']));
  result.cases.forEach((c,i)=>{
    const entry=manifest.cases[i],chapter=books[c.book].chapters.find(ch=>ch.id===c.chapter);
    assert.equal(c.original,chapter.blocks.slice(entry.start,entry.end+1).map(b=>b.text).join('\n\n'));
    assert.equal(c.translation,chapter.blocks[entry.commentary].translation);
    const url=new URL(c.sourceLink,'https://example.test');assert.equal(url.searchParams.get('block'),String(entry.start));
    assert.equal(c.sourceUrl,books[c.book].sources[chapter.sourceIndex||0].permanentUrl);
    c.related.forEach(r=>assert.ok(result.cases.some(other=>other.id===r.id&&other.title===r.title)));
    assert.ok(!Object.hasOwn(c,'birthDate'));assert.ok(!Object.hasOwn(c,'verifiedOutcome'));
  });
});
test('chart extraction separates hour from first luck pillar, and keeps an alternative hour out of the chart',()=>{
  const result=buildCases(books,manifest).cases;
  const dong=result.find(c=>c.id==='dt-zhiming-dong');
  assert.deepEqual(dong.pillars,['庚申','庚辰','戊辰','戊午']);assert.equal(dong.luck[0],'辛巳');assert.equal(dong.luck.length,8);
  const hour=result.find(c=>c.id==='zp-hour-error');assert.deepEqual(hour.pillars,['壬申','癸丑','己丑','甲戌']);
  assert.ok(hour.original.includes('乙亥'));assert.deepEqual(hour.luck,[]);
  assert.ok(!result.some(c=>c.original.includes('辛酉壬戌')),'dangling unannotated chart must not inherit preceding commentary');
  const compared=result.find(c=>c.id==='dt-liqi-tuiqi');assert.equal(compared.related[0].id,'dt-liqi-jinqi');
});
test('case build rejects stale source, missing translation, duplicate ids, guessed chart and excluded source',()=>{
  const entry=manifest.cases[0],changed=structuredClone(books);
  changed.ditian.chapters.find(c=>c.id===entry.chapter).blocks[entry.start].text='庚午';
  assert.throws(()=>buildCases(changed,manifest),/source changed/);
  const untranslated=structuredClone(books);delete untranslated.ditian.chapters.find(c=>c.id===entry.chapter).blocks[entry.commentary].translation;
  assert.throws(()=>buildCases(untranslated,manifest),/translation missing/);
  assert.throws(()=>buildCases(books,{...manifest,cases:[entry,entry]}),/duplicate/);
  assert.throws(()=>buildCases(books,{...manifest,cases:[{...entry,book:'yuanhai'}]}),/excluded/);
  const inline=manifest.cases.find(c=>c.id==='zp-hour-error');
  assert.throws(()=>buildCases(books,{...manifest,cases:[{...inline,chart:{kind:'inline',text:'壬申、癸丑、己丑、乙亥'}}]}),/Missing chart/);
  assert.throws(()=>buildCases(books,{...manifest,cases:[{...entry,related:['not-a-case']}]}),/Invalid related/);
});
test('case page is publicly routed while editorial source manifests stay private',()=>{
  const {resolvePublicFile}=require('../lib/static-security');const root=path.resolve(__dirname,'..');
  for(const file of ['/library-cases.html','/js/library-cases.js','/css/library-cases.css','/books/cases.json'])assert.ok(fs.existsSync(resolvePublicFile(root,file)));
  assert.equal(resolvePublicFile(root,'/scripts/library-cases.json'),null);
  assert.equal(resolvePublicFile(root,'/books/../scripts/library-cases.json'),null);
});
