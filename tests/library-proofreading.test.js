const test = require('node:test'), assert = require('node:assert/strict');
const { applyProofreading } = require('../scripts/build-library-proofreading.cjs');
const source = require('../books/yuanhai.json'), manifest = require('../scripts/library-proofreading.json');

function withoutNotes(book) {
  const value = structuredClone(book); delete value.editorialWarning;
  for (const c of value.chapters) for (const b of c.blocks) delete b.proofreadingNote;
  return value;
}
test('proofreading is additive, repeatable and preserves all source paragraphs and existing samples', () => {
  const raw = withoutNotes(source), result = applyProofreading(raw, manifest);
  assert.deepEqual(withoutNotes(result), raw);
  assert.deepEqual(result, source);
  assert.deepEqual(applyProofreading(result, manifest), result);
  assert.equal(result.chapters.flatMap(c => c.blocks).filter(b => b.proofreadingNote).length, 11);
  assert.equal(result.translation.paragraphs, 2);
  assert.match(result.editorialWarning.text, /不将本书纳入网站算法规则/);
  assert.equal(require('../books/catalog.json').find(b => b.id === 'yuanhai').editorialWarning, manifest.warning.short);
  const other = require('../books/qiongtong.json');
  assert.deepEqual(applyProofreading(other, manifest), other);
});
test('changed source, duplicate references and empty notes fail instead of attaching misleading annotations', () => {
  const changed = structuredClone(source), first = manifest.entries[0];
  changed.chapters.find(c => c.id === first.chapter).blocks[first.block].text += '变';
  assert.throws(() => applyProofreading(changed, manifest), /source changed/);
  assert.throws(() => applyProofreading(source, {...manifest, entries: [first, first]}), /Duplicate/);
  assert.throws(() => applyProofreading(source, {...manifest, entries: [{...first, note: ''}]}), /Empty/);
  assert.throws(() => applyProofreading(source, {...manifest, entries: [{...first, block: 9999}]}), /source changed/);
});
