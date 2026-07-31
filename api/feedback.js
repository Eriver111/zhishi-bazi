const crypto = require('crypto');
const feedbackStore = require('../lib/supabase.js');

const MAX_BODY_BYTES = 4096;
const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTACT_LENGTH = 100;
const MAX_PAGE_LENGTH = 32;
const MAX_CONTEXT_BYTES = 1000;
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PAGE_PATTERN = /^[A-Za-z0-9_-]+$/;

function requestHeader(req, name) {
  if (req && typeof req.get === 'function') {
    const value = req.get(name);
    if (value !== undefined) return value;
  }
  const headers = req && req.headers;
  if (!headers) return undefined;
  return headers[name] !== undefined
    ? headers[name]
    : headers[name.toLowerCase()];
}

function requestBodyBytes(req) {
  const declaredLength = Number.parseInt(requestHeader(req, 'content-length'), 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return declaredLength;
  }

  if (req && req.rawBody !== undefined) {
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.length;
    return Buffer.byteLength(String(req.rawBody), 'utf8');
  }

  try {
    return Buffer.byteLength(JSON.stringify((req && req.body) || {}), 'utf8');
  } catch (error) {
    return MAX_BODY_BYTES + 1;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateBody(body) {
  if (!isPlainObject(body)) return { error: 'Invalid request body' };

  if (typeof body.message !== 'string') return { error: 'Invalid message' };
  const message = body.message.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return { error: 'Invalid message' };
  }

  if (body.contact !== undefined && typeof body.contact !== 'string') {
    return { error: 'Invalid contact' };
  }
  const contact = body.contact === undefined ? '' : body.contact.trim();
  if (contact.length > MAX_CONTACT_LENGTH) return { error: 'Invalid contact' };

  if (body.page !== undefined && typeof body.page !== 'string') {
    return { error: 'Invalid page' };
  }
  const page = body.page === undefined ? '' : body.page.trim();
  if (page.length > MAX_PAGE_LENGTH || (page && !PAGE_PATTERN.test(page))) {
    return { error: 'Invalid page' };
  }

  if (body.context !== undefined && !isPlainObject(body.context)) {
    return { error: 'Invalid context' };
  }
  const context = body.context === undefined ? {} : body.context;
  let contextBytes;
  try {
    contextBytes = Buffer.byteLength(JSON.stringify(context), 'utf8');
  } catch (error) {
    return { error: 'Invalid context' };
  }
  if (contextBytes > MAX_CONTEXT_BYTES) return { error: 'Invalid context' };

  return { value: { message, contact, page, context } };
}

function firstClientIp(req) {
  const forwarded = requestHeader(req, 'x-forwarded-for');
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = requestHeader(req, 'x-real-ip');
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  if (req && typeof req.ip === 'string' && req.ip.trim()) return req.ip.trim();
  if (req && req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress);
  if (req && req.connection && req.connection.remoteAddress) {
    return String(req.connection.remoteAddress);
  }
  return 'unknown';
}

function rateSecret() {
  const secret = process.env.FEEDBACK_RATE_SECRET
    || process.env.TOKEN_SECRET
    || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    const error = new Error('Feedback rate-limit secret is unavailable');
    error.code = 'FEEDBACK_STORAGE_UNAVAILABLE';
    throw error;
  }
  return 'feedback-local-development';
}

function clientKey(req, now) {
  const utcDate = now.toISOString().slice(0, 10);
  return crypto.createHash('sha256')
    .update(firstClientIp(req) + rateSecret() + utcDate)
    .digest('hex');
}

function serviceUnavailable(res) {
  return res.status(503).json({
    ok: false,
    error: 'Feedback service is temporarily unavailable'
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (requestBodyBytes(req) > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request body too large' });
  }

  const validation = validateBody(req.body);
  if (validation.error) {
    return res.status(400).json({ ok: false, error: validation.error });
  }

  try {
    const now = new Date();
    const anonymousClientKey = clientKey(req, now);
    const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recentCount = await feedbackStore.countRecentFeedback(anonymousClientKey, since);
    if (recentCount >= RATE_LIMIT_COUNT) {
      return res.status(429).json({ ok: false, error: 'Too many feedback requests' });
    }

    await feedbackStore.createFeedback({
      ...validation.value,
      client_key: anonymousClientKey,
      created_at: now.toISOString()
    }, {
      since,
      maxRecent: RATE_LIMIT_COUNT
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error && error.code === 'FEEDBACK_RATE_LIMITED') {
      return res.status(429).json({ ok: false, error: 'Too many feedback requests' });
    }
    if (error && error.code === 'FEEDBACK_STORAGE_UNAVAILABLE') {
      return serviceUnavailable(res);
    }
    return res.status(500).json({ ok: false, error: 'Unable to save feedback' });
  }
};
