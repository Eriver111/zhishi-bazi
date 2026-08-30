const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolvePublicFile } = require('../lib/static-security');

const root = path.resolve(__dirname, '..');

test('static server exposes only explicit public assets and never environment or backend files', () => {
  assert.equal(resolvePublicFile(root, '/.env'), null);
  assert.equal(resolvePublicFile(root, '/%2eenv'), null);
  assert.equal(resolvePublicFile(root, '/../.env'), null);
  assert.equal(resolvePublicFile(root, '/%2e%2e/.env'), null);
  assert.equal(resolvePublicFile(root, '/server.js'), null);
  assert.equal(resolvePublicFile(root, '/lib/supabase.js'), null);
  assert.equal(resolvePublicFile(root, '/api/ai-chat.js'), null);
  assert.equal(resolvePublicFile(root, '/package.json'), null);
  assert.equal(resolvePublicFile(root, '/.data-store.json'), null);
  assert.equal(resolvePublicFile(root, '/兑换码-备用.txt'), null);
  assert.equal(resolvePublicFile(root, '/index.html'), path.join(root, 'index.html'));
  assert.equal(resolvePublicFile(root, '/js/auth.js'), path.join(root, 'js', 'auth.js'));
});

test('registration UI and endpoint no longer advertise or return signup bonus questions', () => {
  const ui = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
  const endpoint = fs.readFileSync(path.join(root, 'api', 'auth', 'register.js'), 'utf8');
  assert.doesNotMatch(ui, /送3次|注册即送|d\.bonus/);
  assert.doesNotMatch(endpoint, /bonus\s*:/);
});

test('personal fortune requires authentication while public almanac remains available', () => {
  const endpoint = fs.readFileSync(path.join(root, 'api', 'fortune.js'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'js', 'home-fortune.js'), 'utf8');
  assert.match(endpoint, /if \(!dayGan\) return res\.status\(200\)/);
  assert.match(endpoint, /requireAuth\(req\)/);
  assert.match(home, /Authorization.*Bearer.*Auth\.getToken\(\)/);
});

test('server rejects API traversal before dynamic require', () => {
  for (const filename of ['server.js', 'dev-server.js']) {
    const source = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(source, /\^\[a-z0-9_/);
    assert.match(source, /n\.split\('\/'\)\.includes\('\.\.'\)/);
  }
});
