// Fixed translations bound to exact source paragraphs; no reader-time generation.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');

function buildTranslatedBook(source, manifest, full) {
  const book = structuredClone(source), seenSamples = new Set(), seenChapters = new Set();
  for (const chapter of book.chapters) for (const block of chapter.blocks) delete block.translation;
  for (const sample of manifest.entries.filter(entry => entry.book === book.id)) {
    const key = sample.chapter + ':' + sample.block;
    const chapter = book.chapters.find(c => c.id === sample.chapter), block = chapter?.blocks[sample.block];
    if (seenSamples.has(key)) throw Error('Duplicate translation sample: ' + book.id + '/' + key);
    if (!block || digest(block.text) !== sample.sourceHash) throw Error('Translation source changed: ' + book.id + '/' + key);
    if (typeof sample.text !== 'string' || !sample.text.trim()) throw Error('Empty translation: ' + key);
    seenSamples.add(key); block.translation = sample.text;
  }
  if (full) {
    if (full.book !== book.id || !Array.isArray(full.chapters)) throw Error('Invalid chapter translation manifest: ' + book.id);
    for (const entry of full.chapters) {
      const chapter = book.chapters.find(c => c.id === entry.id);
      if (!chapter || seenChapters.has(entry.id)) throw Error('Missing or duplicate translated chapter: ' + book.id + '/' + entry.id);
      if (!Array.isArray(entry.paragraphs) || !Array.isArray(entry.sourceHashes) || entry.paragraphs.length !== chapter.blocks.length || entry.sourceHashes.length !== chapter.blocks.length) throw Error('Translation paragraph count changed: ' + book.id + '/' + entry.id);
      chapter.blocks.forEach((block, index) => {
        if (digest(block.text) !== entry.sourceHashes[index]) throw Error('Translation source changed: ' + book.id + '/' + entry.id + '/' + index);
        if (typeof entry.paragraphs[index] !== 'string' || !entry.paragraphs[index].trim()) throw Error('Empty translation: ' + entry.id + '/' + index);
        // A full-chapter draft supersedes the earlier reading sample.
        block.translation = entry.paragraphs[index];
      });
      seenChapters.add(entry.id);
    }
  }
  const blocks = book.chapters.flatMap(c => c.blocks);
  const paragraphs = blocks.filter(b => b.translation).length;
  const completeChapters = book.chapters.filter(c => c.blocks.length && c.blocks.every(b => b.translation)).map(c => c.id);
  const complete = completeChapters.length === book.chapters.length;
  book.translation = {
    label: complete ? '知时白话译稿' : full ? '知时白话译稿（部分）' : '知时白话试读',
    method: 'AI辅助整理，未经古籍专家逐句审校', version: full?.version || manifest.version,
    paragraphs, totalParagraphs: blocks.length, totalChapters: book.chapters.length, completeChapters, complete,
    chapters: book.chapters.filter(c => c.blocks.some(b => b.translation)).map(c => c.id),
    note: (complete ? '当前收录的 ' + book.chapters.length + ' 篇均已逐段配译，包含本底本所附古文；不代表覆盖其他版本。' : (full && full.scope ? full.scope + '。' : '') + '尚未提供全书白话译本。') + '译文与整理说明供对照阅读；疑难字句、残缺命例保留核对提示，不暗改原文。'
  };
  book.license.changes = book.license.changes.replace(/未添加白话译文|不添加白话译文|白话试读单独标注，与古文分开显示/g, '白话译稿单独标注，与古文分开显示');
  return book;
}

function main() {
  const root = path.resolve(__dirname, '../books'), manifest = require('./library-translations.json');
  const catalogFile = path.join(root, 'catalog.json'), catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  // Validate every book before touching generated content. A stale source hash
  // fails the build before any book receives updated translations.
  const outputs = catalog.map(entry => {
    const file = path.join(root, entry.id + '.json');
    const fullFile = path.join(__dirname, 'translations', entry.id + '.json');
    const full = fs.existsSync(fullFile) ? JSON.parse(fs.readFileSync(fullFile, 'utf8')) : null;
    const source = require('./build-library-proofreading.cjs').applyProofreading(JSON.parse(fs.readFileSync(file, 'utf8')), require('./library-proofreading.json'));
    const book = buildTranslatedBook(source, manifest, full);
    if (book.editorialWarning) entry.editorialWarning = book.editorialWarning.short;
    entry.translation = { complete: book.translation.complete, completeChapters: book.translation.completeChapters.length, paragraphs: book.translation.paragraphs };
    return { file, book };
  });
  const cases = require('./build-library-cases.cjs').buildCases(Object.fromEntries(outputs.map(({book}) => [book.id, book])), require('./library-cases.json'));
  for (const { file, book } of outputs) fs.writeFileSync(file, JSON.stringify(book, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');
  require('./build-library-reader.cjs').main();
  console.log(outputs.map(({ book }) => book.id + ': ' + book.translation.completeChapters.length + '/' + book.chapters.length + ' full chapters, ' + book.translation.paragraphs + ' paragraphs').join('\n'));
}
if (require.main === module) main();
module.exports = { buildTranslatedBook };
