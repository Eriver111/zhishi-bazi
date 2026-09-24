const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {addSimplified}=require('./build-library-simplified.cjs');
const manifest=require('./library-punctuation.json');
const root=path.resolve(__dirname,'../books');
const bare=s=>s.replace(/[\s，。；：、！？]/g,'');
for(const id of new Set(manifest.entries.map(e=>e.book))){
  const file=path.join(root,id+'.json'),book=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const e of manifest.entries.filter(e=>e.book===id)){
    const block=book.chapters.find(c=>c.id===e.chapter)?.blocks[e.block];
    if(!block || crypto.createHash('sha256').update(block.text).digest('hex')!==e.sourceHash || bare(e.text)!==bare(block.text))throw Error('Punctuation changes characters: '+e.chapter);
    block.textPunctuated=e.text;
  }
  addSimplified(book);
  fs.writeFileSync(file,JSON.stringify(book,null,2)+'\n');
}
