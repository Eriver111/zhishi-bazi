const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('static assets have correct content type and browser caching', async (t) => {
  const port = 3471;
  const child = spawn(process.execPath, ['dev-server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => child.kill());

  let response;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/images/zhishi-hero-ink-v2.webp`);
      break;
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  assert.ok(response, 'development server did not start');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.match(response.headers.get('cache-control') || '', /max-age=/);
});
