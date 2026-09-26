// Keep the archival book intact; emit a small reader index and on-demand chapters.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
function splitBook(book) {
  const chapters = book.chapters.map(chapter => {
    const { blocks, ...meta } = chapter;
    const content = JSON.stringify({ book: book.id, id: chapter.id, blocks });
    const revision = crypto.createHash('sha256').update(content).digest('hex').slice(0,16);
    return { meta: { ...meta, blockCount: blocks.length, revision }, content };
  });
  return { index: { ...book, readerFormat: 1, chapters: chapters.map(c => c.meta) }, chapters };
}
function main() {
  const root = path.resolve(__dirname, '../books');
  const book = JSON.parse(fs.readFileSync(path.join(root, 'sanming.json'), 'utf8'));
  const result = splitBook(book), directory = path.join(root, 'reader', book.id);
  fs.mkdirSync(directory, {recursive:true});
  for (const chapter of result.chapters) fs.writeFileSync(path.join(directory, chapter.meta.id + '.json'), chapter.content + '\n');
  fs.writeFileSync(path.join(directory, 'index.json'), JSON.stringify(result.index) + '\n');
  console.log(book.id + ': ' + result.chapters.length + ' reader chapters');
}
if (require.main === module) main();
module.exports = { splitBook, main };
