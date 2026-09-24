// Isolated browser fixture: no real server, credentials, accounts or APIs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const model = require('../js/library-model');
const root = path.resolve(__dirname, '..');
const ditian = require('../books/ditian.json');
const auth = `window.__testUser=null;window.__testLogin=[];window.Auth={getUser:()=>window.__testUser,getToken:()=>window.__testUser?'test-'+window.__testUser.id:'',ready:f=>f(),onLogin:f=>window.__testLogin.push(f)};window.testIdentity=id=>{window.dispatchEvent(new Event('zhishi:identitychange'));window.__testUser=id?{id}:null;window.__testLogin.forEach(f=>f());};`;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [], cloud = new Map(); let failSync = false, slowSync = false;
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.hostname !== 'library.test') return route.abort();
        if (u.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: auth });
        if (u.pathname === '/api/library-state') {
          const data = req.postDataJSON(), book = require('../books/' + data.book + '.json'), key = req.headers().authorization + ':' + data.book;
          const merged = model.merge(cloud.get(key), data.state, book); cloud.set(key, merged);
          if (slowSync) await new Promise(r => setTimeout(r, 900));
          return route.fulfill({ status: failSync ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failSync ? { error: 'fixture unavailable' } : { state: merged }) });
        }
        if (u.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: '{}' });
        const relative = u.pathname === '/library' ? 'library.html' : u.pathname.slice(1);
        if (!/^(library.html|css\/|js\/|books\/|images\/library\/|icon.svg)/.test(relative)) return route.abort();
        const file = path.join(root, relative); if (!fs.existsSync(file)) return route.abort();
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
        return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
      });
      await page.goto('https://library.test/library'); await page.waitForSelector('.book-card');
      assert.equal(await page.locator('.book-card').count(), 7);
      await page.locator('[data-category="八字"]').click(); assert.equal(await page.locator('.book-card').count(), 5);
      assert.equal(await page.locator('.book-card').filter({ hasText: '千里命稿' }).count(), 0);
      await page.locator('.library-hero-art').evaluate(img => img.decode());
      assert.ok(await page.locator('.library-hero-art').evaluate(img => img.naturalWidth > 0));
      await page.locator('.book-art').first().evaluate(img => img.decode());
      await page.locator('[data-category="六爻"]').click(); assert.equal(await page.locator('.book-card').count(), 1);
      await page.locator('#bookSearch').fill('不存在的书'); assert.equal(await page.locator('.book-card').count(), 0);
      await page.locator('#bookSearch').fill(''); await page.locator('[data-category="全部"]').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.book-card').first().click(); await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent === '通天论'); await page.waitForTimeout(220);
      await page.locator('#bookmarkButton').click(); assert.equal(await page.locator('#bookmarkButton').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#chapterBody [data-block="0"]').innerText(), ditian.chapters[0].blocks[0].textSimplified);
      const savedBeforeScript = await page.evaluate(() => localStorage.getItem('zhishi_library_v1:guest:ditian'));
      await page.locator('#scriptButton').click(); await page.waitForTimeout(220);
      assert.equal(await page.locator('#chapterTitle').innerText(), ditian.chapters[0].title);
      assert.equal(await page.locator('#chapterBody [data-block="0"]').innerText(), ditian.chapters[0].blocks[0].text);
      assert.equal(await page.evaluate(() => localStorage.getItem('zhishi_library_v1:guest:ditian')), savedBeforeScript);
      await page.reload(); await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent === '通天論'); await page.waitForTimeout(220);
      await page.locator('#contentsButton').click(); assert.match(await page.locator('#chapterList a').first().innerText(), /通天論/); await page.keyboard.press('Escape');
      await page.locator('#scriptButton').click(); await page.waitForTimeout(220);
      assert.equal(await page.locator('#chapterTitle').innerText(), ditian.chapters[0].titleSimplified);
      await page.locator('#contentsButton').click(); assert.match(await page.locator('#chapterList a').first().innerText(), /通天论/); await page.keyboard.press('Escape');
      assert.ok(await page.locator('.reader-toolbar').evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.locator('#largerFont').click(); assert.equal(await page.locator('#chapterBody').evaluate(el => getComputedStyle(el).fontSize), '22px');
      await page.locator('#themeButton').click(); assert.ok(await page.locator('body').evaluate(el => el.classList.contains('library-night')));
      await page.locator('#contentsButton').click(); await page.locator('#savedChapters').click(); assert.equal(await page.locator('#chapterList a').count(), 1);
      await page.keyboard.press('Escape'); await page.locator('#contentsButton').click(); await page.locator('#allChapters').click(); await page.locator('#chapterList a').nth(2).click(); await page.waitForTimeout(300);
      assert.equal(await page.locator('#chapterTitle').innerText(), ditian.chapters[2].titleSimplified);
      if (width === 390) {
        await page.locator('#contentsButton').click(); await page.locator('#allChapters').click(); await page.locator('#chapterList a').first().click(); await page.waitForTimeout(250);
        await page.locator('[data-block="10"]').evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 100, behavior: 'instant' })); await page.waitForTimeout(350);
        const before = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishi_library_v1:guest:ditian')).progress.block);
        assert.ok(before >= 9);
        await page.reload(); await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent === '通天论'); await page.waitForTimeout(300);
        const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zhishi_library_v1:guest:ditian')).progress.block);
        assert.equal(after, before); assert.ok(await page.evaluate(() => scrollY > 100));
        await page.evaluate(() => window.dispatchEvent(new Event('zhishi:identitychange'))); await page.waitForTimeout(300);
        await page.locator('#contentsButton').click(); await page.locator('#chapterList a').nth(2).click(); await page.waitForTimeout(250);
      }
      // Chapter query represents explicit navigation; shelf continuation restores saved chapter.
      await page.locator('#backToShelf').click(); await page.locator('#continueReading').click(); await page.waitForTimeout(300);
      assert.equal(await page.locator('#chapterTitle').innerText(), ditian.chapters[2].titleSimplified);
      await page.locator('#sourceButton').click(); assert.equal(await page.locator('#bookSource a').count(), ditian.sources.length + 1); await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.reload(); await page.waitForFunction(title => document.querySelector('#chapterTitle').textContent === title, ditian.chapters[2].titleSimplified); await page.waitForTimeout(230);
      // Guest records must never be silently imported into the next account.
      await page.evaluate(() => testIdentity('A')); await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent === '通天论'); await page.waitForTimeout(230);
      assert.equal(await page.locator('#bookmarkButton').getAttribute('aria-pressed'), 'false');
      await page.locator('#bookmarkButton').click(); await page.waitForTimeout(1550);
      assert.equal(cloud.get('Bearer test-A:ditian').bookmarks[ditian.chapters[0].id].deleted, false);
      // Failed sync retains local data and offers retry, never reports cloud success.
      failSync = true; await page.locator('#bookmarkButton').click(); await page.waitForTimeout(1550);
      assert.match(await page.locator('#readingStatus').innerText(), /同步暂未成功/); assert.equal(await page.locator('#retrySync').isVisible(), true);
      failSync = false; await page.locator('#retrySync').click(); await page.waitForTimeout(200); assert.match(await page.locator('#readingStatus').innerText(), /已同步/);
      // Delayed old-account responses cannot overwrite the new account's view.
      slowSync = true; await page.locator('#retrySync').evaluate(el => el.click()); await page.evaluate(() => testIdentity('B')); await page.waitForTimeout(1250);
      assert.equal(await page.locator('#bookmarkButton').getAttribute('aria-pressed'), 'false');
      slowSync = false; await page.evaluate(() => testIdentity(null)); await page.waitForFunction(title => document.querySelector('#chapterTitle').textContent === title, ditian.chapters[2].titleSimplified);
      assert.equal(await page.locator('#chapterTitle').innerText(), ditian.chapters[2].titleSimplified);
      assert.deepEqual(errors, []);
      for (const id of ['sanming', 'qiongtong', 'yuanhai', 'ziping']) {
        const book = require('../books/' + id + '.json'), last = book.chapters.at(-1);
        await page.goto('https://library.test/library?book=' + id + '&chapter=' + last.id);
        await page.waitForFunction(title => document.querySelector('#chapterTitle').textContent === title, last.titleSimplified);
        assert.equal(await page.locator('#chapterBody [data-block="0"]').innerText(), last.blocks[0].textSimplified);
        await page.locator('#contentsButton').click(); assert.equal(await page.locator('#chapterList a').count(), last.editionKey ? book.chapters.filter(c=>c.editionKey===last.editionKey).length : book.chapters.length); await page.keyboard.press('Escape');
        await page.locator('#sourceButton').click(); assert.equal(await page.locator('#bookSource a').count(), book.sources.length + 1); await page.keyboard.press('Escape');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      // Parallel reading never substitutes or duplicates original paragraphs.
      await page.goto('https://library.test/library?book=ditian&chapter=' + ditian.chapters[0].id);
      await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent === '通天论'); await page.waitForTimeout(250);
      await page.locator('#parallelMode').click(); await page.waitForTimeout(250);
      assert.equal(await page.locator('.reading-pair').count(),2);
      assert.equal(await page.locator('#chapterBody [data-block="0"]>p').innerText(),ditian.chapters[0].blocks[0].textSimplified);
      assert.equal(await page.locator('#chapterBody [data-block="0"] .vernacular p').innerText(),ditian.chapters[0].blocks[0].translation);
      await page.reload(); await page.waitForSelector('.reading-pair'); await page.waitForTimeout(250);
      assert.equal(await page.locator('#parallelMode').getAttribute('aria-pressed'),'true');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.LIBRARY_SCREENSHOT_DIR) { fs.mkdirSync(process.env.LIBRARY_SCREENSHOT_DIR,{recursive:true}); await page.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'parallel-'+width+'.png')}); }
      // A whole-book draft must cover every paragraph, including the final
      // chapter, and must not advertise the full chapter as a partial sample.
      const ziping=require('../books/ziping.json');
      for (const c of [ziping.chapters[0],ziping.chapters.at(-1)]) {
        await page.goto('https://library.test/library?book=ziping&chapter='+c.id);
        await page.waitForSelector('.reading-pair');await page.waitForTimeout(250);
        assert.equal(await page.locator('.reading-pair').count(),c.blocks.length);
        assert.equal(await page.locator('#chapterBody [data-block="0"]>p').innerText(),c.blocks[0].textSimplified);
        assert.equal(await page.locator('#chapterBody [data-block="0"] .vernacular p').innerText(),c.blocks[0].translation);
        assert.match(await page.locator('#translationStatus').innerText(),/已全部配译/);
        assert.equal(await page.locator('#translationStatus a').count(),0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(process.env.LIBRARY_SCREENSHOT_DIR && c===ziping.chapters[0])await page.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'ziping-'+width+'.png')});
      }
      await page.locator('#sourceButton').click();assert.match(await page.locator('#bookSource').innerText(),/47 篇均已逐段配译/);await page.keyboard.press('Escape');
      await page.locator('#backToShelf').click();assert.match(await page.locator('.book-translation').innerText(),/47 篇白话对照/);
      const sanming=require('../books/sanming.json');
      await page.goto('https://library.test/library?book=sanming&chapter='+sanming.chapters[0].id);
      await page.waitForFunction(() => document.querySelector('#chapterTitle').textContent==='论五行生成'); await page.waitForTimeout(250);
      assert.match(await page.locator('#translationStatus').innerText(),/尚未收录/);
      await page.locator('#translationStatus a').click(); await page.waitForSelector('.reading-pair'); await page.waitForTimeout(250);
      assert.equal(await page.locator('#chapterTitle').innerText(),'论五行生克');
      await page.locator('#editionSelect').selectOption('siku'); await page.waitForFunction(()=>document.querySelector('#chapterTitle').textContent==='卷一');await page.waitForTimeout(250);
      await page.locator('#contentsButton').click();assert.equal(await page.locator('#chapterList a').count(),12);await page.keyboard.press('Escape');
      await page.locator('#editionSelect').selectOption('punctuated');await page.waitForFunction(()=>document.querySelector('#chapterTitle').textContent==='论五行生成');await page.waitForTimeout(250);
      await page.locator('#contentsButton').click();assert.equal(await page.locator('#chapterList a').count(),367);await page.keyboard.press('Escape');
      await page.locator('#ancientMode').click();await page.waitForTimeout(250);
      assert.deepEqual(errors, []);
      if (process.env.LIBRARY_SCREENSHOT_DIR) { fs.mkdirSync(process.env.LIBRARY_SCREENSHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.LIBRARY_SCREENSHOT_DIR, 'reader-' + width + '.png') }); await page.locator('#backToShelf').click(); for (const art of await page.locator('.book-art').all()) { await art.scrollIntoViewIfNeeded(); await art.evaluate(img => img.decode()); } await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(process.env.LIBRARY_SCREENSHOT_DIR, 'shelf-' + width + '.png'), fullPage: true }); }
      console.log('PASS', width, 'shelf, reader, controls, restoration, account isolation, failed sync, delayed response');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
