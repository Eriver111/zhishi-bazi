/**
 * /api/feedback.js
 * 收集用户反馈 → 追加写入文件
 * 数据格式: JSONL（每行一条 JSON）
 */
const fs = require('fs');
const path = require('path');
const DATA_FILE = '/tmp/feedback.jsonl';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, contact, context } = req.body || {};
    if (!message || !message.trim()) {
      return res.status(400).json({ ok: false, error: '内容不能为空' });
    }

    const record = {
      time: new Date().toISOString(),
      message: message.trim(),
      contact: (contact || '').trim(),
      context: context || {}
    };

    // 追加一行 JSON
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(DATA_FILE, line, 'utf8');

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
