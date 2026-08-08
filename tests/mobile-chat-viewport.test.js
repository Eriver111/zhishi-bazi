const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const pages = ['ai-chat.html', 'zw-ai-chat.html', 'lr-ai-chat.html'];

test('all chat pages use the shared visual viewport height and mobile-safe input type', () => {
  for (const page of pages) {
    const source = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(source, /--chat-viewport-height/);
    assert.match(source, /height:var\(--chat-viewport-height\)/);
    assert.match(source, /@media\s*\(max-width:\s*768px\)[\s\S]*font-size:16px/);
    assert.match(source, /js\/chat-viewport\.js/);
    assert.doesNotMatch(source, /\.page\{[^}]*height:100%;height:100dvh/);
  }
});

test('viewport helper tracks visualViewport changes and keeps messages at the latest item', () => {
  const listeners = {};
  const rootStyle = { values: {}, setProperty(name, value) { this.values[name] = value; } };
  const scrollTarget = { scrollHeight: 1234, scrollTop: 0 };
  const visualViewport = {
    height: 620,
    addEventListener(name, fn) { listeners[name] = fn; },
    removeEventListener() {},
  };
  const windowListeners = {};
  const context = {
    window: {
      innerHeight: 800,
      visualViewport,
      addEventListener(name, fn) { windowListeners[name] = fn; },
      removeEventListener() {},
      requestAnimationFrame(fn) { fn(); },
    },
    document: {
      documentElement: { style: rootStyle },
      getElementById(id) { return id === 'messages' ? scrollTarget : null; },
      readyState: 'complete',
    },
  };
  context.window.document = context.document;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'chat-viewport.js'), 'utf8'), context);
  const cleanup = context.window.ChatViewport.init({ root: context.document.documentElement, scrollTarget });

  assert.equal(rootStyle.values['--chat-viewport-height'], '620px');
  assert.equal(scrollTarget.scrollTop, 1234);
  visualViewport.height = 410;
  listeners.resize();
  assert.equal(rootStyle.values['--chat-viewport-height'], '410px');
  assert.equal(typeof cleanup, 'function');
});
