const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const book = require('../books/yuanhai.json'), draft = require('../scripts/translations/yuanhai.json');
const { buildTranslatedBook } = require('../scripts/build-library-translations.cjs');
const samples = require('../scripts/library-translations.json');

test('the collected Yuanhai edition has 170 complete source-bound chapters and 2675 aligned translations', () => {
  assert.equal(book.chapters.length, 170);
  assert.equal(draft.chapters.length, 170);
  assert.equal(book.translation.complete, true);
  assert.equal(book.translation.paragraphs, 2675);
  assert.equal(book.translation.totalParagraphs, 2675);
  assert.equal(book.translation.completeChapters.length, 170);
  assert.match(book.translation.note, /不代表覆盖其他版本/);
  assert.match(book.translation.method, /未经古籍专家逐句审校/);
  draft.chapters.forEach((entry, index) => {
    const chapter = book.chapters[index];
    assert.equal(entry.id, chapter.id);
    assert.equal(entry.title, chapter.title);
    assert.equal(entry.paragraphs.length, chapter.blocks.length);
    assert.equal(entry.sourceHashes.length, chapter.blocks.length);
    chapter.blocks.forEach((block, i) => {
      assert.equal(entry.sourceHashes[i], crypto.createHash('sha256').update(block.text).digest('hex'));
      assert.equal(block.translation, entry.paragraphs[i]);
      assert.ok(block.translation.trim());
      assert.notEqual(block.translation, block.textSimplified || block.text);
    });
  });
  assert.deepEqual(buildTranslatedBook(book, samples, draft), book);
  assert.deepEqual(require('../books/catalog.json').find(b => b.id === 'yuanhai').translation,
    { complete: true, completeChapters: 170, paragraphs: 2675 });
});

test('Yuanhai annotations preserve incomplete charts, incompatible conventions and doubtful source statements', () => {
  const text = (chapter, block) => book.chapters[chapter].blocks[block].translation;
  assert.match(text(16, 7), /盘无丑/);
  assert.match(text(16, 7), /三乙是食神/);
  assert.match(text(27, 8), /时柱缺失/);
  assert.match(text(27, 8), /不补第四柱/);
  assert.match(text(109, 0), /不是天干五合/);
  assert.match(text(119, 1), /四柱并没有丑/);
  assert.match(text(128, 3), /与前面弃身从财的思路相反/);
  assert.match(text(132, 0), /纳音/);
  assert.match(text(135, 16), /与前篇喜午时的口诀并不一致/);
  assert.match(text(138, 4), /寅是临官而非长生/);
  assert.match(text(138, 5), /四柱没有亥/);
  assert.match(text(151, 7), /五阳有刃、五阴无刃/);
  assert.match(book.editorialWarning.text, /不将本书纳入网站算法规则/);
  assert.match(book.editorialWarning.scope, /170 篇已逐段配译/);
  assert.ok(!require('../books/cases.json').cases.some(c => c.book === 'yuanhai'));
  const changed = structuredClone(book);
  changed.chapters[169].blocks[0].text += '变';
  assert.throws(() => buildTranslatedBook(changed, samples, draft), /source changed/);
  const truncated = structuredClone(draft);
  truncated.chapters[169].paragraphs.pop();
  assert.throws(() => buildTranslatedBook(book, samples, truncated), /count changed/);
});
