const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {buildCases}=require('../scripts/build-library-cases.cjs');
const manifest=require('../scripts/library-cases.json');
const books={ditian:require('../books/ditian.json'),ziping:require('../books/ziping.json')};

test('new paired cases keep complete luck boundaries and distinguish multiple changed pillars',()=>{
 const cases=buildCases(books,manifest).cases,get=id=>cases.find(c=>c.id===id);
 assert.equal(get('dt-gangrou-fire').luck.length,7);
 assert.equal(get('dt-xianshen-protection').luck.length,7);
 assert.equal(get('dt-xianshen-missing').luck.length,6);
 const dry=get('dt-zaoshi-parched-wood'),wet=get('dt-zaoshi-rooted-wood');
 assert.deepEqual(dry.pillars,['癸未','丁巳','甲午','庚午']);
 assert.deepEqual(wet.pillars,['癸丑','丁巳','甲辰','庚午']);
 assert.deepEqual(wet.pillars.map((p,i)=>p===dry.pillars[i]?null:i).filter(i=>i!==null),[0,2]);
 assert.match(wet.note,/同时更换年支和日支/);
 assert.equal(dry.related[0].id,wet.id);assert.equal(wet.related[0].id,dry.id);
 assert.match(get('dt-xianshen-missing').translation,/没有明确事件或死因/);
 assert.equal(get('dt-suiyun-metal-needed').category,'timing');
 assert.equal(get('dt-suiyun-metal-unwanted').related[0].id,'dt-suiyun-metal-needed');
});
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
test('all eighty-seven collected cases retain exact sources, current translations, editions and stable source links',()=>{
  const result=buildCases(books,manifest);
  assert.deepEqual(result,require('../books/cases.json'));
  assert.equal(result.cases.length,87);assert.equal(new Set(result.cases.map(c=>c.id)).size,87);
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

test('editorial categories cover every case once without removing cross-topic tags or source pairing',()=>{
  const result=buildCases(books,manifest);
  assert.equal(result.categories.length,6);
  assert.equal(result.categories.reduce((sum,c)=>sum+c.count,0),87);
  for(const group of result.categories){
    assert.ok(group.count>0);assert.equal(group.count,result.cases.filter(c=>c.category===group.id).length);
  }
  for(const c of result.cases){
    assert.equal(result.categories.filter(g=>g.id===c.category).length,1);
    assert.deepEqual(c.tags,manifest.cases.find(e=>e.id===c.id).tags);
  }
  const invalid=structuredClone(manifest);invalid.cases[0].category='not-listed';
  assert.throws(()=>buildCases(books,invalid),/Invalid case category/);
  const duplicates=structuredClone(manifest);duplicates.categories.push(duplicates.categories[0]);
  assert.throws(()=>buildCases(books,duplicates),/Invalid case categories/);
});

test('new comparison cases retain all changed pillars, variable luck lengths and unverified predictions',()=>{
  const cases=buildCases(books,manifest).cases;
  const a=cases.find(c=>c.id==='dt-bage-protect-seal'),b=cases.find(c=>c.id==='dt-bage-feed-wealth');
  assert.deepEqual(a.pillars.slice(0,3),b.pillars.slice(0,3));
  assert.equal(a.pillars[3],'壬戌');assert.equal(b.pillars[3],'甲寅');
  assert.match(b.note,/实际时干也由壬变甲/);
  assert.ok(a.related.some(c=>c.id===b.id));assert.ok(b.related.some(c=>c.id===a.id));
  const follow=cases.find(c=>c.id==='dt-fang-follow-wood');assert.equal(follow.luck.length,8);
  const early=cases.find(c=>c.id==='dt-fang-hai-support');assert.equal(early.luck.length,7);assert.equal(early.luck[0],'辛卯');
  const fire=cases.find(c=>c.id==='dt-bage-wet-earth');assert.equal(fire.luck.length,6);assert.equal(fire.luck.at(-1),'甲子');assert.match(fire.note,/评语另提癸亥/);
  const prediction=cases.find(c=>c.id==='dt-bage-no-seal');assert.match(prediction.translation,/后续预测/);assert.match(prediction.note,/没有后来反馈/);
});

test('Tiyong through birth-hour drafts keep missing charts, unclear sex and time subdivisions out of case facts',()=>{
  const result=buildCases(books,manifest).cases;
  const chapter=books.ditian.chapters.find(c=>c.id==='c-266a6ea7399b');
  assert.match(chapter.blocks[19].translation,/没有附这一例的完整四柱/);
  const tiyong=result.filter(c=>c.chapter===chapter.id);
  assert.equal(tiyong.length,1);assert.equal(tiyong[0].sourceEnd,18);
  assert.deepEqual(tiyong[0].pillars,['丙寅','甲午','丙午','癸巳']);
  assert.ok(!tiyong[0].original.includes('丙火生于初秋'));
  const spirit=result.find(c=>c.id==='dt-jingshen-connected');
  assert.equal(spirit.chart.pillars[3].god,'食神');assert.match(spirit.note,/定义不一致/);
  const drained=result.find(c=>c.id==='dt-jingshen-drained');
  assert.match(drained.note,/不据此填性别/);assert.ok(!Object.hasOwn(drained,'gender'));
  const hour=books.ditian.chapters.find(c=>c.id==='c-31de9527b4ff');
  assert.match(hour.blocks[1].translation,/不换算成现代分钟/);
  assert.ok(!result.some(c=>c.chapter===hour.id));
  const a=result.find(c=>c.id==='dt-yueling-transform'),b=result.find(c=>c.id==='dt-yueling-overcontrol');
  assert.deepEqual(a.pillars,['甲戌','丙寅','戊寅','丙辰']);
  assert.deepEqual(b.pillars,['甲戌','丙寅','戊辰','庚申']);
  assert.match(b.note,/日支寅变辰，时柱丙辰变庚申/);
});

test('strength examples preserve the twenty-case sequence, disputed luck and roots despite editorial labels',()=>{
  const result=buildCases(books,manifest).cases,series=result.filter(c=>c.chapter==='c-a9167d092c85');
  assert.equal(series.length,20);
  series.forEach((c,i)=>{assert.equal(c.sourceStart,3+i*10);assert.equal(c.sourceEnd,12+i*10);assert.equal(c.luck.length,6);assert.equal(c.related.length,1);});
  const find=id=>result.find(c=>c.id===id);
  const fire=find('dt-sw-fire-follow');
  assert.deepEqual(fire.luck,['戊午','己未','庚申','辛酉','癸亥','壬戌']);assert.match(fire.note,/次序|顺序/);
  const disputed=find('dt-sw-fire-weak-water');assert.equal(disputed.luck[1],'乙未');assert.match(disputed.original,/初运己未/);assert.match(disputed.note,/乙未.*己未/);
  const water=find('dt-sw-water-follow');assert.equal(water.luck[4],'戊午');assert.match(water.original,/戌午运/);assert.ok(!water.luck.includes('戌午'));
  const root=find('dt-sw-wood-weak-metal');assert.ok(root.chart.pillars[3].hidden.some(h=>h.gan==='乙'));assert.match(root.note,/未中没有乙/);
  const month=find('dt-zhonghe-pressure');assert.ok(month.chart.pillars[2].hidden.some(h=>h.gan==='乙'));assert.match(month.note,/人格批评/);
  assert.match(find('dt-sw-earth-follow').note,/总论“似水”、本例“似金”/);
});

test('six- and eight-step source tables end at their own commentary, retaining recorded anomalies',()=>{
  const cases=buildCases(books,manifest).cases;
  const cold=cases.find(c=>c.id==='dt-cold-wood-fire');
  assert.deepEqual(cold.pillars,['癸巳','癸亥','甲寅','壬申']);
  assert.deepEqual(cold.luck,['壬戌','辛酉','庚申','己未','戊午','丁巳']);
  const water=cases.find(c=>c.id==='dt-water-fire-clash');
  assert.equal(water.luck.length,8);assert.equal(water.luck[2],'己亥');
  assert.match(water.note,/己亥/);assert.match(water.translation,/不连贯/);
  const entry=manifest.cases.find(c=>c.id===cold.id);
  assert.throws(()=>buildCases(books,{...manifest,cases:[{...entry,commentary:entry.end-1}]}),/Invalid chart layout/);
  const changed=structuredClone(books),chapter=changed.ditian.chapters.find(c=>c.id===entry.chapter);
  chapter.blocks[entry.start+4].text='前例结束';
  const amended=structuredClone(entry);amended.related=[];
  amended.sourceHashes=chapter.blocks.slice(entry.start,entry.end+1).map(b=>require('node:crypto').createHash('sha256').update(b.text).digest('hex'));
  assert.throws(()=>buildCases(changed,{...manifest,cases:[amended]}),/Invalid case pillars/);
});
