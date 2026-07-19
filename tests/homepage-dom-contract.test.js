const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('homepage scripts do not reference removed hexagram loader nodes', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const loaderIds = ['hexaName', 'hexaSub', 'hexaBox'];

  for (const id of loaderIds) {
    const referenced = html.includes(`getElementById('${id}')`);
    const exists = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    assert.equal(referenced && !exists, false, `${id} is referenced but missing from the DOM`);
  }
});
