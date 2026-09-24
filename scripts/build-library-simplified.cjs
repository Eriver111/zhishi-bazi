// Build-time conversion only: readers do not download a converter or use a CDN.
const fs = require('node:fs');
const path = require('node:path');
const OpenCC = require('opencc-js');
const convert = OpenCC.Converter({ from: 'tw', to: 'cn' });

function addSimplified(book) {
  book.contentVersion = 2;
  book.scriptConversion = { engine: 'opencc-js', version: '1.4.2', from: 'tw', to: 'cn', source: 'https://github.com/nk2028/opencc-js' };
  if (book.license && !book.license.changes.includes('繁转简')) book.license.changes += '另提供自动繁转简的阅读文本，保留来源原文供切换对照。';
  book.chapters.forEach(chapter => {
    chapter.titleSimplified = convert(chapter.title).replace(/^([一二三四五六七八九十百]+)[．.、]\s*/, '$1、');
    if (chapter.group) chapter.groupSimplified = convert(chapter.group);
    chapter.blocks.forEach(block => { block.textSimplified = convert(block.textPunctuated || block.text).replace(/[﹐﹑﹒﹔﹕﹖﹗︰]/g, c => ({'﹐':'，','﹑':'、','﹒':'。','﹔':'；','﹕':'：','﹖':'？','﹗':'！','︰':'：'}[c])); });
  });
  return book;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../books');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
  for (const entry of catalog.filter(b => b.availability !== 'reference')) {
    const file = path.join(root, entry.id + '.json');
    const book = addSimplified(JSON.parse(fs.readFileSync(file, 'utf8')));
    fs.writeFileSync(file, JSON.stringify(book, null, 2) + '\n');
    console.log(entry.id + ': ' + book.chapters.length + ' simplified sections; originals retained');
  }
}
module.exports = { addSimplified };
