(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LibraryModel = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function normalize(value, book) {
    var result = { progress: null, bookmarks: {} };
    if (book.readingRevision) result.revision = book.readingRevision;
    if (!value || typeof value !== 'object') return result;
    function entry(item, chapterId, bookmark) {
      if (!item) return null;
      var block = Math.max(0, Math.trunc(Number(item.block) || 0));
      if (!bookmark && (Number(value.revision) || 0) < 2 && book.readingMigrations && book.readingMigrations[chapterId]) {
        var ranges = book.readingMigrations[chapterId];
        var range = ranges.find(function (r) { return block >= r.start && block < r.end; }) || ranges[ranges.length - 1];
        chapterId = range.chapter; block = Math.max(0, block - range.start - range.skip);
      }
      chapterId = (book.chapterAliases && book.chapterAliases[chapterId]) || chapterId;
      var chapter = book.chapters.find(function (c) { return c.id === chapterId; });
      if (!chapter || !item || !Number.isSafeInteger(item.at) || item.at < 1 || item.at > Date.now() + 300000) return null;
      if (bookmark) return { at: item.at, deleted: item.deleted === true };
      return { chapter: chapterId, block: Math.min(chapter.blocks.length - 1, block), at: item.at };
    }
    if (value.progress) result.progress = entry(value.progress, value.progress.chapter, false);
    if (value.bookmarks && typeof value.bookmarks === 'object') Object.keys(value.bookmarks).forEach(function (id) {
      var item = entry(value.bookmarks[id], id, true);
      var target = (book.chapterAliases && book.chapterAliases[id]) || id;
      if (item) result.bookmarks[target] = newer(result.bookmarks[target], item);
    });
    return result;
  }
  function newer(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.at !== b.at) return a.at > b.at ? a : b;
    return JSON.stringify(a) > JSON.stringify(b) ? a : b;
  }
  function merge(a, b, book) {
    a = normalize(a, book); b = normalize(b, book);
    var result = { progress: newer(a.progress, b.progress), bookmarks: {} };
    if (book.readingRevision) result.revision = book.readingRevision;
    book.chapters.forEach(function (c) {
      var value = newer(a.bookmarks[c.id], b.bookmarks[c.id]);
      if (value) result.bookmarks[c.id] = value;
    });
    return result;
  }
  return { normalize: normalize, merge: merge };
});
