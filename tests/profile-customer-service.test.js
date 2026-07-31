const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const profilePath = path.join(__dirname, '..', 'profile.html');

function pageSource() {
  return fs.readFileSync(profilePath, 'utf8');
}

function profileScript() {
  const script = pageSource().match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(script, 'profile page must contain an inline renderer');
  return script[1];
}

function runCopy({ clipboard, execCommandResult = true } = {}) {
  const content = { innerHTML: '' };
  const temporaryNodes = [];
  const body = {
    appendChild(node) { temporaryNodes.push(node); },
    removeChild(node) {
      const index = temporaryNodes.indexOf(node);
      if (index >= 0) temporaryNodes.splice(index, 1);
    }
  };
  const context = {
    console,
    Promise,
    setTimeout(fn) { fn(); return 1; },
    document: {
      getElementById(id) { return id === 'content' ? content : null; },
      createElement() { return { style: {}, setAttribute() {}, select() {} }; },
      body,
      execCommand(command) { return command === 'copy' && execCommandResult; }
    },
    navigator: clipboard === undefined ? {} : { clipboard },
    Auth: { onLogin() {}, ready(fn) { fn(); }, isLoggedIn() { return false; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(profileScript(), context);
  return { context, temporaryNodes };
}

test('customer service card stays in normal page flow outside account-rendered content', () => {
  const profile = pageSource();
  const cardStart = profile.indexOf('id="profileCustomerService"');
  const contentStart = profile.indexOf('id="content"');
  const contentEnd = profile.indexOf('</div>', contentStart);

  assert.ok(cardStart > contentEnd, 'the customer-service card must remain available when account rendering is unavailable');
  assert.match(profile, /EriverLife/);
  assert.match(profile, />\u590d\u5236\u5fae\u4fe1\u53f7</);
  assert.match(profile, />\u95ee\u9898\u53cd\u9988</);
  assert.match(profile, /<button[^>]*type="button"[^>]*>\u590d\u5236\u5fae\u4fe1\u53f7<\/button>/);
  assert.match(profile, /<button[^>]*type="button"[^>]*>\u95ee\u9898\u53cd\u9988<\/button>/);
  const card = profile.slice(cardStart, profile.indexOf('</section>', cardStart));
  assert.doesNotMatch(card, /position\s*:\s*fixed/i);
  assert.doesNotMatch(card, /showModal|<dialog|\.showModal\(/);
  assert.match(profile, /@media[\s\S]*?\.profile-customer-service__action[\s\S]*?min-height\s*:\s*44px/i);
});

test('copyProfileWechat copies through Clipboard API and restores the action label', async () => {
  const writes = [];
  const { context, temporaryNodes } = runCopy({ clipboard: { writeText(value) { writes.push(value); return Promise.resolve(); } } });
  const button = { textContent: '\u590d\u5236\u5fae\u4fe1\u53f7' };

  await context.copyProfileWechat(button);

  assert.deepEqual(writes, ['EriverLife']);
  assert.equal(temporaryNodes.length, 0);
  assert.equal(button.textContent, '\u590d\u5236\u5fae\u4fe1\u53f7');
});

test('copyProfileWechat falls back to a temporary textarea when Clipboard API rejects', async () => {
  let execCommandCalls = 0;
  const { context, temporaryNodes } = runCopy({
    clipboard: { writeText() { return Promise.reject(new Error('clipboard blocked')); } },
    execCommandResult: true
  });
  context.document.execCommand = function(command) { execCommandCalls++; return command === 'copy'; };
  const button = { textContent: '\u590d\u5236\u5fae\u4fe1\u53f7' };

  await context.copyProfileWechat(button);

  assert.equal(execCommandCalls, 1);
  assert.equal(temporaryNodes.length, 0, 'the fallback textarea must always be removed');
  assert.equal(button.textContent, '\u590d\u5236\u5fae\u4fe1\u53f7');
});
