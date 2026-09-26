const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const stems='甲乙丙丁戊己庚辛壬癸', branches='子丑寅卯辰巳午未申酉戌亥';
const validPillar = p => typeof p === 'string' && p.length === 2 && stems.includes(p[0]) && branches.includes(p[1]) && stems.indexOf(p[0]) % 2 === branches.indexOf(p[1]) % 2;
function buildCases(books, manifest) {
  const ids = new Set();
  const cases = manifest.cases.map(entry => {
    if (entry.book === 'yuanhai') throw Error('Yuanhai is excluded from the case collection');
    if (!/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)) throw Error('Invalid or duplicate case id');
    ids.add(entry.id);
    const book=books[entry.book], chapter=book?.chapters.find(c=>c.id===entry.chapter);
    if (!chapter || !Number.isInteger(entry.start) || !Number.isInteger(entry.end) || entry.start<0 || entry.end<entry.start || entry.end>=chapter.blocks.length) throw Error('Invalid case source range: '+entry.id);
    const blocks=chapter.blocks.slice(entry.start,entry.end+1);
    if (!Array.isArray(entry.sourceHashes) || blocks.length!==entry.sourceHashes.length || blocks.some((b,i)=>digest(b.text)!==entry.sourceHashes[i])) throw Error('Case source changed: '+entry.id);
    if (!Number.isInteger(entry.commentary) || entry.commentary<entry.start || entry.commentary>entry.end) throw Error('Case commentary outside source: '+entry.id);
    const comment=chapter.blocks[entry.commentary];
    if (!comment.translation) throw Error('Case translation missing: '+entry.id);
    let pillars, luck=[];
    if(entry.chart.kind==='lines') {
      if(blocks.length!==12 || blocks.slice(0,3).some(b=>!validPillar(b.text)) || blocks[3].text.length!==4) throw Error('Invalid chart layout: '+entry.id);
      pillars=blocks.slice(0,3).map(b=>b.text).concat(blocks[3].text.slice(0,2));
      luck=[blocks[3].text.slice(2)].concat(blocks.slice(4,11).map(b=>b.text));
    } else if(entry.chart.kind==='inline') {
      if(!comment.text.includes(entry.chart.text)) throw Error('Missing chart excerpt: '+entry.id);
      pillars=entry.chart.text.split('、');
    } else throw Error('Unknown chart layout');
    if(pillars.length!==4 || !pillars.every(validPillar) || !luck.every(validPillar)) throw Error('Invalid case pillars: '+entry.id);
    for(const key of ['title','summary','note']) if(typeof entry[key]!=='string'||!entry[key].trim()) throw Error('Missing case '+key);
    if(!Array.isArray(entry.tags)||!entry.tags.length||entry.tags.some(t=>typeof t!=='string'||!t.trim())) throw Error('Invalid case tags');
    const source=book.sources[chapter.sourceIndex || 0];
    return {id:entry.id,title:entry.title,summary:entry.summary,tags:entry.tags,note:entry.note,pillars,luck,
      chart:require('./library-chart-data.cjs').buildChart(pillars,luck),
      book:book.id,bookTitle:book.title,chapter:chapter.id,chapterTitle:chapter.titleSimplified||chapter.title,
      group:chapter.groupSimplified||chapter.group,sourceUrl:source.permanentUrl,edition:book.edition,
      sourceStart:entry.start,sourceEnd:entry.end,sourceHashes:entry.sourceHashes,
      sourceLink:'/library?book='+book.id+'&chapter='+chapter.id+'&block='+entry.start,
      original:blocks.map(b=>b.text).join('\n\n'),translation:comment.translation};
  });
  cases.forEach((item,index)=>{
    item.related=(manifest.cases[index].related||[]).map(id=>{
      const other=cases.find(c=>c.id===id);
      if(!other||id===item.id)throw Error('Invalid related case: '+id);
      return {id:other.id,title:other.title};
    });
  });
  return {version:manifest.version,note:'古籍命例按原书记述整理，未经独立史料核验。白话解读为知时整理稿，保留作者观点与录文疑点，供文化阅读与方法对照。',cases};
}
function main(){
  const root=path.resolve(__dirname,'..'),manifest=require('./library-cases.json'),books={};
  for(const id of new Set(manifest.cases.map(c=>c.book))) books[id]=JSON.parse(fs.readFileSync(path.join(root,'books',id+'.json'),'utf8'));
  const result=buildCases(books,manifest);fs.writeFileSync(path.join(root,'books/cases.json'),JSON.stringify(result,null,2)+'\n');
  console.log(result.cases.length+' source-bound library cases');
}
if(require.main===module)main();
module.exports={buildCases,main};
