const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const handler = require('../api/feedback.js');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

test('feedback API records the profile page without dropping legacy context', async () => {
  const originalAppendFileSync = fs.appendFileSync;
  const writes = [];
  fs.appendFileSync = function(file, data, encoding) {
    writes.push({ file, data, encoding });
  };

  try {
    const res = response();
    await handler({
      method: 'POST',
      body: {
        message: '  报告没有恢复  ',
        contact: '  EriverLife  ',
        page: 'profile',
        context: { reportId: 'report-7' }
      }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(writes.length, 1);
    assert.equal(path.basename(writes[0].file), 'feedback.jsonl');
    assert.equal(writes[0].encoding, 'utf8');

    const record = JSON.parse(writes[0].data);
    assert.equal(record.message, '报告没有恢复');
    assert.equal(record.contact, 'EriverLife');
    assert.equal(record.page, 'profile');
    assert.deepEqual(record.context, { reportId: 'report-7' });
  } finally {
    fs.appendFileSync = originalAppendFileSync;
  }
});
