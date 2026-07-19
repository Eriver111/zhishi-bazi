const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

for (const file of ['server.js', 'dev-server.js']) {
  test(`${file} serves site media with explicit MIME types`, () => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const required = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.ico', '.mp4', '.mp3'];

    for (const ext of required) {
      assert.match(source, new RegExp(`['"]\\${ext}['"]\\s*:`), `${file} is missing ${ext}`);
    }
  });
}
