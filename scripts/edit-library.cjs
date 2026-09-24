// Run after both import scripts. Only reviewed boundaries are promoted to chapters.
// Usage: node scripts/edit-library.cjs <source-snapshot-directory>
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const { addSimplified } = require('./build-library-simplified.cjs');
const root = path.resolve(__dirname, '../books');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const read = id => JSON.parse(fs.readFileSync(path.join(root, id + '.json'), 'utf8'));
const small = s => s.replace(/[﹐﹑﹒﹔﹕﹖﹗︰]/g, c => ({'﹐':'，','﹑':'、','﹒':'。','﹔':'；','﹕':'：','﹖':'？','﹗':'！','︰':'：'}[c]));
function split(book, chapter, points) {
  const starts = [0, ...points], result = [], ranges = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? chapter.blocks.length;
    const blocks = chapter.blocks.slice(start, end).map(b => ({...b}));
    const title = i ? blocks[0].text.split(/\s/)[0] : chapter.title;
    const id = i ? 'c-' + hash(chapter.id + '/' + title).slice(0,12) : chapter.id;
    let skip = 0, sourceHeading;
    if (i) {
      sourceHeading = title;
      const rest = blocks[0].text.slice(title.length).trim();
      if (rest) blocks[0].text = rest;
      else { blocks.shift(); skip = 1; }
    }
    if (!blocks.length) throw Error('Empty split: ' + title);
    result.push({...chapter, id, title, sourceHeading, blocks});
    ranges.push({start, end, chapter:id, skip});
  });
  book.readingMigrations ||= {};
  book.readingMigrations[chapter.id] = ranges;
  return result;
}
async function punctuatedSanming(book, directory) {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const added = [];
  try {
    const page = await browser.newPage({javaScriptEnabled:false});
    await page.route('**/*', r => r.abort());
    const index = fs.readFileSync(path.join(directory,'sanming-qx-index.html'),'utf8');
    const links = [...index.matchAll(/href="(sanmingth\/sanmingth\d+\.html)[^"]*"[^>]*>([^<]+)/g)];
    for (let n=3; n<=107; n++) {
      const suffix = String(n).padStart(2,'0'), file = 'sanming-qx-'+suffix+'.html';
      const html = fs.readFileSync(path.join(directory,file),'utf8');
      const url = 'https://www.quanxue.cn/qt_mingxiang/sanmingth/sanmingth'+suffix+'.html';
      const fallback = links.find(x=>x[1].endsWith('sanmingth'+suffix+'.html'))?.[2];
      if (!fallback) throw Error('Missing index title ' + file);
      await page.setContent(html,{waitUntil:'domcontentloaded'});
      const parsed = await page.evaluate(fallback => {
        const root = document.querySelector('#page_global');
        if (!root) throw Error('Missing book root');
        const volume = root.querySelector('h1')?.textContent.match(/卷\s*(\d+)/)?.[1];
        if (!volume) throw Error('Missing volume');
        const chapters = []; let current;
        const begin = title => {current={title,group:'标点录本 · 卷'+Number(volume),blocks:[]};chapters.push(current)};
        for(const node of root.querySelectorAll('h2,h3,p,pre,table,.auther')) {
          if(node.parentElement.closest('p,pre,table')) continue;
          const clone=node.cloneNode(true);
          // Broken source HTML sometimes nests paragraphs inside headings.
          if(node.tagName==='H2') clone.querySelectorAll('p,h2,table,pre').forEach(e=>e.remove());
          clone.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
          const text=clone.textContent.trim();if(!text)continue;
          if(node.tagName==='H2'){begin(text);continue}
          if(!current)begin(fallback);
          current.blocks.push({type:node.matches('table,pre')?'pre':'p',text,...(node.tagName==='H3'?{isHeading:true}:{})});
        }
        return chapters.filter(c=>c.blocks.length);
      }, fallback);
      if (!parsed.length) throw Error('No body '+file);
      const sourceIndex=book.sources.length;
      book.sources.push({title:parsed[0].group+' · '+fallback,publisher:'劝学网',url,permanentUrl:url,sha256:hash(html)});
      parsed.forEach((c,i)=>added.push({...c,id:'c-'+hash('sanming-qx/'+suffix+'/'+i+'/'+c.title).slice(0,12),sourceIndex,editionKey:'punctuated'}));
    }
  } finally {await browser.close()}
  // These are different recensions: never pretend punctuation was simply added
  // to the Siku text, nor remove the longer original when adding this reading copy.
  book.chapters.forEach(c=>{c.group='四库底本 · 未点校';c.editionKey='siku'});
  book.chapters.unshift(...added);
  book.edition='劝学网标点录本；另保留维基文库四库本十二卷';
  book.editions=[{id:'punctuated',label:'标点录本'},{id:'siku',label:'四库底本'}];
  book.note='默认读带标点录本。它与四库本篇目、卷次、文字并不完全相同，不能视为四库本逐字加标点。四库本十二卷完整保留，可在版本选择中切换；该底本尚未点校。未逐字对校影印本。';
  book.license.attribution += '；新增古籍录文来源：劝学网，不包含现代解说。';
  book.license.changes += '增加独立的标点录本，未覆盖四库本；来源网站的现代介绍、译注未收录。';
}
(async()=>{
  if(!process.argv[2]) throw Error('Provide source snapshots');
  const catalog=read('catalog');
  for(const entry of catalog){
    const book=read(entry.id);
    if(book.editorialRevision===1){console.log(entry.id,'already edited');continue}
    if(book.id==='sanming') await punctuatedSanming(book,process.argv[2]);
    if(book.id==='ziwei') {
      const rules = new Map([
        ['女命骨髓赋',[2,4,6,8,10,12,14,16,20,25,30,32,36,39,41,43,45,47,49]],
        ['安身命例',[1,3,4,6,8,12,15,18,21,23,26,28,33,36,39,43,45,46,48,50,52,54,56,58,61,64,67,70,72,74,76,78,80,83,85,88,90,93,95,97,100]]
      ]);
      book.chapters=book.chapters.flatMap(c=>rules.has(c.title)?split(book,c,rules.get(c.title)):c);
      book.chapters.forEach(c=>c.blocks.forEach(b=>{
        if(/^-{10,}/.test(b.text)||(/\|/.test(b.text)&&b.text.includes('\n')))b.type='pre';
        if(b.text.length<30 && /入(?:男命|女命|命|限|命限)(?:吉凶诀|断诀|斷訣)[：:]?$/.test(b.text))b.isHeading=true;
      }));
    }
    if(book.id==='zengshan') {
      const pattern=/^(?:《星煞章》第三十三|增刪《黃金策千金賦》第三十四|升選候補章又第五十五|鬼神章一百零二|蓋造買宅賃宅第一百零六|馬房豬圈章一百十二)$/;
      book.chapters=book.chapters.flatMap(c=>{
        const points=c.blocks.map((b,i)=>pattern.test(b.text)?i:-1).filter(i=>i>0);
        return points.length?split(book,c,points):c;
      });
      book.chapters.forEach(c=>{if(/^增刪卜易卷之/.test(c.title))c.displayTitle=c.title+' · 卷首题署';
        if(/第八十二$/.test(c.title))c.editorialNote='来源录本的“行险求财”与“婚姻”均标为第八十二，保留原号，未擅自重排。';});
    }
    if(book.id==='qiongtong')book.chapters.forEach(c=>{
      const m=c.title.match(/([甲乙丙丁戊己庚辛壬癸])([木火土金水])/);
      c.group=m ? m[2]+' · '+m[1]+m[2] : /论[木火土金水]/.test(c.title)?c.title.slice(1)+' · 总论':'五行与十干总论';
    });
    if(book.id==='yuanhai') {
      // The source repeats an identical title AND body; one reading entry, old
      // URLs/bookmarks resolve to it. Never merge equal titles with unequal text.
      const seen=new Map();book.chapterAliases={};
      book.chapters=book.chapters.filter(c=>{
        const key=JSON.stringify([c.title,c.blocks.map(b=>b.text)]);
        if(seen.has(key)){book.chapterAliases[c.id]=seen.get(key);return false}
        seen.set(key,c.id);return true;
      });
    }
    book.editorialRevision=1;
    book.readingRevision=2;
    addSimplified(book);
    for(const c of book.chapters){
      c.titleSimplified=c.titleSimplified.replace(/^([一二三四五六七八九十百]+)[．.、]\s*/, '$1、');
      c.blocks.forEach(b=>{b.textSimplified=small(b.textSimplified)});
    }
    entry.edition=book.edition;entry.chapterCount=book.chapters.length;
    entry.characters=book.chapters.reduce((n,c)=>n+c.blocks.reduce((m,b)=>m+b.text.length,0),0);
    fs.writeFileSync(path.join(root,book.id+'.json'),JSON.stringify(book,null,2)+'\n');
    console.log(book.id,entry.chapterCount,entry.characters);
  }
  fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
