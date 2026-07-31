const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
let serverProcess;
let serverPort;

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      reject(new Error(`server did not start\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 5000);

    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('OK')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`server exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
    });
  });
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 1000).unref();
  });
}

function request(body, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: serverPort,
      path: route,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        connection: 'close',
        ...headers
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.once('error', reject);
    req.end(body);
  });
}

function responseBeforeRequestEnds({ headers, firstChunk }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: serverPort,
      path: '/api/feedback',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        connection: 'close',
        ...headers
      }
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('server buffered the incomplete oversized request instead of rejecting it'));
    }, 1000);

    req.once('response', res => {
      clearTimeout(timer);
      const statusCode = res.statusCode;
      res.resume();
      req.destroy();
      resolve(statusCode);
    });
    req.once('error', error => {
      if (error.code !== 'ECONNRESET') {
        clearTimeout(timer);
        reject(error);
      }
    });
    req.flushHeaders();
    if (firstChunk) req.write(firstChunk);
  });
}

test.before(async () => {
  serverPort = await availablePort();
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(serverPort),
      SUPABASE_URL: '',
      SUPABASE_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer(serverProcess);
});

test.after(async () => {
  await stopServer(serverProcess);
});

test('feedback rejects an oversized Content-Length before the request body is buffered', async () => {
  const statusCode = await responseBeforeRequestEnds({
    headers: { 'content-length': '4097' }
  });

  assert.equal(statusCode, 413);
});

test('feedback rejects a chunked request as soon as streamed bytes cross 4096', async () => {
  const statusCode = await responseBeforeRequestEnds({
    firstChunk: Buffer.alloc(4097, 0x20)
  });

  assert.equal(statusCode, 413);
});

test('feedback parses and invokes its handler for an exactly 4096-byte body', async () => {
  const json = JSON.stringify({ message: 'ok' });
  const body = json + ' '.repeat(4096 - Buffer.byteLength(json));
  assert.equal(Buffer.byteLength(body), 4096);

  const response = await request(body, '/api/feedback');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test('other API routes retain request bodies larger than 4096 bytes', async () => {
  const response = await request(
    JSON.stringify({ payload: 'x'.repeat(5000) }),
    '/api/ping'
  );

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).ok, true);
});
