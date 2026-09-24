// Import reviewed public-domain texts from local source snapshots, never at runtime.
// Usage: node scripts/import-bazi-library.cjs <snapshot-directory>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { addSimplified } = require('./build-library-simplified.cjs');
const directory = process.argv[2];
const output = path.join(__dirname, '../books');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const wikiLicense = { label: '古籍原作公有领域；维基文库录文按 CC BY-SA 4.0 共享', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans', attribution: '原作者及维基文库贡献者', changes: '整理目录、分章及阅读排版，保留古文，不添加白话译文。' };
const ancientLicense = { label: '收录古籍原文，原作属于公有领域', url: 'https://creativecommons.org/publicdomain/mark/1.0/deed.zh-hans', attribution: '古籍原作者；录文来源逐章注明。未将来源网站或其现代解说声明为开放许可。', changes: '仅整理古籍正文，排除网站导航和现代编者说明；未添加白话译文。' };
const note = '保留来源录本用语，可能存在录入讹误，尚未逐字对校影印底本。古籍内容供传统文化阅读，不作为医疗、投资或人生决策依据。';

(async () => {
  if (!directory) throw new Error('Provide a reviewed snapshot directory');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.route('**/*', route => route.abort());
    const catalog = JSON.parse(fs.readFileSync(path.join(output, 'catalog.json'), 'utf8')).filter(b => b.id !== 'qianli');
    async function parse(book, file, mode, title, group, url) {
      const capture = path.join(directory, file + '.web.txt');
      const useCapture = mode === 'ziping' && fs.existsSync(capture);
      const raw = fs.readFileSync(useCapture ? capture : path.join(directory, file + (mode.startsWith('wiki') ? '.json' : '.html')), 'utf8');
      const snapshot = mode.startsWith('wiki') ? JSON.parse(raw) : null;
      const html = snapshot ? snapshot.text['*'] : raw;
      const source = snapshot ? { title: snapshot.title, publisher: '维基文库', revision: snapshot.revid, url: 'https://zh.wikisource.org/wiki/' + encodeURIComponent(snapshot.title), permanentUrl: 'https://zh.wikisource.org/w/index.php?oldid=' + snapshot.revid } : { title, publisher: mode === 'yuanhai-qx' ? '劝学网' : '中华典藏', url, permanentUrl: url };
      source.sha256 = hash(html);
      if (useCapture) source.captureFormat = 'web text snapshot';
      await page.setContent(useCapture ? '' : html, { waitUntil: 'domcontentloaded' });
      const chapters = useCapture ? (() => {
        const lines = raw.replace(/ (L\d+:)/g, '\n$1').split('\n').filter(l => /^L\d+:/.test(l));
        const start = lines.findIndex(l => /^L\d+: # /.test(l));
        const end = lines.findIndex((l, i) => i > start && l.includes('上一章'));
        if (start < 0 || end < 0) throw new Error('Incomplete capture: ' + file);
        const body = lines.slice(start + 1, end);
        const first = Number(lines[start].match(/^L(\d+)/)[1]);
        // Long page truncation must fail rather than publish a missing middle.
        body.forEach((l, i) => { if (Number(l.match(/^L(\d+)/)[1]) !== first + i + 1) throw new Error('Truncated capture: ' + file); });
        const blocks = body.map(l => l.replace(/^L\d+: ?/, '').replace(/[a-zA-Z0-9]{3}中华典藏网/g, '').trim()).filter(Boolean).map(text => ({ type: 'p', text }));
        return [{ title, group, blocks }];
      })() : await page.evaluate(({ mode, title, group }) => {
        const result = []; let current, buffer = '';
        const begin = name => { current = { title: name, group: group || '', blocks: [] }; result.push(current); };
        const block = text => { text = text.trim(); if (!text) return; if (!current) begin(title); current.blocks.push({ type: 'p', text }); };
        const flush = () => { block(buffer); buffer = ''; };
        if (mode === 'wiki-siku') {
          const root = document.querySelector('.poem');
          if (!root) throw new Error('Missing Siku text');
          // Wiki anchors also mark verse lines and inline terms. They are not
          // chapter boundaries: keep each of the twelve source volumes intact.
          begin(title);
          function walk(node) {
            if (node.nodeType === Node.TEXT_NODE) { buffer += node.textContent; return; }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches('img')) {
              const alt = node.getAttribute('alt') || '';
              if (!alt) throw new Error('Image character has no text equivalent');
              buffer += alt.includes(' -- ') ? alt.split(' -- ').at(-1) : '〔' + alt + '〕'; return;
            }
            if (node.matches('br')) { flush(); return; }
            for (const child of node.childNodes) walk(child);
          }
          walk(root); flush();
        } else if (mode === 'wiki') {
          const root = document.querySelector('.mw-parser-output');
          root.querySelectorAll('#headerContainer,.mw-editsection,.noprint,.catlinks,.licenseContainer,.licensetpl,.messagebox,style,script,.ws-noexport,.ws-noinclude').forEach(e => e.remove());
          let started = false;
          function walk(el) {
            const heading = el.matches('h1,h2,h3,h4,h5') ? el : el.classList.contains('mw-heading') ? el.querySelector('h1,h2,h3,h4,h5') : null;
            if (heading) {
              const text = heading.textContent.trim(); started = true;
              if (/^(通神论|六亲论)$/.test(text)) { group = '阐微本 · ' + text; current = null; return; }
              begin(text); return;
            }
            if (!started) return;
            if (el.matches('p,pre,table,dl,ul,ol')) { block(el.innerText); return; }
            for (const child of el.children) walk(child);
          }
          for (const child of root.children) walk(child);
        } else if (mode === 'yuanhai-qx') {
          const root = document.querySelector('#page_global');
          if (!root) throw new Error('Missing source text');
          for (const el of root.querySelectorAll('h2,p')) {
            if (el.matches('h2')) {
              const heading = el.cloneNode(true);
              heading.querySelectorAll('p,h2').forEach(n => n.remove());
              begin(heading.textContent.trim());
            } else block(el.innerText);
          }
        } else {
          const root = document.querySelector('#pageview');
          if (!root) throw new Error('Missing ancient text');
          root.querySelectorAll('script,style,[style*="display:none"],[style*="display: none"]').forEach(el => el.remove());
          begin(title);
          for (const el of root.querySelectorAll('p')) {
            const text = el.innerText.trim();
            // Only standalone section titles. Never turn a verse beginning with
            // book brackets into a heading and lose the rest of the paragraph.
            if (mode === 'yuanhai' && /^(?:内十八格|外十八格)?《[^》]{2,35}》(?:诗诀|各有所喜所害例)?$/.test(text)) begin(text);
            else block(text);
          }
        }
        return result.filter(c => c.blocks.length);
      }, { mode, title, group });
      if (!chapters.length) throw new Error('Empty source ' + file);
      for (const [index, chapter] of chapters.entries()) {
        chapter.id = 'c-' + hash(file + '/' + chapter.group + '/' + chapter.title + '/' + index).slice(0, 12);
        chapter.sourceIndex = book.sources.length;
        book.chapters.push(chapter);
      }
      book.sources.push(source);
    }
    function make(meta, license = wikiLicense) { return { category: '八字', ...meta, retrievedAt: '2026-09-24', license: { ...license }, note, sources: [], chapters: [] }; }
    function save(book) {
      if (!book.chapters.length || new Set(book.chapters.map(c => c.id)).size !== book.chapters.length) throw new Error('Invalid chapter identity: ' + book.id);
      if (book.chapters.some(c => !c.title || c.title.length > 100)) throw new Error('Invalid heading: ' + book.id);
      fs.writeFileSync(path.join(output, book.id + '.json'), JSON.stringify(addSimplified(book), null, 2) + '\n');
      const entry = Object.fromEntries(['id', 'title', 'category', 'author', 'edition', 'description', 'color'].map(k => [k, book[k]]));
      entry.chapterCount = book.chapters.length;
      entry.characters = book.chapters.reduce((n, c) => n + c.blocks.reduce((m, b) => m + b.text.length, 0), 0);
      const index = catalog.findIndex(b => b.id === book.id);
      if (index < 0) catalog.push(entry); else catalog[index] = entry;
      console.log(book.id, entry.chapterCount, entry.characters);
    }
    const sanming = make({ id: 'sanming', title: '三命通会', author: '明 · 万民英', edition: '四库全书本十二卷录文，未加现代标点', description: '十二卷汇集五行、干支、格局与诸家赋论，按卷查阅。', color: 'ochre' });
    for (let n = 1; n <= 12; n++) await parse(sanming, 'sanming-siku' + n, 'wiki-siku', '卷' + ['一','二','三','四','五','六','七','八','九','十','十一','十二'][n - 1], '四库全书本');
    save(sanming);
    const ditian = JSON.parse(fs.readFileSync(path.join(output, 'ditian.json'), 'utf8'));
    // Keep the original 51 IDs, source text and paragraph order for saved progress.
    ditian.chapters = ditian.chapters.filter(c => c.sourceIndex === 0);
    ditian.sources = ditian.sources.slice(0, 1);
    ditian.chapters.forEach(c => { c.group = '辑要本'; });
    Object.assign(ditian, { title: '滴天髓', author: '旧题刘基 · 陈之遴辑要 · 任铁樵阐微', edition: '辑要本与任铁樵《滴天髓阐微》分列阅读', description: '保留辑要原文，补入任氏阐微的通神论、六亲论与命例。' });
    await parse(ditian, 'ditian-chanwei', 'wiki', '滴天髓阐微', '阐微本'); save(ditian);
    const qiongtong = make({ id: 'qiongtong', title: '穷通宝鉴', author: '清 · 余春台辑', edition: '维基文库录本，按十干与四季分节', description: '从五行总论到十干四时，阅读调候取用的原文。', color: 'pine' });
    await parse(qiongtong, 'qiongtong', 'wiki', '五行总论', ''); save(qiongtong);
    const yuanhai = make({ id: 'yuanhai', title: '渊海子平', author: '旧题宋 · 徐升编', edition: '劝学网分类录本，十二类篇目', description: '基础、十神、神煞、六亲、女命、赋论、格局与诗诀。', color: 'indigo' }, ancientLicense);
    const groups = ['基础','十神','神煞','六亲','女命','赋论（一）','赋论（二）','赋论（三）','赋论（四）','赋论（五）','格局','诗诀'];
    for (let n = 1; n <= 12; n++) await parse(yuanhai, 'yuanhai-qx-' + n, 'yuanhai-qx', groups[n - 1], groups[n - 1], 'https://www.quanxue.cn/qt_mingxiang/yuanhaizp/yuanhaizp' + String(n).padStart(2, '0') + '.html');
    save(yuanhai);
    const ziping = make({ id: 'ziping', title: '子平真诠', author: '清 · 沈孝瞻', edition: '中华典藏四十七篇正文录本，保留录本古籍附文', description: '以月令用神为纲，讨论格局成败、救应与行运。', color: 'pine' }, ancientLicense);
    const zipingManifest = JSON.parse(fs.readFileSync(path.join(directory, 'ziping-dc-manifest.json'), 'utf8'));
    for (const job of zipingManifest.slice(3, 50)) await parse(ziping, job.id, 'ziping', job.title, '', job.url);
    save(ziping);
    const order = ['ditian', 'sanming', 'qiongtong', 'yuanhai', 'ziping', 'ziwei', 'zengshan'];
    catalog.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
