const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {splitBook}=require('../scripts/build-library-reader.cjs');
const model=require('../js/library-model.js');

test('all on-demand Sanming chapters reproduce both archival editions without dropping text or metadata',()=>{
 const book=read('books/sanming.json'), result=splitBook(book), index=read('books/reader/sanming/index.json');
 assert.deepEqual(index,result.index);assert.equal(index.chapters.length,379);
 const rebuilt={...index,chapters:index.chapters.map(meta=>{
  const chunk=read('books/reader/sanming/'+meta.id+'.json');
  assert.equal(chunk.book,book.id);assert.equal(chunk.id,meta.id);assert.equal(chunk.blocks.length,meta.blockCount);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(chunk)).digest('hex').slice(0,16),meta.revision);
  const {blockCount,revision,...original}=meta;return {...original,blocks:chunk.blocks};
 })};
 delete rebuilt.readerFormat;assert.deepEqual(rebuilt,book);
 const firstBytes=fs.statSync(path.join(root,'books/reader/sanming/index.json')).size+fs.statSync(path.join(root,'books/reader/sanming',index.chapters[0].id+'.json')).size;
 assert.ok(firstBytes<200000);assert.ok(firstBytes<fs.statSync(path.join(root,'books/sanming.json')).size/20);
});

test('unloaded chapter metadata preserves bookmark and progress normalization across editions',()=>{
 const book=read('books/sanming.json'), index=splitBook(book).index, now=Date.now();
 for(const c of book.chapters){
  const record={revision:book.readingRevision,progress:{chapter:c.id,block:c.blocks.length-1,at:now},bookmarks:{[c.id]:{at:now,deleted:false}}};
  assert.deepEqual(model.normalize(record,index),model.normalize(record,book));
  assert.deepEqual(model.merge(record,{},index),model.merge(record,{},book));
 }
});

test('the collected Ditian edition has all 114 chapters and 5944 source-bound paragraphs translated',()=>{
 const book=read('books/ditian.json'),draft=read('scripts/translations/ditian.json');
 assert.equal(draft.chapters.length,114);assert.equal(book.translation.complete,true);
 assert.equal(book.translation.paragraphs,5944);assert.equal(book.translation.totalParagraphs,5944);assert.equal(book.translation.completeChapters.length,114);
 assert.match(book.translation.note,/114 篇均已逐段配译/);assert.match(book.translation.note,/不代表覆盖其他版本/);
 draft.chapters.forEach((entry,i)=>{
  const c=book.chapters[i];assert.equal(entry.id,c.id);assert.equal(entry.title,c.title);assert.equal(entry.paragraphs.length,c.blocks.length);
  c.blocks.forEach((block,j)=>{
   assert.equal(entry.sourceHashes[j],crypto.createHash('sha256').update(block.text).digest('hex'));
   assert.equal(block.translation,entry.paragraphs[j]);assert.ok(block.translation.trim());
   assert.notEqual(block.translation,block.textSimplified||block.text);
  });
 });
 assert.ok(book.chapters.every(c=>c.blocks.every(b=>b.translation)));
 const card=read('books/catalog.json').find(b=>b.id==='ditian');assert.deepEqual(card.translation,{complete:true,completeChapters:114,paragraphs:5944});
});

test('late-book merged chart rows remain source-bound without shifting year, hour or luck positions',()=>{
 const book=read('books/ditian.json');
 const officials=book.chapters[105],temperament=book.chapters[108],rank=book.chapters[111];
 assert.equal(officials.blocks[33].text,'甲寅丙子');assert.match(officials.blocks[33].translation,/年柱甲寅；月柱丙子/);
 assert.equal(officials.blocks[35].text,'己巳丁丑');assert.match(officials.blocks[35].translation,/时柱：己巳；原录第一步大运：丁丑/);
 assert.equal(temperament.blocks[19].text,'癸亥壬戌');assert.match(temperament.blocks[19].translation,/第四步癸亥；第五步壬戌/);
 assert.match(temperament.blocks[20].translation,/第六步大运：辛酉/);
 assert.equal(temperament.blocks[308].text,'壬辰乙未丙申');assert.match(temperament.blocks[308].translation,/时柱壬辰；第一步大运乙未；第二步大运丙申/);
 assert.match(temperament.blocks[309].translation,/第三步大运：丁酉/);
 assert.equal(rank.blocks[6].translation,'时柱：戊午。');assert.ok(!rank.blocks[6].translation.includes('大运'));
});

