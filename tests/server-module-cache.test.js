const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const deploySource = fs.readFileSync(path.join(__dirname, '..', 'api', 'deploy.js'), 'utf8');

test('production API requests reuse loaded modules instead of recreating module timers', () => {
  assert.doesNotMatch(source, /delete\s+require\.cache\s*\[/);
});

test('fatal process errors are logged and allowed to terminate for PM2 recovery', () => {
  assert.doesNotMatch(source, /process\.on\(['"]uncaughtException['"]/);
  assert.doesNotMatch(source, /process\.on\(['"]unhandledRejection['"]/);
});

test('webhook deployment restarts PM2 after pulling changed code', () => {
  assert.match(deploySource, /changed[\s\S]*pm2 restart zhishi/);
});
