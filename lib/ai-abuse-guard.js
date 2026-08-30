const crypto = require('crypto');
const auth = require('./auth.js');

const inFlight = new Set();

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 12);
}

function clientIp(req) {
  if (typeof auth.getClientIp === 'function') return auth.getClientIp(req);
  const headers = (req && req.headers) || {};
  const forwarded = String(headers['x-forwarded-for'] || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
  return String(headers['x-real-ip'] || forwarded[forwarded.length - 1] || 'unknown');
}

function allow(key, max, windowMs) {
  // Some isolated endpoint tests replace the auth module with a minimal mock.
  return typeof auth.rateLimit === 'function' ? auth.rateLimit(key, max, windowMs) : true;
}

function beginAiRequest(req, options) {
  options = options || {};
  const route = options.route || 'ai';
  const identity = options.identity ? 'user:' + options.identity : 'ip:' + clientIp(req);
  const identityHash = shortHash(identity);
  const ipHash = shortHash(clientIp(req));
  const minuteMax = Number(options.minuteMax || process.env.AI_USER_CALLS_PER_MINUTE || 6);
  const hourMax = Number(options.hourMax || process.env.AI_USER_CALLS_PER_HOUR || 40);
  const globalHourMax = Number(process.env.AI_GLOBAL_CALLS_PER_HOUR || 300);

  if (!allow('ai:global:hour', globalHourMax, 3600000) ||
      !allow('ai:' + route + ':minute:' + identityHash, minuteMax, 60000) ||
      !allow('ai:' + route + ':hour:' + identityHash, hourMax, 3600000) ||
      !allow('ai:' + route + ':ip-hour:' + ipHash, Math.max(hourMax, 60), 3600000)) {
    console.warn('[ai-guard] blocked route=' + route + ' identity=' + identityHash + ' ip=' + ipHash);
    return { ok: false, reason: 'rate' };
  }

  const slot = route + ':' + identityHash;
  if (inFlight.has(slot)) {
    console.warn('[ai-guard] concurrent route=' + route + ' identity=' + identityHash);
    return { ok: false, reason: 'concurrent' };
  }
  inFlight.add(slot);
  let released = false;
  return {
    ok: true,
    release: function () {
      if (released) return;
      released = true;
      inFlight.delete(slot);
    }
  };
}

module.exports = { beginAiRequest };