test('whole-book drafts preserve mismatched commentaries, invalid source pillars and competing blade conventions',()=>{
 const book=read('books/ditian.json'),cases=read('books/cases.json');
 const mixed=book.chapters[103];
 for(const i of [52,62])assert.match(mixed.blocks[i].translation,/错配|错置/);
 const invalid=book.chapters[109];assert.equal(invalid.blocks[84].text,'午辰庚戌');
 assert.match(invalid.blocks[90].translation,/首字不是天干/);
 assert.ok(!cases.cases.some(c=>c.chapter===mixed.id&&[43,53].includes(c.sourceStart)));
 assert.ok(!cases.cases.some(c=>c.chapter===invalid.id&&c.sourceStart===81));
 assert.match(book.chapters[111].blocks[25].translation,/阴干也论刃/);
 assert.match(book.chapters[111].blocks[25].translation,/不据此自动更改网站规则/);
 const {buildTranslatedBook}=require('../scripts/build-library-translations.cjs'),manifest=read('scripts/library-translations.json'),draft=read('scripts/translations/ditian.json');
 const changed=structuredClone(book);changed.chapters[113].blocks[2].text+='变';
 assert.throws(()=>buildTranslatedBook(changed,manifest,draft),/source changed/);
 const missing=structuredClone(draft);missing.chapters[113].paragraphs.pop();
 assert.throws(()=>buildTranslatedBook(book,manifest,missing),/count changed/);
});

test('changing a translated source fails; stale paragraph substitutions cannot silently survive',()=>{
 const {buildTranslatedBook}=require('../scripts/build-library-translations.cjs');
 const source=read('books/ditian.json'),manifest=read('scripts/library-translations.json'),draft=read('scripts/translations/ditian.json');
 const changed=structuredClone(source);changed.chapters[35].blocks[1].text+='变';
 assert.throws(()=>buildTranslatedBook(changed,manifest,draft),/source changed/);
 const missing=structuredClone(draft);missing.chapters[50].paragraphs.pop();
 assert.throws(()=>buildTranslatedBook(source,manifest,missing),/count changed/);
 assert.deepEqual(buildTranslatedBook(source,manifest,draft),source);
});

test('Gan-Zhi and Forms drafts retain all 51 chart tables, source order and anomalous recorded luck',()=>{
 const book=read('books/ditian.json');let tables=0,rows=0;
 for(const chapter of book.chapters.slice(59,61)){
  for(let i=0;i<chapter.blocks.length;i++){
   const hour=chapter.blocks[i];
   if(!/^(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]){2}$/.test(hour.text))continue;
   tables++;
   for(let offset=0;offset<3;offset++){
    const b=chapter.blocks[i-3+offset];
    assert.equal(b.translation,['年柱','月柱','日柱'][offset]+'：'+b.text+'。');rows++;
   }
   assert.ok(hour.translation.startsWith('时柱：'+hour.text.slice(0,2)+'；原录第一步大运：'+hour.text.slice(2)+'。'));rows++;
   let end=i+1;
   while(end<chapter.blocks.length&&/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(chapter.blocks[end].text)){
    const b=chapter.blocks[end];assert.ok(b.translation.startsWith('原录第'+(end-i+1)+'步大运：'+b.text+'。'));rows++;end++;
   }
   assert.ok(chapter.blocks[end].translation.length>30,'each table retains its own full commentary');
  }
 }
 assert.equal(tables,51);assert.equal(rows,468);
 const general=book.chapters[59],forms=book.chapters[60];
 for(const [index,pillar] of [[107,'己酉'],[166,'己巳'],[184,'乙巳']]){
  assert.ok(general.blocks[index].translation.includes('原录“'+pillar+'”'));
  assert.match(general.blocks[index].translation,/不顺接/);
 }
 assert.match(general.blocks[98].translation,/原局并无子/);
 assert.match(forms.blocks[119].translation,/盘表未、丑、子、未不合/);
 assert.match(forms.blocks[127].translation,/原录“乙亥”/);
});

test('Qiongtong draft covers the collected edition and preserves the source order of all example tables',()=>{
 const book=read('books/qiongtong.json'),draft=read('scripts/translations/qiongtong.json');
 assert.equal(book.chapters.length,47);assert.equal(draft.chapters.length,47);
 assert.equal(book.translation.complete,true);assert.equal(book.translation.paragraphs,605);
 assert.equal(book.translation.completeChapters.length,47);
 assert.equal(book.chapters.flatMap(c=>c.blocks).filter(b=>b.translation).length,605);
 let examples=0;
 for(const c of book.chapters)for(const block of c.blocks){
  for(const match of block.text.matchAll(/时日月年\s+([^\s]{4})\s+([^\s]{4})/g)){
   const pillars=[0,1,2,3].map(i=>match[1][i]+match[2][i]).join('、');
   assert.ok(block.translation.includes(pillars),c.title+': shifted or silently corrected example '+pillars);
   examples++;
  }
 }
 assert.equal(examples,183);
 const card=read('books/catalog.json').find(b=>b.id==='qiongtong');
 assert.deepEqual(card.translation,{complete:true,completeChapters:47,paragraphs:605});
 const {buildTranslatedBook}=require('../scripts/build-library-translations.cjs');
 assert.deepEqual(buildTranslatedBook(book,read('scripts/library-translations.json'),draft),book);
});
