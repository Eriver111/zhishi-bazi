# Profile Customer Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a prominent but non-intrusive customer-service card in the personal center for both logged-in users and guests.

**Architecture:** The card is static profile-page content outside the login-dependent render container, so it cannot disappear when authentication or account APIs fail. It reuses the existing WeChat ID and feedback endpoint, with a small profile-specific feedback dialog.

**Tech Stack:** HTML/CSS, browser JavaScript, existing `/api/feedback` handler, Node built-in test runner.

## Global Constraints

- The customer-service card must be visible whether the visitor is logged in or logged out.
- WeChat ID remains exactly `EriverLife`.
- The card must not auto-open, cover account content, or add a site-wide floating launcher.
- Existing profile credits, invitations, purchase history, saved charts, and report library must remain unchanged.
- Do not push or deploy during implementation.

---

### Task 1: Always-Visible Customer Service Card

**Files:**
- Modify: `profile.html`
- Create: `tests/profile-customer-service.test.js`

**Interfaces:**
- Consumes: no account data.
- Produces: a visible card with copy-WeChat and feedback actions.

- [ ] **Step 1: Write the failing structural test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'profile.html'), 'utf8');

test('customer service remains outside login-dependent profile content', () => {
  const contentEnd = html.indexOf('</div>', html.indexOf('id="content"'));
  const service = html.indexOf('id="profileCustomerService"');
  assert.ok(service > contentEnd);
  assert.match(html, /EriverLife/);
  assert.match(html, /复制微信号/);
  assert.match(html, /问题反馈/);
});

test('customer service does not use an automatic popup or floating launcher', () => {
  assert.doesNotMatch(html, /profileCustomerService[^>]+position:\s*fixed/);
  assert.doesNotMatch(html, /DOMContentLoaded[^]*openProfileFeedback/);
});
```

- [ ] **Step 2: Run the structural test and verify it fails**

Run: `node --test tests/profile-customer-service.test.js`  
Expected: FAIL because the card is absent.

- [ ] **Step 3: Add the static card after `#content`**

Use semantic buttons and this copy:

```html
<section class="profile-service" id="profileCustomerService" aria-labelledby="profileServiceTitle">
  <div>
    <div class="profile-service-kicker">使用帮助</div>
    <h2 id="profileServiceTitle">联系客服</h2>
    <p>支付、报告恢复或使用异常，都可以联系我们。</p>
  </div>
  <div class="profile-service-id"><span>微信</span><strong>EriverLife</strong></div>
  <div class="profile-service-actions">
    <button type="button" onclick="copyProfileWechat(this)">复制微信号</button>
    <button type="button" onclick="openProfileFeedback()">问题反馈</button>
  </div>
</section>
```

Style it as a normal card in document flow, with high-contrast headings and mobile buttons at least 44px high.

- [ ] **Step 4: Implement clipboard fallback**

```js
window.copyProfileWechat = function(button) {
  var value = 'EriverLife';
  var done = function() {
    var old = button.textContent;
    button.textContent = '已复制';
    setTimeout(function(){ button.textContent = old; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done);
    return;
  }
  var input = document.createElement('textarea');
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  done();
};
```

- [ ] **Step 5: Run the structural tests**

Run: `node --test tests/profile-customer-service.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit the visible service card**

```bash
git add profile.html tests/profile-customer-service.test.js
git commit -m "feat: add customer service to profile"
```

### Task 2: Reuse the Existing Feedback API

**Files:**
- Modify: `profile.html`
- Modify: `tests/profile-customer-service.test.js`

**Interfaces:**
- Consumes: message and optional contact details.
- Produces: `POST /api/feedback` with `{ message, contact, page:'profile' }`.

- [ ] **Step 1: Add failing feedback behavior tests**

Assert the source contains:

```js
assert.match(html, /fetch\(['"]\/api\/feedback/);
assert.match(html, /page:\s*['"]profile['"]/);
assert.match(html, /maxlength="500"/);
assert.match(html, /aria-modal="true"/);
```

Use a VM test to call `submitProfileFeedback()` with an empty message and assert no request is sent.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/profile-customer-service.test.js`  
Expected: the feedback behavior test FAILS.

- [ ] **Step 3: Add an accessible feedback dialog**

Include:

- a 500-character message textarea;
- optional contact input;
- close and submit buttons;
- `role="dialog"` and `aria-modal="true"`;
- Escape-to-close behavior;
- inline submitting, success, and error states.

- [ ] **Step 4: Submit to the existing API**

```js
window.submitProfileFeedback = function() {
  var message = document.getElementById('profileFeedbackMessage').value.trim();
  var contact = document.getElementById('profileFeedbackContact').value.trim();
  if (!message) return setProfileFeedbackStatus('请先填写问题或建议', true);
  fetch('/api/feedback', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ message:message, contact:contact, page:'profile' })
  }).then(function(response){ return response.json(); })
    .then(function(data){
      if (data.error) throw new Error(data.error);
      setProfileFeedbackStatus('已提交，我们会尽快查看', false);
    })
    .catch(function(){ setProfileFeedbackStatus('提交失败，请复制微信号联系我们', true); });
};
```

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/profile-customer-service.test.js tests/profile-report-library.test.js
node --test tests/*.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Verify logged-in and logged-out layouts**

Open `/profile` in desktop and mobile widths. Confirm the card is visible below the login prompt for guests and below account content for signed-in users, with no overlap or horizontal scrolling.

- [ ] **Step 7: Commit feedback integration**

```bash
git add profile.html tests/profile-customer-service.test.js
git commit -m "feat: add profile feedback contact flow"
```

