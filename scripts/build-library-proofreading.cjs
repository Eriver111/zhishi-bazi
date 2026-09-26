const crypto = require('node:crypto');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');

function applyProofreading(source, manifest) {
  if (source.id !== manifest.book) return structuredClone(source);
  const book = structuredClone(source), seen = new Set();
  for (const chapter of book.chapters) for (const block of chapter.blocks) delete block.proofreadingNote;
  for (const entry of manifest.entries) {
    const key = entry.chapter + ':' + entry.block;
    const block = book.chapters.find(c => c.id === entry.chapter)?.blocks[entry.block];
    if (seen.has(key)) throw Error('Duplicate proofreading note: ' + key);
    if (!block || digest(block.text) !== entry.sourceHash) throw Error('Proofreading source changed: ' + key);
    if (typeof entry.note !== 'string' || !entry.note.trim()) throw Error('Empty proofreading note: ' + key);
    seen.add(key); block.proofreadingNote = entry.note;
  }
  book.editorialWarning = structuredClone(manifest.warning);
  return book;
}
module.exports = { applyProofreading };
