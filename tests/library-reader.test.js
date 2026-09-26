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

test('Ditian has 51 Jiyao plus six Chanwei chapters with 401 source-bound paragraphs; whole Chanwei remains incomplete',()=>{
 const book=read('books/ditian.json'),draft=read('scripts/translations/ditian.json');
 assert.equal(draft.chapters.length,57);assert.equal(book.translation.complete,false);
 assert.equal(book.translation.paragraphs,401);assert.equal(book.translation.completeChapters.length,57);
 assert.match(book.translation.note,/阐微其余57篇尚未整章配译/);
 draft.chapters.forEach((entry,i)=>{
  const c=book.chapters[i];assert.equal(entry.id,c.id);assert.equal(entry.title,c.title);assert.equal(entry.paragraphs.length,c.blocks.length);
  c.blocks.forEach((block,j)=>{
   assert.equal(entry.sourceHashes[j],crypto.createHash('sha256').update(block.text).digest('hex'));
   assert.equal(block.translation,entry.paragraphs[j]);assert.ok(block.translation.trim());
   assert.notEqual(block.translation,block.textSimplified||block.text);
  });
 });
 assert.ok(book.chapters.slice(57).every(c=>c.blocks.every(b=>!b.translation)));
 const card=read('books/catalog.json').find(b=>b.id==='ditian');assert.equal(card.translation.completeChapters,57);assert.equal(card.translation.complete,false);
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
