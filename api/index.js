// API 总入口——Vercel serverless 函数
// 根据路径转发到对应的 handler
const ping = require('./ping.js');
const aiChat = require('./ai-chat.js');
const credits = require('./credits.js');
const createOrder = require('./create-order.js');
const checkOrder = require('./check-order.js');
const callback = require('./callback.js');
const verifyToken = require('./verify-token.js');
const feedback = require('./feedback.js');

const routes = { ping, 'ai-chat': aiChat, credits, 'create-order': createOrder, 'check-order': checkOrder, callback, 'verify-token': verifyToken, feedback };

module.exports = async function handler(req, res) {
  const path = (req.url || '').split('?')[0].replace('/api/', '').replace(/\/$/, '');
  const fn = routes[path];
  if (fn) return fn(req, res);
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'API not found: ' + path }));
};
