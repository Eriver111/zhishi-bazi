const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('both deployment paths repair a missing Liuren runtime dependency before restart', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const webhook = fs.readFileSync(path.join(root, 'api', 'deploy.js'), 'utf8');
  for (const source of [server, webhook]) {
    assert.match(source, /import\(\\?'liuren-ts-lib\\?'\)/);
    assert.match(source, /npm install --omit=dev --no-audit --no-fund/);
    assert.match(source, /ensureRuntimeDependencies\(dir\)/);
  }
});
