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

function runFeedback({ fetchImpl } = {}) {
  const listeners = {};
  const requests = [];
  const makeElement = (overrides = {}) => Object.assign({
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    style: {},
    focus() { document.activeElement = this; },
    setAttribute() {},
    removeAttribute() {}
  }, overrides);
  const elements = {
    content: makeElement({ innerHTML: '' }),
    profileFeedbackDialog: makeElement({ hidden: true }),
    profileFeedbackMessage: makeElement(),
    profileFeedbackContact: makeElement(),
    profileFeedbackSubmit: makeElement({ textContent: '提交反馈' }),
    profileFeedbackStatus: makeElement(),
    profileCustomerServiceStatus: makeElement()
  };
  const document = {
    activeElement: null,
    body: { appendChild() {}, removeChild() {} },
    getElementById(id) { return elements[id] || null; },
    createElement() { return makeElement({ select() {} }); },
    execCommand() { return true; },
    addEventListener(type, listener) { listeners[type] = listener; }
  };
  const fetch = fetchImpl || ((url, options) => {
    requests.push({ url, options });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  });
  const context = {
    console,
    Promise,
    URLSearchParams,
    setTimeout(fn) { fn(); return 1; },
    document,
    navigator: {},
    fetch,
    Auth: { onLogin() {}, ready(fn) { fn(); }, isLoggedIn() { return false; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(profileScript(), context);
  return { context, document, elements, listeners, requests };
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

test('feedback dialog exposes labelled accessible fields, controls, and inline status', () => {
  const profile = pageSource();
  const dialogStart = profile.indexOf('id="profileFeedbackDialog"');
  const dialogEnd = profile.indexOf('</div>', dialogStart);
  const dialog = profile.slice(dialogStart, dialogEnd);

  assert.ok(dialogStart > profile.indexOf('</section>'), 'dialog stays outside the account and customer-service cards');
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /aria-labelledby="profileFeedbackTitle"/);
  assert.match(dialog, /id="profileFeedbackTitle"[^>]*>问题反馈</);
  assert.match(dialog, /button[^>]*aria-label="关闭"/);
  assert.match(dialog, /label[^>]*for="profileFeedbackMessage"[^>]*>问题或建议</);
  assert.match(dialog, /textarea[^>]*id="profileFeedbackMessage"[^>]*maxlength="500"/);
  assert.match(dialog, /label[^>]*for="profileFeedbackContact"[^>]*>联系方式（选填）</);
  assert.match(dialog, /input[^>]*id="profileFeedbackContact"[^>]*maxlength="\d+"/);
  assert.match(dialog, /button[^>]*id="profileFeedbackSubmit"[^>]*type="submit"/);
  assert.match(dialog, /id="profileFeedbackStatus"[^>]*(?:role="status"|aria-live="polite")/);
});

test('empty or whitespace-only feedback stays local and explains what is required', async () => {
  const { context, elements, requests } = runFeedback();
  elements.profileFeedbackMessage.value = '  \n ';

  const result = await context.submitProfileFeedback();

  assert.equal(result, false);
  assert.equal(requests.length, 0);
  assert.equal(elements.profileFeedbackStatus.textContent, '请先填写问题或建议。');
  assert.equal(context.document.activeElement, elements.profileFeedbackMessage);
});

test('valid guest feedback posts the exact profile payload and shows success', async () => {
  const { context, elements, requests } = runFeedback();
  elements.profileFeedbackMessage.value = '  支付后报告没有恢复  ';
  elements.profileFeedbackContact.value = '  wx-id  ';

  const result = await context.submitProfileFeedback();

  assert.equal(result, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/feedback');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(requests[0].options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    message: '支付后报告没有恢复',
    contact: 'wx-id',
    page: 'profile'
  });
  assert.equal(elements.profileFeedbackStatus.textContent, '已提交，我们会尽快查看。');
});

test('network, non-2xx, and API error responses show the fallback without rejecting', async () => {
  const failures = [
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'bad request' }) }),
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'write failed' }) })
  ];

  for (const fetchImpl of failures) {
    const { context, elements } = runFeedback({ fetchImpl });
    elements.profileFeedbackMessage.value = '需要帮助';
    const result = await context.submitProfileFeedback();
    assert.equal(result, false);
    assert.equal(elements.profileFeedbackStatus.textContent, '提交失败，请复制微信号联系我们。');
    assert.equal(elements.profileFeedbackSubmit.disabled, false);
  }
});

test('duplicate submit attempts share one in-flight request and expose submitting state', async () => {
  let resolveRequest;
  let requestCount = 0;
  const pending = new Promise((resolve) => { resolveRequest = resolve; });
  const { context, elements } = runFeedback({
    fetchImpl() {
      requestCount += 1;
      return pending;
    }
  });
  elements.profileFeedbackMessage.value = '重复点击测试';

  const first = context.submitProfileFeedback();
  const second = context.submitProfileFeedback();

  assert.equal(requestCount, 1);
  assert.equal(elements.profileFeedbackSubmit.disabled, true);
  assert.equal(elements.profileFeedbackSubmit.textContent, '提交中…');
  assert.equal(await second, false);
  resolveRequest({ ok: true, json: () => Promise.resolve({ ok: true }) });
  assert.equal(await first, true);
  assert.equal(elements.profileFeedbackSubmit.disabled, false);
  assert.equal(elements.profileFeedbackSubmit.textContent, '提交反馈');
});

test('dialog opens only on demand, focuses the message, closes on Escape, and restores opener focus', () => {
  const { context, document, elements, listeners, requests } = runFeedback();
  const opener = { focusCalled: 0, focus() { this.focusCalled += 1; document.activeElement = this; } };

  assert.equal(elements.profileFeedbackDialog.hidden, true);
  assert.equal(document.activeElement, null);
  assert.equal(requests.length, 0);

  context.openProfileFeedback(opener);
  assert.equal(elements.profileFeedbackDialog.hidden, false);
  assert.equal(document.activeElement, elements.profileFeedbackMessage);

  listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(elements.profileFeedbackDialog.hidden, true);
  assert.equal(opener.focusCalled, 1);
  assert.equal(document.activeElement, opener);
});
