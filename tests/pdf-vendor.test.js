const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const vendorDir = path.join(__dirname, '..', 'js', 'vendor');

for (const filename of ['html2canvas.min.js', 'jspdf.umd.min.js']) {
  test(`${filename} is a local browser bundle`, () => {
    const bundle = fs.readFileSync(path.join(vendorDir, filename), 'utf8');
    assert.ok(bundle.length > 50_000, `${filename} must contain more than 50,000 characters`);
  });
}
