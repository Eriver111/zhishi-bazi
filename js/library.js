(function () {
  'use strict';
  var model = window.LibraryModel, catalog = [], books = {}, states = {}, hydrated = {}, category = '全部';
  var current = null, chapterIndex = 0, routeEpoch = 0, identityEpoch = 0, owner = 'guest', token = '';
  var syncTimer, scrollTimer, restoring = false, showSaved = false, lastStamp = 0, localOK = true;
  var $ = function (id) { return document.getElementById(id); };
  function element(tag, text, className) { var el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function storageKey(id) { return 'zhishi_library_v1:' + owner + ':' + id; }
  function state(book) { if (!states[book.id]) states[book.id] = model.normalize(read(storageKey(book.id)), book); return states[book.id]; }
  function stamp() { lastStamp = Math.max(Date.now(), lastStamp + 1); return lastStamp; }
  function persist(book) { localOK = write(storageKey(book.id), state(book)); }
  function status(message) { $('readingStatus').textContent = message; }
  function localMessage() { return localOK ? (owner === 'guest' ? '进度与收藏已保存在此浏览器，登录后使用独立的账号书架。' : '已保存在本机，等待账号同步。') : '浏览器未允许保存，关闭页面后可能无法恢复阅读记录。'; }
  async function json(url, options, timeout) {
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, timeout || 12000);
    try { var response = await fetch(url, Object.assign({}, options, { signal: controller.signal })); if (!response.ok) throw new Error('请求未成功'); return await response.json(); }
    finally { clearTimeout(timer); }
  }
  async function loadBook(id) {
    if (!catalog.some(function (b) { return b.id === id && b.availability !== 'reference'; })) throw new Error('这本书暂未开放正文，请返回书架查看书目说明。');
    if (!books[id]) {
      var value = await json(id === 'sanming' ? '/books/reader/sanming/index.json?v=9' : '/books/' + id + '.json?v=9');
      if (value.id !== id || !Array.isArray(value.chapters) || !value.chapters.length) throw new Error('书籍正文暂时无法读取。');
      books[id] = value;
    }
    return books[id];
  }
  async function loadChapter(book, chapter) {
    if (Array.isArray(chapter.blocks)) return;
    if (book.readerFormat !== 1 || !/^c-[a-f0-9]+$/.test(chapter.id)) throw new Error('章节目录暂时无法读取。');
    var value = await json('/books/reader/' + book.id + '/' + chapter.id + '.json?v=' + encodeURIComponent(chapter.revision), null, 30000);
    if (value.book !== book.id || value.id !== chapter.id || !Array.isArray(value.blocks) || value.blocks.length !== chapter.blockCount) throw new Error('章节内容与目录不一致，请刷新后重试。');
    chapter.blocks = value.blocks;
  }
  async function sync(book) {
    var capturedEpoch = identityEpoch, capturedOwner = owner, capturedToken = token;
    if (!capturedToken || capturedOwner === 'guest') { if (current === book) status(localMessage()); return; }
    try {
      var result = await json('/api/library-state', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + capturedToken }, body: JSON.stringify({ book: book.id, state: state(book) }) }, 4500);
      if (capturedEpoch !== identityEpoch || capturedToken !== token) return;
      var latest = state(book);
      states[book.id] = model.merge(latest, result.state, book); persist(book);
      var pending = JSON.stringify(states[book.id]) !== JSON.stringify(model.normalize(result.state, book));
      if (current === book) { status(pending ? localMessage() : localOK ? '阅读进度与收藏已同步到账号。' : '已同步到账号；此浏览器未允许保存本机副本。'); $('retrySync').hidden = !pending; if (!restoring) updateBookmark(); }
      if (pending) queueSync(book);
    } catch (_) {
      if (capturedEpoch !== identityEpoch || capturedToken !== token) return;
      if (current === book) { status(localOK ? '已保存在本机，账号同步暂未成功。' : '本机保存与账号同步均未成功，请重试。'); $('retrySync').hidden = false; }
    }
  }
  function queueSync(book) { clearTimeout(syncTimer); if (token) syncTimer = setTimeout(function () { sync(book); }, 1400); }
  function remember(block) {
    if (!current || restoring) return;
    var record = state(current), chapter = current.chapters[chapterIndex];
    if (record.progress && record.progress.chapter === chapter.id && record.progress.block === block) return;
    record.progress = { chapter: chapter.id, block: block, at: stamp() }; persist(current); status(localMessage()); queueSync(current);
  }
  function visibleBlock() {
    if (!current || restoring || $('reader').hidden) return;
    var nodes = $('chapterBody').children, index = 0;
    for (var i = 0; i < nodes.length; i++) { if (nodes[i].getBoundingClientRect().top <= 125) index = i; else break; }
    remember(index);
  }
  function url(book, chapter) { return '/library?book=' + encodeURIComponent(book) + (chapter ? '&chapter=' + encodeURIComponent(chapter) : ''); }
  function navigate(href) { visibleBlock(); clearTimeout(syncTimer); if (current) sync(current); history.pushState(null, '', href); route(); }
  function renderShelf() {
    var query = $('bookSearch').value.trim().toLowerCase(), grid = $('bookGrid'); grid.replaceChildren();
    var shown = catalog.filter(function (b) { return (category === '全部' || b.category === category) && [b.title, b.author, b.description, b.category].join(' ').toLowerCase().includes(query); });
    shown.forEach(function (book) {
      var reference = book.availability === 'reference';
      var link = element('a', undefined, 'book-card');
      if (reference) { link.href = book.referenceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      else { link.href = url(book.id); link.dataset.libraryLink = 'true'; }
      var cover = element('div', undefined, 'book-cover ' + book.color); cover.setAttribute('aria-hidden', 'true');
      var artwork = element('img', undefined, 'book-art');
      artwork.src = '/images/library/' + (book.color === 'indigo' ? 'stars-v1.webp' : 'mountains-v1.webp');
      artwork.alt = ''; artwork.width = 480; artwork.height = 720; artwork.loading = 'lazy'; artwork.decoding = 'async';
      cover.append(artwork, element('strong', book.title));
      link.append(cover, element('h2', book.title), element('p', book.author), element('p', book.description));
      var meta = element('div', undefined, 'book-meta'); meta.append(element('span', book.category + (reference ? ' · 书目' : ' · 古籍')), element('span', reference ? '正文待授权' : book.chapterCount + ' 节'));
      link.append(meta);
      if (book.editorialWarning) link.append(element('p', book.editorialWarning, 'book-warning'));
      if (book.translation && book.translation.completeChapters) link.append(element('p', book.translation.completeChapters + ' 篇白话对照 · ' + (book.translation.complete ? '全书译稿' : '持续更新'), 'book-translation'));
      link.append(element('span', reference ? '查看出版书目 ↗' : '翻开阅读 →', 'book-action')); grid.append(link);
    });
    var readable = shown.filter(function (b) { return b.availability !== 'reference'; }).length;
    $('shelfStatus').textContent = shown.length ? readable + ' 部可阅读' + (shown.length > readable ? ' · ' + (shown.length - readable) + ' 部书目待授权' : '') : '没有找到相关书籍，换个关键词或分类试试。';
    var recent = catalog.filter(function (b) { return b.availability !== 'reference'; }).map(function (b) { var s = states[b.id] || read(storageKey(b.id)); return s && s.progress ? { book: b, progress: s.progress } : null; }).filter(Boolean).sort(function (a, b) { return b.progress.at - a.progress.at; })[0];
    $('continueReading').hidden = !recent;
    if (recent) { $('continueReading').href = url(recent.book.id); $('continueReading').dataset.libraryLink = 'true'; $('continueReading').textContent = '接着上次读 · ' + recent.book.title + '　→'; }
  }
  function updateBookmark() {
    if (!current) return;
    var entry = state(current).bookmarks[current.chapters[chapterIndex].id], saved = !!entry && !entry.deleted;
    $('bookmarkButton').setAttribute('aria-pressed', String(saved)); $('bookmarkButton').textContent = saved ? '已收藏' : '收藏本章';
  }
  function readingText(original, simplified) { return preferences.original === true ? original : (simplified || original); }
  function editionChapters() {
    var key = current.chapters[chapterIndex].editionKey;
    return current.chapters.filter(function (c) { return !key || c.editionKey === key; });
  }
  function chapterLabel(c) { return c.displayTitle || readingText(c.title, c.titleSimplified); }
  function paintChapter() {
    var chapter = current.chapters[chapterIndex];
    var title = chapterLabel(chapter);
    $('chapterTitle').textContent = title;
    $('chapterGroup').textContent = readingText(chapter.group, chapter.groupSimplified) || '';
    $('chapterBody').replaceChildren();
    var warning = $('bookEditorialNotice'); warning.replaceChildren(); warning.hidden = !current.editorialWarning;
    if (current.editorialWarning) warning.append(element('strong', current.editorialWarning.title), element('p', current.editorialWarning.text), element('p', current.editorialWarning.scope));
    chapter.blocks.forEach(function (block, index) {
      var el = element(block.type === 'pre' ? 'pre' : block.isHeading ? 'h2' : 'p', readingText(block.text, block.textSimplified));
      var node = el;
      if (preferences.parallel && block.translation) {
        node = element('section', undefined, 'reading-pair');
        var modern = element('div', undefined, 'vernacular');
        modern.append(element('span', '白话', 'passage-label'), element('p', block.translation));
        node.append(element('span', '古文', 'passage-label'), el, modern);
      }
      if (block.proofreadingNote) {
        if (node === el) { node = element('section', undefined, 'reading-passage'); node.append(el); }
        var note = element('aside', undefined, 'proofreading-note');
        note.setAttribute('aria-label', '原文校对说明');
        note.append(element('strong', '校对说明'), element('p', block.proofreadingNote)); node.append(note);
      }
      node.dataset.block = index; $('chapterBody').append(node);
    });
    $('ancientMode').setAttribute('aria-pressed', String(!preferences.parallel));
    $('parallelMode').setAttribute('aria-pressed', String(!!preferences.parallel));
    var count = chapter.blocks.filter(function (b) { return b.translation; }).length;
    var info = $('translationStatus'); info.replaceChildren(); info.hidden = !preferences.parallel;
    if (preferences.parallel) {
      var complete = count === chapter.blocks.length && count > 0;
      info.append(element('p', count ? (complete ? '本章 ' + count + ' 段已全部配译。' : '本章已有 ' + count + ' / ' + chapter.blocks.length + ' 段白话试读，其余段落保留古文。') + 'AI辅助整理，未经古籍专家逐句审校。' : '本章尚未收录白话译文，当前显示古文。'));
      if (!count && current.translation && current.translation.chapters.length) {
        var sample = current.translation.chapters[0];
        if (sample !== chapter.id) { var link = element('a', '查看本书白话试读 →'); link.href = url(current.id, sample); link.dataset.libraryLink = 'true'; info.append(link); }
      }
    }
    var notes = [chapter.editorialNote, chapter.blocks.some(function (b) { return b.textPunctuated; }) ? '本章部分段落补充了阅读标点，未改原字。可点“原文”核对来源录文；断句仍可讨论。' : '', chapter.editionKey === 'siku' ? '四库底本保留原有未点校文字；想先顺畅阅读，可切换上方“标点录本”。两个录本内容有差异。' : ''].filter(Boolean);
    $('chapterNote').textContent = notes.join(' '); $('chapterNote').hidden = !notes.length;
    $('readingArticle').lang = preferences.original ? 'zh' : 'zh-Hans';
    document.title = title + ' · ' + current.title + ' · 知时';
  }
  function renderContents() {
    var list = $('chapterList'); list.replaceChildren();
    $('allChapters').setAttribute('aria-pressed', String(!showSaved)); $('savedChapters').setAttribute('aria-pressed', String(showSaved));
    var group = '', visible = editionChapters();
    current.chapters.forEach(function (chapter, index) {
      if (!showSaved && !visible.includes(chapter)) return;
      var saved = state(current).bookmarks[chapter.id]; if (showSaved && (!saved || saved.deleted)) return;
      var label = readingText(chapter.group, chapter.groupSimplified) || '';
      if (label && label !== group) { list.append(element('h3', label)); group = label; }
      var link = element('a', chapterLabel(chapter)); link.href = url(current.id, chapter.id); link.dataset.libraryLink = 'true'; link.setAttribute('aria-current', String(index === chapterIndex)); list.append(link);
    });
    if (!list.children.length) list.append(element('p', '还没有收藏章节，阅读时点“收藏本章”即可。'));
  }
  function renderSource() {
    var box = $('bookSource'); box.replaceChildren();
    box.append(element('h3', current.title), element('p', current.author), element('p', '收录版本：' + current.edition), element('p', current.note));
    if (current.editorialWarning) box.append(element('p', current.editorialWarning.text), element('p', current.editorialWarning.scope));
    box.append(element('p', '默认简体阅读；工具栏中的“原文”可切回来源字形。来源可能为繁体、简体或混排；转换只调整字形，不是白话翻译。'));
    if (current.translation) box.append(element('p', current.translation.label + '：已收录 ' + current.translation.paragraphs + ' 段。' + current.translation.method + '。' + current.translation.note));
    current.sources.forEach(function (source) { var p = element('p', source.title + ' · '); var a = element('a', (source.publisher || '维基文库') + (source.revision ? '来源及修订记录' : '来源原文')); a.href = source.permanentUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a); box.append(p); });
    box.append(element('p', current.license.attribution), element('p', current.license.changes));
    var license = element('a', current.license.label); license.href = current.license.url; license.target = '_blank'; license.rel = 'noopener noreferrer'; box.append(license);
  }
  async function route() {
    var epoch = ++routeEpoch, accountEpoch = identityEpoch, params = new URLSearchParams(location.search), id = params.get('book');
    current = null; restoring = true; $('libraryLoading').hidden = !id; $('libraryError').hidden = true; $('reader').hidden = true; $('shelf').hidden = false;
    document.body.classList.remove('library-reading', 'library-night'); document.title = '藏书阁 · 知时';
    if (!id) { renderShelf(); restoring = false; window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    $('shelf').hidden = true; $('shelfStatus').textContent = '正在打开书籍…';
    try {
      var book = await loadBook(id);
      if (epoch !== routeEpoch || accountEpoch !== identityEpoch) return;
      current = book; state(book); $('chapterBody').replaceChildren(); $('chapterTitle').textContent = '正在打开…'; status('正在恢复阅读记录…'); $('retrySync').hidden = true;
      if (!hydrated[id]) { await sync(book); if (accountEpoch === identityEpoch) hydrated[id] = true; }
      else status(localMessage());
      if (epoch !== routeEpoch || accountEpoch !== identityEpoch) return;
      var requested = params.get('chapter'), progress = state(book).progress;
      if (requested && book.chapterAliases && book.chapterAliases[requested]) requested = book.chapterAliases[requested];
      chapterIndex = book.chapters.findIndex(function (c) { return c.id === (requested || (progress && progress.chapter)); });
      if (requested && chapterIndex < 0) throw new Error('这个章节链接已失效，请从书架重新进入。');
      if (chapterIndex < 0) chapterIndex = 0;
      var chapter = book.chapters[chapterIndex];
      await loadChapter(book, chapter);
      if (epoch !== routeEpoch || accountEpoch !== identityEpoch) return;
      $('libraryLoading').hidden = true;
      $('reader').hidden = false;
      var edition = editionChapters(), editionIndex = edition.indexOf(chapter);
      $('readingBookTitle').textContent = book.title; $('chapterNumber').textContent = (editionIndex + 1) + ' / ' + edition.length + ' 篇'; paintChapter();
      $('editionControl').hidden = !book.editions;
      $('editionSelect').replaceChildren();
      (book.editions || []).forEach(function (e) { var option = element('option', e.label); option.value = e.id; $('editionSelect').append(option); });
      if (book.editions) $('editionSelect').value = chapter.editionKey;
      $('previousChapter').disabled = editionIndex === 0; $('nextChapter').disabled = editionIndex === edition.length - 1;
      document.body.classList.add('library-reading'); applyPreferences(); updateBookmark();
      var block = progress && progress.chapter === chapter.id ? progress.block : 0;
      var requestedBlock = params.get('block');
      if (requested && /^\d+$/.test(requestedBlock || '') && Number(requestedBlock) < chapter.blocks.length) block = Number(requestedBlock);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (block > 0 && $('chapterBody').children[block]) window.scrollTo({ top: window.scrollY + $('chapterBody').children[block].getBoundingClientRect().top - 100, behavior: 'instant' });
      $('chapterTitle').focus({ preventScroll: true });
      // Ignore scroll events generated by layout restoration; a late callback
      // must never save into a different book or a different account.
      setTimeout(function () { if (epoch === routeEpoch && accountEpoch === identityEpoch) { restoring = false; remember(block); } }, 180);
    } catch (error) {
      if (epoch !== routeEpoch || accountEpoch !== identityEpoch) return;
      $('libraryLoading').hidden = true;
      current = null; $('reader').hidden = true; $('libraryError').hidden = false; $('libraryError').querySelector('p').textContent = error.message === '请求未成功' ? '书籍加载失败，请检查网络后重试。' : error.name === 'AbortError' ? '加载超时，请重试。' : error.message; restoring = false;
    }
  }
  var preferences = read('zhishi_library_preferences') || {};
  function applyPreferences() {
    preferences.size = Math.min(28, Math.max(16, Number(preferences.size) || 20));
    document.documentElement.style.setProperty('--reading-size', preferences.size + 'px');
    document.body.classList.toggle('library-night', !!current && preferences.night === true); $('themeButton').setAttribute('aria-pressed', String(preferences.night === true)); $('themeButton').textContent = preferences.night ? '日读' : '夜读';
    $('smallerFont').disabled = preferences.size <= 16; $('largerFont').disabled = preferences.size >= 28;
    $('scriptButton').textContent = preferences.original ? '简体' : '原文';
    $('scriptButton').setAttribute('aria-label', preferences.original ? '切换为简体阅读' : '切换为来源原文');
    $('scriptButton').setAttribute('aria-pressed', String(preferences.original === true));
  }
  function changeIdentity() {
    var user = window.Auth && Auth.getUser(), nextToken = window.Auth && Auth.getToken() || '', nextOwner = user && user.id && nextToken ? 'user-' + user.id : 'guest';
    nextToken = nextOwner === 'guest' ? '' : nextToken;
    if (owner === nextOwner && token === nextToken) return false;
    owner = nextOwner; token = nextToken; states = {}; hydrated = {}; identityEpoch++; clearTimeout(syncTimer); clearTimeout(scrollTimer); if (catalog.length) route(); return true;
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-library-link],#backToShelf');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); }); navigate(link.href);
  });
  document.querySelectorAll('[data-close]').forEach(function (button) { button.onclick = function () { button.closest('dialog').close(); }; });
  $('contentsButton').onclick = function () { renderContents(); $('contentsDialog').showModal(); };
  $('sourceButton').onclick = function () { renderSource(); $('sourceDialog').showModal(); };
  $('allChapters').onclick = function () { showSaved = false; renderContents(); }; $('savedChapters').onclick = function () { showSaved = true; renderContents(); };
  $('bookmarkButton').onclick = function () { if (!current || restoring) return; var key = current.chapters[chapterIndex].id, previous = state(current).bookmarks[key]; state(current).bookmarks[key] = { at: stamp(), deleted: !!previous && !previous.deleted }; persist(current); updateBookmark(); status(localMessage()); queueSync(current); };
  function turnChapter(step) { if (!current || restoring) return; var edition = editionChapters(), next = edition[edition.indexOf(current.chapters[chapterIndex]) + step]; if (next) navigate(url(current.id, next.id)); }
  $('previousChapter').onclick = function () { turnChapter(-1); };
  $('nextChapter').onclick = function () { turnChapter(1); };
  $('editionSelect').onchange = function () { if (current && !restoring) { var c = current.chapters.find(function (c) { return c.editionKey === $('editionSelect').value; }); if (c) navigate(url(current.id, c.id)); } };
  $('smallerFont').onclick = function () { preferences.size -= 2; applyPreferences(); write('zhishi_library_preferences', preferences); };
  $('largerFont').onclick = function () { preferences.size += 2; applyPreferences(); write('zhishi_library_preferences', preferences); };
  $('themeButton').onclick = function () { preferences.night = !preferences.night; applyPreferences(); write('zhishi_library_preferences', preferences); };
  function changeReadingMode(change) {
    if (!current || restoring) return;
    visibleBlock();
    var progress = state(current).progress, block = progress ? progress.block : 0, node = $('chapterBody').children[block];
    var top = node ? node.getBoundingClientRect().top : 100, epoch = routeEpoch;
    restoring = true; clearTimeout(scrollTimer);
    change(); applyPreferences(); write('zhishi_library_preferences', preferences); paintChapter();
    node = $('chapterBody').children[block];
    if (node) window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - top, behavior: 'instant' });
    setTimeout(function () { if (epoch === routeEpoch) restoring = false; }, 180);
  }
  $('scriptButton').onclick = function () { changeReadingMode(function () { preferences.original = !preferences.original; }); };
  $('ancientMode').onclick = function () { changeReadingMode(function () { preferences.parallel = false; }); };
  $('parallelMode').onclick = function () { changeReadingMode(function () { preferences.parallel = true; }); };
  $('bookSearch').oninput = renderShelf;
  $('categories').onclick = function (event) { var button = event.target.closest('[data-category]'); if (!button) return; category = button.dataset.category; $('categories').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); }); renderShelf(); };
  $('retrySync').onclick = function () { if (current) sync(current); }; $('retryLoad').onclick = function () { if (catalog.length) route(); else init(); };
  window.addEventListener('popstate', function () { visibleBlock(); if (current) sync(current); route(); });
  window.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(visibleBlock, 220); }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { visibleBlock(); if (current) sync(current); } });
  window.addEventListener('pagehide', function () { visibleBlock(); if (current && token) fetch('/api/library-state', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ book: current.id, state: state(current) }) }).catch(function () {}); });
  window.addEventListener('zhishi:identitychange', function () { identityEpoch++; routeEpoch++; restoring = true; clearTimeout(syncTimer); clearTimeout(scrollTimer); document.querySelectorAll('dialog[open]').forEach(function (d) { d.close(); }); setTimeout(function () { if (!changeIdentity() && catalog.length) route(); }, 0); });
  window.addEventListener('storage', function (event) { if (!current || event.key !== storageKey(current.id)) return; states[current.id] = model.merge(state(current), read(event.key), current); updateBookmark(); });
  async function init() {
    $('libraryError').hidden = true;
    try { catalog = await json('/books/catalog.json?v=9'); renderShelf(); changeIdentity(); await route(); }
    catch (_) { $('libraryError').hidden = false; $('libraryError').querySelector('p').textContent = '书架加载失败，请检查网络后重试。'; $('shelfStatus').textContent = ''; }
  }
  applyPreferences(); init();
  if (window.Auth) { Auth.ready(changeIdentity); Auth.onLogin(changeIdentity); }
})();
