// Offline import of MediaWiki action=parse JSON snapshots. Never runs on the server.
// Usage: node scripts/import-library.cjs <snapshot-directory>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { addSimplified } = require('./build-library-simplified.cjs');
const definitions = [
  { id: 'ditian', title: '滴天髓辑要', category: '八字', author: '题刘基著 · 清陈之遴辑', edition: '维基文库《滴天髓》页所载辑要本', description: '从天干地支到旺衰、格局与六亲，读取用论述的原文。', files: ['ditian'], start: '通天論', color: 'pine' },
  { id: 'ziwei', title: '紫微斗数全书', category: '紫微', author: '旧题陈希夷传 · 罗洪先补辑', edition: '维基文库卷一至卷三录本', description: '收录赋文、诸星问答、十二宫及行限论述。', files: ['ziwei1', 'ziwei2', 'ziwei3'], color: 'indigo' },
  { id: 'zengshan', title: '增删卜易', category: '六爻', author: '野鹤老人著 · 李文辉增删', edition: '维基文库四卷录本，保留古序及正文', description: '从装卦、用神、生克到分类占验，按章查阅。', files: ['zengshan'], start: '增刪卜易序', color: 'ochre' }
];
(async function () {
  if (!process.argv[2]) throw new Error('Provide a reviewed snapshot directory');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const catalog = [];
    for (const def of definitions) {
      const chapters = [], sources = [];
      for (const file of def.files) {
        const snapshot = JSON.parse(fs.readFileSync(path.join(process.argv[2], file + '.json'), 'utf8'));
        const html = snapshot.text['*'];
        sources.push({ title: snapshot.title, revision: snapshot.revid, url: 'https://zh.wikisource.org/wiki/' + encodeURIComponent(snapshot.title), permanentUrl: 'https://zh.wikisource.org/w/index.php?oldid=' + snapshot.revid, sha256: crypto.createHash('sha256').update(html).digest('hex') });
        await page.setContent(html);
        const parsed = await page.evaluate(({ id, start }) => {
          const root = document.querySelector('.mw-parser-output');
          root.querySelectorAll('#headerContainer,.mw-editsection,.noprint,.catlinks,.printfooter,.sistersitebox,.licenseContainer,.licensetpl,.messagebox,style,script,meta,.ws-noexport,.ws-noinclude').forEach(e => e.remove());
          let started = false, skip = false, group = '', current;
          const result = [];
          const begin = title => { current = { title, group, blocks: [] }; result.push(current); };
          const clean = e => e.innerText.replace(/\[编辑\]/g, '').trim();
          function walk(el) {
            const heading = el.matches('h1,h2,h3,h4,h5') ? el : el.classList.contains('mw-heading') ? el.querySelector('h1,h2,h3,h4,h5') : null;
            const text = clean(el);
            if (heading) {
              const title = clean(heading);
              if (title === start || !start) started = true;
              if (id === 'zengshan' && title === '錄入者言') skip = true;
              if (id === 'zengshan' && title === '增刪卜易卷之一') skip = false;
              if (!started || skip) return;
              if (/^(增刪卜易|紫微斗[數数]全[書书])卷/.test(title)) { group = title; current = null; return; }
              begin(title); return;
            }
            if (!started || skip || !text) return;
            if (/返回頂部|Public domain|此作品在全世界|此清朝作品|公有领域/.test(text) && el.matches('table,div')) return;
            if (el.matches('p') && /^.{1,30}章第[零一二三四五六七八九十百又]+$/.test(text)) { begin(text); return; }
            if (el.matches('p,pre,table,dl,ul,ol')) {
              if (!current) begin(group || '正文');
              const parts = id === 'zengshan' && text.length > 3000 ? text.split(/\n\s*\n/) : [text];
              for (const part of parts) {
                const value = part.trim();
                if (!value) continue;
                if (/^.{1,30}章第[零一二三四五六七八九十百又]+(?:﹝[^\n]+﹞|亦可以與文試看)?$/.test(value)) { begin(value); continue; }
                const type = el.matches('table') || (/[⚋⚊]/u.test(value) && value.includes('\n')) ? 'pre' : 'p';
                current.blocks.push({ type, text: value });
              }
              return;
            }
            for (const child of el.children) walk(child);
          }
          for (const child of root.children) walk(child);
          return result.filter(c => c.blocks.length);
        }, def);
        for (const chapter of parsed) {
          chapter.id = 'c-' + crypto.createHash('sha256').update(file + '/' + chapter.group + '/' + chapter.title).digest('hex').slice(0, 12);
          chapter.sourceIndex = sources.length - 1;
          chapters.push(chapter);
        }
      }
      const { files, start, ...meta } = def;
      const book = { ...meta, contentVersion: 1, retrievedAt: '2026-09-24', sources, license: { label: '古籍原作属公有领域；所用录文按 CC BY-SA 4.0 署名及相同方式共享', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans', attribution: '原作者及维基文库贡献者', changes: '知时整理目录、分章与阅读排版；移除站点导航和现代录入说明，未添加白话译文。' }, note: '保留来源录本的字形与用语，可能有录入讹误，尚未逐字对校影印底本。古籍内容供传统文化阅读，不作为医疗、投资或人生决策依据。', chapters };
      if (!chapters.length || new Set(chapters.map(c => c.id)).size !== chapters.length) throw new Error('Invalid chapters: ' + def.id);
      fs.writeFileSync(path.join(__dirname, '../books', def.id + '.json'), JSON.stringify(addSimplified(book), null, 2) + '\n');
      catalog.push({ ...meta, chapterCount: chapters.length, characters: chapters.reduce((sum, c) => sum + c.blocks.reduce((n, b) => n + b.text.length, 0), 0) });
      console.log(def.id, chapters.length, catalog.at(-1).characters, chapters.at(-1).title);
    }
    fs.writeFileSync(path.join(__dirname, '../books/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
