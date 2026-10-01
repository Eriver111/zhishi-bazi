const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const book = require('../books/sanming.json');
const full = require('../scripts/translations/sanming.json');
const samples = require('../scripts/library-translations.json');
const { buildTranslatedBook } = require('../scripts/build-library-translations.cjs');

test('Sanming opening six chapters bind all 140 paragraphs without claiming either edition complete', () => {
  assert.equal(full.chapters.length, 6);
  assert.deepEqual(full.chapters.map(c => c.id), book.chapters.slice(0, 6).map(c => c.id));
  assert.equal(full.chapters.reduce((n, c) => n + c.paragraphs.length, 0), 140);
  full.chapters.forEach((draft, i) => {
    assert.equal(book.chapters[i].editionKey, 'punctuated');
    assert.equal(draft.paragraphs.length, book.chapters[i].blocks.length);
    book.chapters[i].blocks.forEach((block, j) => {
      assert.equal(draft.sourceHashes[j], crypto.createHash('sha256').update(block.text).digest('hex'));
      assert.equal(block.translation, draft.paragraphs[j]);
    });
  });
  const result = buildTranslatedBook(book, samples, full);
  assert.deepEqual(result, book);
  assert.equal(result.translation.complete, false);
  assert.equal(result.translation.completeChapters.length, 6);
  assert.equal(result.translation.totalChapters, 379);
  assert.match(result.translation.note, /四库十二卷及其余章节仍待续译/);
});

test('Sanming drafts preserve source anomalies and distinguish imagery from modern factual claims', () => {
  assert.match(full.chapters[0].paragraphs[0], /不是现代胚胎学或人体解剖结论/);
  assert.match(full.chapters[2].paragraphs[0], /大尧/);
  assert.match(full.chapters[3].paragraphs[1], /不是谈现实婚姻/);
  assert.match(full.chapters[4].paragraphs[1], /不应直接替换成每个日干的十二长生/);
  assert.match(full.chapters[4].paragraphs[2], /壬子癸酉.*壬子癸丑/);
  assert.match(book.chapters[4].blocks[2].text, /壬子癸酉/);
});

test('Sanming full-chapter binding rejects missing, stale and empty text before mutating its source', () => {
  const before = structuredClone(book), missing = structuredClone(full);
  missing.chapters[4].paragraphs.pop();
  assert.throws(() => buildTranslatedBook(book, samples, missing), /paragraph count/);
  const stale = structuredClone(book);
  stale.chapters[4].blocks[3].text += '异文';
  assert.throws(() => buildTranslatedBook(stale, samples, full), /source changed/);
  const empty = structuredClone(full);
  empty.chapters[4].paragraphs[3] = ' ';
  assert.throws(() => buildTranslatedBook(book, samples, empty), /Empty translation/);
  assert.deepEqual(book, before);
});

test('Yuanliu paired cases retain six luck steps, anomalous first luck and their own commentary', () => {
  const cases = require('../books/cases.json').cases;
  const a = cases.find(c => c.id === 'dt-yuanliu-seal-end');
  const b = cases.find(c => c.id === 'dt-yuanliu-wealth-end');
  assert.deepEqual(a.pillars, ['辛酉', '庚子', '丙寅', '癸巳']);
  assert.deepEqual(b.pillars, ['辛丑', '癸巳', '戊申', '丙辰']);
  assert.deepEqual(a.luck, ['乙亥', '戊戌', '丁酉', '丙申', '乙未', '甲午']);
  assert.deepEqual(b.luck, ['壬辰', '辛卯', '庚寅', '己丑', '戊子', '丁亥']);
  assert.deepEqual([a.sourceStart, a.sourceEnd, b.sourceStart, b.sourceEnd], [3, 12, 13, 22]);
  assert.equal(a.related[0].id, b.id); assert.equal(b.related[0].id, a.id);
  assert.match(a.note, /不连贯/); assert.match(b.note, /不折算现代财富/);
  assert.ok(!a.original.includes('富有百万'));
  assert.ok(!b.original.includes('词林出身'));
});

test('sixty-cycle draft preserves all 124 source blocks including merged and malformed entries', () => {
  const source = book.chapters[5], draft = full.chapters[5];
  assert.equal(source.id, 'c-269a5b0bb4b8');
  assert.equal(source.blocks.length, 124); assert.equal(draft.paragraphs.length, 124);
  for (const [i, original, annotation] of [
    [27, /辛卯未/, /疑为“木”之讹/],
    [33, /丁西火/, /不是合法干支/],
    [42, /丙午火/, /内部冲突/],
    [43, /丁未水，火光/, /水名与火光取象/],
    [54, /已未火/, /不是天干名/],
    [76, /丙辰、乙巳、戊午之火/, /丙辰.*属纳音土/],
    [112, /木死卯/, /疑有误字/],
    [117, /于未/, /疑为丁未/]
  ]) {
    assert.match(source.blocks[i].text, original);
    assert.match(draft.paragraphs[i], annotation);
  }
  assert.match(source.blocks[48].text, /壬子木.*癸丑木/);
  assert.match(draft.paragraphs[48], /壬子.*癸丑.*不拆成两段/s);
  assert.match(draft.paragraphs[70], /不猜补“未”前面的天干/);
  assert.match(draft.paragraphs[106], /夏季的两句评价不同/);
});

test('late chapter explicitly separates stem-branch seats from nayin and does not fabricate cases', () => {
  const paragraphs = full.chapters[5].paragraphs;
  assert.match(paragraphs[118], /已转用干支专位五行/);
  assert.match(paragraphs[119], /两个层次不可混用/);
  assert.match(paragraphs[120], /不表示辰戌之间的冲关系被取消/);
  assert.match(paragraphs[122], /不是把己丑纳音火、己未纳音火改成土/);
  assert.match(paragraphs[123], /不将其作为人物案例/);
  assert.equal(require('../books/cases.json').cases.length, 87);
  assert.ok(!require('../scripts/library-cases.json').cases.some(c => c.chapter === full.chapters[5].id));
});

test('sixty-cycle final paragraph must remain source-bound and cannot be omitted or shifted', () => {
  const missing = structuredClone(full); missing.chapters[5].paragraphs.pop();
  assert.throws(() => buildTranslatedBook(book, samples, missing), /paragraph count/);
  const changed = structuredClone(book); changed.chapters[5].blocks[123].text += '异文';
  assert.throws(() => buildTranslatedBook(changed, samples, full), /source changed/);
  const shifted = structuredClone(full);
  [shifted.chapters[5].sourceHashes[48], shifted.chapters[5].sourceHashes[49]] =
    [shifted.chapters[5].sourceHashes[49], shifted.chapters[5].sourceHashes[48]];
  assert.throws(() => buildTranslatedBook(book, samples, shifted), /source changed/);
});
