const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../js/library-model');
const catalog = require('../books/catalog.json');
const books = catalog.filter(b => b.availability !== 'reference').map(b => require('../books/' + b.id + '.json'));
const book = books[0], a = book.chapters[0].id, b = book.chapters[1].id;
const now = Date.now();

test('imported texts have real chapter bodies, provenance, license and stable unique chapter IDs', () => {
  assert.equal(catalog.filter(b => b.category === '八字').length, 5);
  assert.equal(books.length, 7);
  for (const entry of catalog.filter(b => b.availability !== 'reference')) {
    const value = books.find(b => b.id === entry.id);
    assert.equal(value.chapters.length, entry.chapterCount);
    assert.equal(new Set(value.chapters.map(c => c.id)).size, value.chapters.length);
    assert.ok(value.chapters.every(c => c.blocks.length && c.blocks.every(b => ['p', 'pre'].includes(b.type) && b.text.trim())));
    assert.ok(value.sources.every(s => /^https:\/\//.test(s.url) && (!s.revision || s.revision > 0) && /^[a-f0-9]{64}$/.test(s.sha256)));
    assert.match(value.license.url, /creativecommons/);
    assert.ok(entry.characters > 15000);
    assert.ok(!value.chapters.some(c => c.blocks.some(b => /\[编辑\]|返回頂部|姊妹计划|维基文库标志/.test(b.text))));
  }
});
test('ancient corpus excludes modern editorial additions and preserves hexagrams', () => {
  const zengshan = books.find(b => b.id === 'zengshan');
  assert.equal(zengshan.chapters[0].title, '增刪卜易序');
  assert.equal(zengshan.chapters.at(-1).title, '新亡附葬祖塋章第一百三十');
  assert.ok(!JSON.stringify(zengshan.chapters).match(/錄入者言|原劍增訂說明|判斷任意干支是否在六十花甲中/));
  assert.ok(zengshan.chapters.some(c => c.blocks.some(b => b.type === 'pre' && /[⚋⚊]/u.test(b.text))));
  assert.equal(books.find(b => b.id === 'ziwei').sources.length, 3);
  assert.ok(books[0].chapters.some(c => c.title === '衰旺論'));
});
test('five readable Bazi titles preserve edition coverage without the unlicensed title', async () => {
  const titles = catalog.filter(b => b.category === '八字').map(b => b.title);
  assert.deepEqual(new Set(titles), new Set(['三命通会', '滴天髓', '穷通宝鉴', '渊海子平', '子平真诠']));
  const get = id => books.find(b => b.id === id);
  const sanming = get('sanming');
  assert.equal(sanming.sources.length, 117);
  assert.equal(sanming.chapters.filter(c => c.editionKey === 'siku').length, 12);
  assert.equal(sanming.chapters.filter(c => c.editionKey === 'punctuated').length, 367);
  assert.equal(sanming.chapters.at(-1).title, '卷十二');
  assert.ok(sanming.chapters.filter(c => c.editionKey === 'siku').every(c => c.blocks.length > 50));
  assert.equal(new Set(sanming.chapters.filter(c => c.editionKey === 'punctuated').map(c => c.group)).size, 12);
  assert.match(sanming.chapters[0].blocks[0].text, /[，。；]/);
  assert.equal(get('ditian').chapters.filter(c => c.group === '辑要本').length, 51);
  assert.equal(get('ditian').chapters.length, 114);
  assert.match(get('ditian').chapters.at(-1).title, /贞元/);
  assert.equal(get('ziping').chapters.length, 47);
  assert.match(get('ziping').chapters.at(-1).title, /论杂格/);
  const yuanhai = get('yuanhai');
  assert.equal(yuanhai.sources.length, 12);
  assert.ok(yuanhai.chapters.some(c => c.group === '赋论（三）' && /相心赋/.test(c.title)));
  assert.ok(yuanhai.chapters.every(c => c.title.length < 60));
  const parts = yuanhai.sources.map((_, i) => yuanhai.chapters.filter(c => c.sourceIndex === i).map(c => c.blocks.map(b => b.text).join('')).join(''));
  assert.equal(new Set(parts).size, 12, 'different source parts must not duplicate one another');
  for (const value of books) assert.doesNotMatch(JSON.stringify(value.chapters), /中华典藏网|東里山人|最后更新时间|字數：|cite|校：/);
  assert.ok(!catalog.some(b => b.id === 'qianli'));
  assert.ok(!fs.existsSync(path.join(__dirname, '../books/qianli.json')));
  assert.equal((await harness().request('POST', 'A', {}, 'qianli')).code, 400);
});
test('simplified reading preserves source text, technical characters and chapter identity', () => {
  for (const value of books) {
    assert.equal(value.contentVersion, 2);
    assert.ok(value.chapters.every(c => c.titleSimplified && c.blocks.every(b => b.textSimplified)));
    for (const chapter of value.chapters) for (const block of chapter.blocks) {
      // Script conversion must not erase divination diagrams or change line order.
      assert.equal(block.text.match(/[⚋⚊☰☱☲☳☴☵☶☷]/gu)?.join(''), block.textSimplified.match(/[⚋⚊☰☱☲☳☴☵☶☷]/gu)?.join(''));
      assert.equal(block.text.split('\n').length, block.textSimplified.split('\n').length);
    }
  }
  assert.equal(book.chapters[0].title, '通天論');
  assert.equal(book.chapters[0].titleSimplified, '通天论');
  assert.match(book.chapters[0].blocks[0].text, /欲識三元萬物宗/);
  assert.match(book.chapters[0].blocks[0].textSimplified, /欲识三元万物宗/);
  const { addSimplified } = require('../scripts/build-library-simplified.cjs');
  const fixture = { chapters: [{ id: 'stable', title: '陰陽', blocks: [{ type: 'pre', text: '乾坤乾卦，天干地支，甲乙丙丁戊己庚辛壬癸\n子丑寅卯辰巳午未申酉戌亥，發財與頭髮，⚊⚋' }] }] };
  addSimplified(fixture);
  assert.equal(fixture.chapters[0].id, 'stable');
  assert.equal(fixture.chapters[0].blocks[0].textSimplified, '乾坤乾卦，天干地支，甲乙丙丁戊己庚辛壬癸\n子丑寅卯辰巳午未申酉戌亥，发财与头发，⚊⚋');
});
test('bookmark merge preserves independent changes and deletion tombstones', () => {
  const old = { bookmarks: { [a]: { at: now - 10, deleted: false } } };
  const next = { bookmarks: { [a]: { at: now, deleted: true }, [b]: { at: now - 5, deleted: false } } };
  const merged = model.merge(old, next, book);
  assert.deepEqual(merged, model.merge(next, old, book));
  assert.equal(merged.bookmarks[a].deleted, true);
  assert.equal(merged.bookmarks[b].deleted, false);
  assert.deepEqual(model.merge(merged, old, book), merged);
});
test('latest progress wins, invalid chapters are removed and block positions are clamped', () => {
  const first = { progress: { chapter: a, block: 0, at: now - 10 } };
  const latest = { progress: { chapter: b, block: 99999, at: now } };
  assert.deepEqual(model.merge(latest, first, book).progress, { chapter: b, block: book.chapters[1].blocks.length - 1, at: now });
  assert.equal(model.normalize({ progress: { chapter: '../../x', at: now }, bookmarks: { [a]: { at: now + 9999999 } } }, book).progress, null);
  assert.deepEqual(model.normalize({ bookmarks: { bad: { at: now }, [a]: { at: now + 9999999 } } }, book).bookmarks, {});
});

test('edited boundaries expose missing chapters, preserve diagrams and remove exact duplicate entries', () => {
  const get = id => books.find(b => b.id === id);
  for (const title of ['《星煞章》第三十三','增刪《黃金策千金賦》第三十四','鬼神章一百零二','馬房豬圈章一百十二']) {
    assert.ok(get('zengshan').chapters.some(c => c.title === title));
    assert.ok(!get('zengshan').chapters.some(c => c.blocks.some(b => b.text === title)));
  }
  assert.equal(get('ziwei').chapters.length, 149);
  assert.ok(get('ziwei').chapters.some(c => c.title === '安禄存星诀'));
  assert.ok(get('ziwei').chapters.every(c => c.blocks.every(b => !/^[-]{10,}/.test(b.text) || b.type === 'pre')));
  assert.ok(get('qiongtong').chapters.every(c => c.group));
  assert.equal(get('yuanhai').chapters.filter(c => c.title.includes('日德秀气')).length, 1);
  assert.equal(Object.keys(get('yuanhai').chapterAliases).length, 1);
  assert.ok(get('zengshan').chapters.filter(c => /第八十二$/.test(c.title)).every(c => c.editorialNote));
});

test('old positions migrate across splits once and aliases merge bookmark deletion correctly', () => {
  const value = books.find(b => b.id === 'ziwei');
  for (const [id, ranges] of Object.entries(value.readingMigrations)) {
    for (const r of ranges) {
      const oldBlock = Math.min(r.end - 1, r.start + 1);
      const normalized = model.normalize({ progress:{chapter:id,block:oldBlock,at:now} },value);
      assert.equal(normalized.progress.chapter,r.chapter);
      assert.equal(normalized.progress.block,Math.min(value.chapters.find(c => c.id === r.chapter).blocks.length-1,Math.max(0,oldBlock-r.start-r.skip)));
      assert.deepEqual(model.normalize(normalized,value),normalized);
    }
  }
  const y = books.find(b => b.id === 'yuanhai'), [oldId, target] = Object.entries(y.chapterAliases)[0];
  const normalized=model.normalize({progress:{chapter:oldId,block:1,at:now},bookmarks:{[oldId]:{at:now,deleted:true},[target]:{at:now-1,deleted:false}}},y);
  assert.equal(normalized.progress.chapter,target);
  assert.equal(normalized.bookmarks[target].deleted,true);
});

test('vernacular samples and full chapters are bound to exact original paragraphs', () => {
  const manifest=require('../scripts/library-translations.json');
  const full=require('../scripts/translations/ziping.json');
  const manuscripts=fs.readdirSync(path.join(__dirname,'../scripts/translations')).filter(f=>f.endsWith('.json')).map(f=>require('../scripts/translations/'+f));
  const crypto=require('node:crypto');
  assert.equal(manifest.entries.length,14);
  for(const sample of manifest.entries){
    const value=books.find(b=>b.id===sample.book),c=value.chapters.find(c=>c.id===sample.chapter),block=c.blocks[sample.block];
    assert.equal(crypto.createHash('sha256').update(block.text).digest('hex'),sample.sourceHash);
    const manuscript=manuscripts.find(f=>f.book===sample.book);
    const replacement=manuscript && manuscript.chapters.find(c=>c.id===sample.chapter);
    assert.equal(block.translation,replacement ? replacement.paragraphs[sample.block] : sample.text);
    assert.ok(block.translation.length>15);
    if(!value.translation.complete)assert.match(value.translation.note,/尚未提供全书/);
  }
  for(const value of books)assert.equal(value.chapters.flatMap(c=>c.blocks).filter(b=>b.translation).length,value.translation.paragraphs);
  for(const draft of manuscripts){
    const value=books.find(b=>b.id===draft.book);
    for(const entry of draft.chapters){
      const chapter=value.chapters.find(c=>c.id===entry.id);
      assert.equal(entry.title,chapter.title);
      assert.equal(entry.paragraphs.length,chapter.blocks.length);
      chapter.blocks.forEach((block,i)=>{
        assert.equal(crypto.createHash('sha256').update(block.text).digest('hex'),entry.sourceHashes[i]);
        assert.equal(block.translation,entry.paragraphs[i]);
      });
    }
  }
  const value=books.find(b=>b.id===full.book);
  assert.equal(full.chapters.length,value.chapters.length);
  assert.equal(value.translation.complete,true);
  assert.equal(value.translation.paragraphs,354);
  assert.equal(value.translation.completeChapters.length,47);
  for(const entry of full.chapters){
    const c=value.chapters.find(c=>c.id===entry.id);
    assert.equal(entry.paragraphs.length,c.blocks.length);
    c.blocks.forEach((b,i)=>{
      assert.equal(crypto.createHash('sha256').update(b.text).digest('hex'),entry.sourceHashes[i]);
      assert.equal(b.translation,entry.paragraphs[i]);
    });
  }
});

test('translation builds reject shifted, stale, duplicate and empty full-chapter drafts without mutating source',()=>{
  const {buildTranslatedBook}=require('../scripts/build-library-translations.cjs');
  const manifest=require('../scripts/library-translations.json'), full=require('../scripts/translations/ziping.json');
  const source=books.find(b=>b.id==='ziping'), before=JSON.stringify(source);
  for(const change of [
    f=>f.chapters[0].paragraphs.pop(), f=>f.chapters[0].sourceHashes.reverse(),
    f=>f.chapters.push(f.chapters[0]), f=>f.chapters[0].paragraphs[0]='',
    f=>f.chapters[0].id='missing', f=>f.book='ditian'
  ]) {const invalid=structuredClone(full);change(invalid);assert.throws(()=>buildTranslatedBook(source,manifest,invalid));}
  const stale=structuredClone(source);stale.chapters.at(-1).blocks[0].text+='源文有变';
  assert.throws(()=>buildTranslatedBook(stale,manifest,full),/source changed/);
  const output=buildTranslatedBook(source,manifest,full);
  assert.equal(JSON.stringify(source),before);
  output.chapters.forEach((c,i)=>c.blocks.forEach((b,j)=>{
    const original={...source.chapters[i].blocks[j]}, rebuilt={...b};delete original.translation;delete rebuilt.translation;
    assert.deepEqual(rebuilt,original);
  }));
  const partial=structuredClone(full);partial.chapters.pop();
  const incomplete=buildTranslatedBook(source,manifest,partial);
  assert.equal(incomplete.translation.complete,false);
  assert.equal(incomplete.translation.completeChapters.length,46);
  assert.ok(incomplete.chapters.at(-1).blocks.every(b=>!b.translation));
});

test('reading punctuation changes no original characters and preserves line and table boundaries',()=>{
  let edited=0;
  for(const value of books)for(const c of value.chapters)for(const b of c.blocks){
    if(!b.textPunctuated)continue;
    edited++;
    assert.equal(b.textPunctuated.replace(/[\s，。；：、！？]/g,''),b.text.replace(/[\s，。；：、！？]/g,''));
    assert.equal(b.textPunctuated.split('\n').length,b.text.split('\n').length);
    assert.match(b.textSimplified,/[，。：]/);
  }
  assert.equal(edited,3);
  for(const value of books)for(const c of value.chapters.filter(c=>c.editionKey!=='siku'))for(const b of c.blocks){
    if(b.type==='p'&&b.textSimplified.length>100)assert.match(b.textSimplified,/[，。；！？：]/,value.id+' '+c.title);
  }
});

function harness(options = {}) {
  const rows = new Map(); let failed = false;
  const db = { from(table) { assert.equal(table, 'user_data'); let mode = 'read', filters = {}, input;
    const query = {
      select() { return query; }, eq(k, v) { filters[k] = v; return query; },
      maybeSingle() { return query; }, update(value) { mode = 'update'; input = value; return query; }, insert(value) { mode = 'insert'; input = value; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (options.fail) return { error: { code: 'unavailable' } };
        const key = mode === 'insert' ? input.user_id + ':' + input.key : filters.user_id + ':' + filters.key;
        const old = rows.get(key);
        if (mode === 'read') return { data: old ? { value: old } : null };
        if (mode === 'insert' && old) return { error: { code: '23505' } };
        if (mode === 'update' && options.conflict && !failed) { failed = true; rows.set(key, JSON.stringify({ bookmarks: { [b]: { at: now + 1, deleted: false } } })); return { data: [] }; }
        if (mode === 'update' && old !== filters.value) return { data: [] };
        rows.set(key, input.value); return { data: [{ value: input.value }] };
      }).then(resolve, reject); }
    }; return query;
  } };
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === '../lib/auth') return { requireAuth: req => req.headers.authorization ? { uid: req.headers.authorization } : null };
    if (name === '../lib/supabase') return { getSupabase: () => options.noDB ? null : db };
    if (name === '../js/library-model') return model;
    if (name.startsWith('../books/')) return require(name);
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/library-state.js'), 'utf8'), sandbox);
  async function request(method, uid, state, id = 'ditian') {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = JSON.parse(JSON.stringify(data)); return this; } };
    await sandbox.module.exports({ method, headers: { authorization: uid }, query: { book: id }, body: { book: id, state } }, res); return res;
  }
  return { request, rows };
}
test('reading API enforces auth/book bounds, never writes another user and reports DB failure', async () => {
  const h = harness(); assert.equal((await h.request('GET', '')).code, 401);
  assert.equal((await h.request('GET', 'A', null, '../secret')).code, 400);
  assert.equal((await h.request('DELETE', 'A')).code, 405);
  assert.equal((await h.request('POST', 'A', { progress: { chapter: a, block: 3, at: now } })).code, 200);
  assert.equal((await h.request('GET', 'B')).data.state.progress, null);
  assert.equal((await h.request('GET', 'A')).data.state.progress.block, 3);
  assert.equal((await harness({ fail: true }).request('POST', 'A', {})).code, 503);
  assert.equal((await harness({ noDB: true }).request('GET', 'A')).code, 503);
});
test('reading API retries concurrent changes and preserves both devices bookmarks', async () => {
  const h = harness({ conflict: true });
  await h.request('POST', 'A', {});
  const result = await h.request('POST', 'A', { bookmarks: { [a]: { at: now, deleted: false } } });
  assert.equal(result.code, 200);
  assert.equal(result.data.state.bookmarks[a].deleted, false);
  assert.equal(result.data.state.bookmarks[b].deleted, false);
});
test('library files are public but source scripts and traversal remain private', () => {
  const { resolvePublicFile } = require('../lib/static-security');
  const root = path.resolve(__dirname, '..');
  assert.equal(resolvePublicFile(root, '/books/ditian.json'), path.join(root, 'books/ditian.json'));
  assert.equal(resolvePublicFile(root, '/library.html'), path.join(root, 'library.html'));
  assert.equal(resolvePublicFile(root, '/books/../.env'), null);
  assert.equal(resolvePublicFile(root, '/scripts/import-library.cjs'), null);
});
