/**
 * 数据存储模块 - Supabase + 本地文件回退
 * v4.2: 文件持久化 memStore，服务器重启不丢兑换码
 */

const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const STORE_FILE = path.join(__dirname, '..', '.data-store.json');

let supabase = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey &&
      !supabaseUrl.includes('your-project') && supabaseUrl.length > 20) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
      console.warn('Supabase 初始化失败，使用本地存储');
    }
  }
  return supabase;
}

// ===== 本地文件持久化存储 =====
const memStore = {
  credits: {},
  orderIndex: {},
  subscriptions: {},
  reportOrders: {},
  freeLog: {},
  chatHistory: [],
  // Feedback is intentionally excluded from saveStore/loadStore. Local and
  // test fallback must remain process-memory only because the web root is
  // statically served.
  feedback: []
};

// 启动时从文件加载
(function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (loaded.credits) memStore.credits = loaded.credits;
      if (loaded.orderIndex) memStore.orderIndex = loaded.orderIndex;
      if (loaded.subscriptions) memStore.subscriptions = loaded.subscriptions;
      if (loaded.reportOrders) memStore.reportOrders = loaded.reportOrders;
      console.log('[store] 已从文件加载 ' + Object.keys(memStore.credits).length + ' 条兑换码记录');
    }
  } catch (e) { /* 忽略 */ }
})();

// 持久化到文件（仅写入核心数据，不含 chatHistory/freeLog）
function saveStore() {
  try {
    const data = {
      credits: memStore.credits,
      orderIndex: memStore.orderIndex,
      subscriptions: memStore.subscriptions,
      reportOrders: memStore.reportOrders
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { console.error('[store] 持久化失败:', e.message); }
}

function feedbackStorageUnavailable(cause) {
  const error = new Error('Feedback storage is unavailable');
  error.code = 'FEEDBACK_STORAGE_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

function feedbackRateLimited() {
  const error = new Error('Feedback rate limit reached');
  error.code = 'FEEDBACK_RATE_LIMITED';
  return error;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production'
    || process.env.VERCEL_ENV === 'production';
}

/**
 * Count accepted feedback records for one anonymous client key since an ISO
 * timestamp. Supabase keeps the count shared across PM2/Vercel instances;
 * local/test runs use process memory only.
 */
async function countRecentFeedback(clientKey, since) {
  const db = getSupabase();
  if (db) {
    try {
      const { count, error } = await db.from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('client_key', clientKey)
        .gte('created_at', since);
      if (error) throw error;
      return count || 0;
    } catch (error) {
      throw feedbackStorageUnavailable(error);
    }
  }

  if (isProductionRuntime()) throw feedbackStorageUnavailable();
  const sinceTime = Date.parse(since);
  return memStore.feedback.filter(record =>
    record.client_key === clientKey
      && Date.parse(record.created_at) >= sinceTime
  ).length;
}

/**
 * Store a validated feedback record. No fallback from a configured Supabase
 * failure is allowed: production must never claim success without durability.
 */
async function createFeedback(record, rateLimit) {
  const db = getSupabase();
  if (db) {
    try {
      if (rateLimit) {
        const { data, error } = await db.rpc('create_feedback_rate_limited', {
          p_message: record.message,
          p_contact: record.contact,
          p_page: record.page,
          p_context: record.context,
          p_client_key: record.client_key,
          p_created_at: record.created_at,
          p_since: rateLimit.since,
          p_limit: rateLimit.maxRecent
        });
        if (error) throw error;
        const outcome = Array.isArray(data) ? data[0] : data;
        if (!outcome || outcome.accepted !== true) throw feedbackRateLimited();
        return { id: outcome.feedback_id, ...record };
      }

      const { data, error } = await db.from('feedback')
        .insert(record)
        .select('*')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Feedback insert returned no row');
      return data;
    } catch (error) {
      if (error && error.code === 'FEEDBACK_RATE_LIMITED') throw error;
      throw feedbackStorageUnavailable(error);
    }
  }

  if (isProductionRuntime()) throw feedbackStorageUnavailable();
  if (rateLimit) {
    const sinceTime = Date.parse(rateLimit.since);
    const recentCount = memStore.feedback.filter(entry =>
      entry.client_key === record.client_key
        && Date.parse(entry.created_at) >= sinceTime
    ).length;
    if (recentCount >= rateLimit.maxRecent) throw feedbackRateLimited();
  }
  const memoryRecord = { id: 'memory-' + (memStore.feedback.length + 1), ...record };
  memStore.feedback.push(memoryRecord);
  return memoryRecord;
}

function ensureMemDefaults(code, extra) {
  if (!memStore.credits[code]) {
    memStore.credits[code] = {
      code, credits: 0, total_used: 0, order_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...extra
    };
  }
  return memStore.credits[code];
}

// ===== 导出 API =====

/** 根据兑换码获取用户额度 */
async function getCreditsByCode(code) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from('user_credits').select('*').eq('code', code).single();
    if (error || !data) return null;
    return data;
  }
  return memStore.credits[code] || null;
}

/** 扣减一次额度（次数包模式） */
async function deductCredit(code) {
  // 先检查是否有有效月度会员
  const monthly = await isMonthlyActive(code);
  if (monthly) {
    // 月会员不扣次数，但返回当前会员信息
    return { credits: -1, _monthly: true, _expires: monthly.expires_at };
  }

  const db = getSupabase();
  if (db) {
    const rec = await getCreditsByCode(code);
    if (!rec || rec.credits <= 0) return null;
    const { data, error } = await db
      .from('user_credits')
      .update({ credits: rec.credits - 1, total_used: rec.total_used + 1, updated_at: new Date().toISOString() })
      .eq('code', code).select().single();
    if (error) return null;
    return data;
  }
  const rec = memStore.credits[code];
  if (!rec || rec.credits <= 0) return null;
  rec.credits -= 1;
  rec.total_used += 1;
  rec.updated_at = new Date().toISOString();
  saveStore();
  return rec;
}

/** 插入新兑换码（次数包），可选 user_id 在插入时直接绑定 */
async function insertCredits(code, orderId, creditCount, channel, userId) {
  const count = creditCount || parseInt(process.env.QUESTIONS_PER_ORDER) || 5;
  const db = getSupabase();
  if (db) {
    var row={code, order_id: orderId, credits: count, total_used: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()};
    if(channel) row.channel=channel;
    if(userId) row.user_id=userId;
    const { data, error } = await db.from('user_credits').insert(row).select().single();
    if (error) return null;
    return data;
  }
  if (memStore.credits[code]) return null;
  var rec = ensureMemDefaults(code, { credits: count, order_id: orderId });
  if(userId) rec.user_id = userId;
  memStore.orderIndex[orderId] = code;
  saveStore();
  return rec;
}

/** 激活月度会员，可选 user_id 在插入时直接绑定 */
async function activateMonthly(code, orderId, durationDays, channel, userId) {
  const days = durationDays || parseInt(process.env.MONTHLY_DURATION_DAYS) || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400000);

  const db = getSupabase();
  if (db) {
    var row={code, order_id: orderId, starts_at: now.toISOString(), expires_at: expires.toISOString(), created_at: now.toISOString()};
    if(channel) row.channel=channel;
    if(userId) row.user_id=userId;
    const { data, error } = await db.from('user_subscriptions').insert(row).select().single();
    if (error) return null;
    return data;
  }
  memStore.subscriptions[code] = { code, order_id: orderId, starts_at: now.toISOString(), expires_at: expires.toISOString() };
  memStore.orderIndex[orderId] = code;
  saveStore();
  return memStore.subscriptions[code];
}

/** 检查月度会员是否有效 */
async function isMonthlyActive(code) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from('user_subscriptions').select('*').eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0];
  }
  const sub = memStore.subscriptions[code];
  if (!sub) return null;
  if (new Date(sub.expires_at) < new Date()) return null;
  return sub;
}

/** 检查月度会员是否有效（by user_id） */
async function isMonthlyActiveByUserId(userId) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from('user_subscriptions').select('*').eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0];
  }
  // 内存回退：遍历查找
  for (var k in memStore.subscriptions) {
    var sub = memStore.subscriptions[k];
    if (sub.user_id === userId && new Date(sub.expires_at) >= new Date()) return sub;
  }
  return null;
}

/** 检查订单是否已处理（Supabase + 文件降级 + 内存回退） */
async function getCreditsByOrderId(orderId) {
  const db = getSupabase();
  if (db) {
    // 先查次数表
    const { data: d1 } = await db.from('user_credits').select('*').eq('order_id', orderId).maybeSingle();
    if (d1) return { ...d1, _type: 'credits' };
    // 再查订阅表
    const { data: d2 } = await db.from('user_subscriptions').select('*').eq('order_id', orderId).maybeSingle();
    if (d2) return { ...d2, credits: -1, _type: 'monthly' };
    // Supabase 未查到 → 尝试文件降级恢复
    const fallback = _tryFallbackRecovery(orderId);
    if (fallback) return fallback;
    return null;
  }
  // 内存回退
  const code = memStore.orderIndex[orderId];
  if (code) {
    if (memStore.credits[code]) return { ...memStore.credits[code], _type: 'credits' };
    if (memStore.subscriptions[code]) return { ...memStore.subscriptions[code], credits: -1, _type: 'monthly' };
  }
  // 内存也未查到 → 尝试文件降级恢复
  const fallback2 = _tryFallbackRecovery(orderId);
  if (fallback2) return fallback2;
  return null;
}

/** 从文件降级存储恢复兑换码 */
function _tryFallbackRecovery(orderId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const safeName = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(__dirname, '..', '.fallback-codes', safeName + '.json');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.code) {
      return {
        code: data.code,
        credits: data.type === 'monthly' ? -1 : (data.credits || 5),
        order_id: data.order_id,
        created_at: data.created_at,
        _type: data.type === 'monthly' ? 'monthly' : 'credits',
        _recovered: true
      };
    }
    return null;
  } catch (e) { return null; }
}

/** 保存聊天记录 */
async function getReportOrder(orderId) {
  const db = getSupabase();
  if (!db) return memStore.reportOrders[orderId] || null;
  try {
    const { data, error } = await db.from('report_orders').select('*').eq('order_id', orderId).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.error('[supabase] getReportOrder 降级到本地存储:', e.message);
    return memStore.reportOrders[orderId] || null;
  }
}

async function createReportOrder(order) {
  const existing = await getReportOrder(order.order_id);
  if (existing) return existing;
  const row = { ...order, status:'pending', created_at:new Date().toISOString(), paid_at:null };
  const db = getSupabase();
  if (!db) {
    memStore.reportOrders[row.order_id] = row;
    saveStore();
    return row;
  }
  try {
    const { data, error } = await db.from('report_orders').insert(row).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('[supabase] createReportOrder 降级到本地存储:', e.message);
    memStore.reportOrders[row.order_id] = row;
    saveStore();
    return row;
  }
}

async function markReportOrderPaid(orderId, paidAt) {
  const existing = await getReportOrder(orderId);
  if (!existing) return null;
  if (existing.status === 'paid') return existing;
  const patch = { status:'paid', paid_at:paidAt || new Date().toISOString() };
  const db = getSupabase();
  if (!db) {
    const current = memStore.reportOrders[orderId];
    if (!current) return null;
    if (current.status === 'paid') return current;
    Object.assign(current, patch);
    saveStore();
    return current;
  }
  try {
    const { data, error } = await db.from('report_orders').update(patch)
      .eq('order_id', orderId).eq('status', 'pending').select().maybeSingle();
    if (error) throw error;
    if (data) return data;
    return await getReportOrder(orderId);
  } catch (e) {
    console.error('[supabase] markReportOrderPaid 降级到本地存储:', e.message);
    const current = memStore.reportOrders[orderId];
    if (!current) return null;
    if (current.status === 'paid') return current;
    Object.assign(current, patch);
    saveStore();
    return current;
  }
}

async function getPaidReportAccess(userId, reportType, reportKey) {
  if (!userId) return { unlocked:false, paid_at:null };
  const db = getSupabase();
  if (!db) {
    const row = Object.values(memStore.reportOrders).find(function(row) {
      return row.user_id === userId && row.report_type === reportType &&
        row.report_key === reportKey && row.status === 'paid';
    });
    return { unlocked: !!row, paid_at: row ? (row.paid_at || null) : null };
  }
  try {
    const { data, error } = await db.from('report_orders').select('order_id,paid_at')
      .eq('user_id', userId).eq('report_type', reportType)
      .eq('report_key', reportKey).eq('status', 'paid').limit(1);
    if (error) throw error;
    const row = data && data[0];
    return { unlocked: !!row, paid_at: row ? (row.paid_at || null) : null };
  } catch (e) {
    console.error('[supabase] getPaidReportAccess 降级到本地存储:', e.message);
    const row = Object.values(memStore.reportOrders).find(function(row) {
      return row.user_id === userId && row.report_type === reportType &&
        row.report_key === reportKey && row.status === 'paid';
    });
    return { unlocked: !!row, paid_at: row ? (row.paid_at || null) : null };
  }
}

async function hasPaidReport(userId, reportType, reportKey) {
  const access = await getPaidReportAccess(userId, reportType, reportKey);
  return !!(access && access.unlocked);
}

async function listPaidReports(userId) {
  const fields = 'report_type,report_key,report_params,label,paid_at';
  const db = getSupabase();
  if (!db) {
    return Object.values(memStore.reportOrders)
      .filter(function(row) { return row.user_id === userId && row.status === 'paid'; })
      .sort(function(a, b) { return String(b.paid_at).localeCompare(String(a.paid_at)); })
      .map(function(row) { return { report_type:row.report_type, report_key:row.report_key,
        report_params:row.report_params, label:row.label, paid_at:row.paid_at }; });
  }
  try {
    const { data, error } = await db.from('report_orders').select(fields)
      .eq('user_id', userId).eq('status', 'paid').order('paid_at', { ascending:false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('[supabase] listPaidReports 降级到本地存储:', e.message);
    return Object.values(memStore.reportOrders)
      .filter(function(row) { return row.user_id === userId && row.status === 'paid'; })
      .sort(function(a, b) { return String(b.paid_at).localeCompare(String(a.paid_at)); })
      .map(function(row) { return { report_type:row.report_type, report_key:row.report_key,
        report_params:row.report_params, label:row.label, paid_at:row.paid_at }; });
  }
}

async function saveChatHistory(code, role, content) {
  const db = getSupabase();
  if (db) {
    try { await db.from('chat_history').insert({ code, role, content, created_at: new Date().toISOString() }); } catch (e) {}
    return;
  }
  memStore.chatHistory.push({ code, role, content, created_at: new Date().toISOString() });
  if (memStore.chatHistory.length > 500) memStore.chatHistory.splice(0, 100); // 上限500，超了删最早的100条
}

/** 记录免费次数使用（双标识：浏览器ID + 服务端指纹） */
async function trackFreeUsage(clientId, serverFingerprint) {
  var fb2=parseInt(process.env.FREE_CREDITS_PER_DEVICE);
  var maxFree=(isNaN(fb2)?2:fb2); // 未登录用户仅基础次数
  const db = getSupabase();

  // 同时以两个标识记录，取最大值防止绕过
  async function bumpOne(id) {
    if (db) {
      const { data } = await db.from('free_credits_log').select('*').eq('identifier', id).maybeSingle();
      const newCount = (data ? data.used_count : 0) + 1;
      if (data) {
        await db.from('free_credits_log').update({ used_count: newCount, updated_at: new Date().toISOString() }).eq('identifier', id);
      } else {
        await db.from('free_credits_log').insert({ identifier: id, used_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      return newCount;
    }
    if (!memStore.freeLog[id]) memStore.freeLog[id] = 0;
    memStore.freeLog[id]++;
    return memStore.freeLog[id];
  }

  // 分别更新两个标识
  const cUsed = await bumpOne(clientId);
  if (serverFingerprint && serverFingerprint !== clientId) {
    await bumpOne(serverFingerprint);
  }

  return { used: cUsed, remaining: Math.max(0, maxFree - cUsed) };
}

/** 查询免费次数使用情况 */
async function getFreeUsage(identifier) {
  var fb=parseInt(process.env.FREE_CREDITS_PER_DEVICE);
  var maxFree=(isNaN(fb)?2:fb); // 未登录用户仅基础次数，注册奖励+3在 ai-chat.js 里加
  const db = getSupabase();
  if (db) {
    const { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).maybeSingle();
    const used = data ? data.used_count : 0;
    return { used, remaining: Math.max(0, maxFree - used) };
  }
  const used = memStore.freeLog[identifier] || 0;
  return { used, remaining: Math.max(0, maxFree - used) };
}

// ==================== v4.0 用户系统 ====================

/** 根据邮箱查找用户 */
async function getUserByEmail(email) {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.from('users').select('*').eq('email', email.toLowerCase().trim()).single();
  return data || null;
}

/** 创建新用户 */
async function createUser(email, passwordHash, phone) {
  const db = getSupabase();
  if (!db) throw new Error('数据库不可用');
  const { data, error } = await db.from('users')
    .insert({ email: email.toLowerCase().trim(), password: passwordHash, phone: phone || null, created_at: new Date().toISOString() })
    .select('id,email,phone,created_at').single();
  if (error) throw new Error(error.message || '注册失败');
  return data;
}

/** 根据 ID 获取用户 */
async function getUserById(userId) {
  const db = getSupabase();
  if (!db) return null;
  const { data } = await db.from('users').select('id,email,phone,created_at').eq('id', userId).single();
  return data || null;
}

/** 同步用户数据（key-value） */
async function syncUserData(userId, key, value) {
  const db = getSupabase();
  if (!db) return;
  try {
    await db.from('user_data').upsert({
      user_id: userId, key, value,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id,key' });
  } catch (e) { /* 忽略 */ }
}

/** 获取用户所有数据 */
async function getUserData(userId) {
  const db = getSupabase();
  if (!db) return {};
  const { data } = await db.from('user_data').select('key,value').eq('user_id', userId);
  const result = {};
  if (data) data.forEach(function(d) { result[d.key] = d.value; });
  return result;
}

/** 将兑换码关联到用户 */
async function linkCodeToUser(code, userId) {
  const db = getSupabase();
  if (db) {
    try {
      await db.from('user_credits').update({ user_id: userId }).eq('code', code).is('user_id', null);
      await db.from('user_subscriptions').update({ user_id: userId }).eq('code', code).is('user_id', null);
    } catch (e) { /* 忽略 */ }
  }
  // 同步更新内存/文件存储
  if (memStore.credits[code]) memStore.credits[code].user_id = userId;
  if (memStore.subscriptions[code]) memStore.subscriptions[code].user_id = userId;
  saveStore();
}

/** 获取用户关联的所有积分 */
async function getUserCredits(userId) {
  const db = getSupabase();
  if (db) {
    const { data } = await db.from('user_credits').select('credits').eq('user_id', userId);
    if (data && data.length > 0) {
      return data.reduce(function(sum, r) { return sum + (r.credits || 0); }, 0);
    }
  }
  // 内存/文件回退
  var total = 0;
  for (var k in memStore.credits) {
    var rec = memStore.credits[k];
    if (rec.user_id === userId) total += (rec.credits || 0);
  }
  return total;
}

/** 从用户关联的积分中扣减 1 次（优先扣剩余最多的那个码） */
async function deductCreditByUser(userId) {
  // 先检查是否有有效月度会员
  const monthly = await isMonthlyActiveByUserId(userId);
  if (monthly) {
    return { credits: -1, _monthly: true, _expires: monthly.expires_at };
  }

  const db = getSupabase();
  if (db) {
    // 找到用户关联的所有有剩余次数的兑换码，按剩余次数降序
    const { data: codes } = await db.from('user_credits')
      .select('*').eq('user_id', userId).gt('credits', 0)
      .order('credits', { ascending: false });
    if (!codes || codes.length === 0) return null;

    // 扣减剩余最多的那个码
    const target = codes[0];
    const { data, error } = await db.from('user_credits')
      .update({ credits: target.credits - 1, total_used: target.total_used + 1, updated_at: new Date().toISOString() })
      .eq('code', target.code).select().single();
    if (error) return null;
    return data;
  }
  // 内存回退
  for (var k in memStore.credits) {
    var rec = memStore.credits[k];
    if (rec.user_id === userId && rec.credits > 0) {
      rec.credits -= 1;
      rec.total_used += 1;
      rec.updated_at = new Date().toISOString();
      return rec;
    }
  }
  return null;
}

/** 获取用户的聊天历史 */
async function getUserChatHistory(userId, limit) {
  var lim = limit || 50;
  const db = getSupabase();
  if (!db) return [];
  const { data } = await db.from('chat_history')
    .select('role,content,created_at').eq('user_id', userId)
    .order('created_at', { ascending: true }).limit(lim);
  return data || [];
}

/** 保存聊天记录（带 user_id） */
async function saveUserChatHistory(userId, role, content) {
  const db = getSupabase();
  if (!db) return;
  try {
    await db.from('chat_history').insert({
      user_id: userId, code: '', role, content,
      created_at: new Date().toISOString()
    });
  } catch (e) { /* 忽略 */ }
}

/** 使用 user_id 记录免费次数 */
async function trackFreeUsageByUser(userId) {
  var maxFree = parseInt(process.env.FREE_CREDITS_PER_DEVICE) || 2;
  var db = getSupabase();
  if (!db) return { used: 0, remaining: maxFree };
  var identifier = 'user_' + userId;
  try {
    var { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).maybeSingle();
    var used = data ? data.used_count : 0;
    return { used: used, remaining: Math.max(0, maxFree - used) };
  } catch (e) {
    return { used: 0, remaining: maxFree };
  }
}

/** 增加用户免费次数使用记录 */
async function bumpFreeUsageByUser(userId) {
  var db = getSupabase();
  if (!db) return 1;
  var identifier = 'user_' + userId;
  try {
    var { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).maybeSingle();
    var newCount = (data ? data.used_count : 0) + 1;
    if (data) {
      await db.from('free_credits_log').update({ used_count: newCount, updated_at: new Date().toISOString() }).eq('identifier', identifier);
    } else {
      await db.from('free_credits_log').insert({ identifier: identifier, used_count: 1, user_id: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    return newCount;
  } catch (e) { return 1; }
}

/** 绑定手机号到用户 */
async function bindPhoneToUser(userId, phone) {
  var db = getSupabase();
  if (!db) return false;
  try {
    var { data } = await db.from('users').update({ phone: phone }).eq('id', userId).select('id').single();
    return !!data;
  } catch (e) { return false; }
}

// ===== 自动同步：内存→Supabase（Supabase 恢复后自动补齐数据） =====
var _lastSyncAttempt = 0;

async function syncMemToSupabase() {
  var db = getSupabase();
  if (!db) return; // Supabase 不可用，跳过
  if (Date.now() - _lastSyncAttempt < 30000) return; // 30秒内不同步多次
  _lastSyncAttempt = Date.now();

  try {
    // 同步 user_credits
    for (var code in memStore.credits) {
      var rec = memStore.credits[code];
      if (rec._synced) continue;
      try {
        var { data: exist } = await db.from('user_credits').select('code').eq('code', code).maybeSingle();
        if (!exist) {
          await db.from('user_credits').insert({
            code: code, order_id: rec.order_id || '', credits: rec.credits || 0,
            total_used: rec.total_used || 0, user_id: rec.user_id || null,
            channel: rec.channel || null,
            created_at: rec.created_at || new Date().toISOString(),
            updated_at: rec.updated_at || new Date().toISOString()
          });
        }
        rec._synced = true;
      } catch(e) { /* 单条失败不影响其他 */ }
    }

    // 同步 user_subscriptions
    for (var subCode in memStore.subscriptions) {
      var sub = memStore.subscriptions[subCode];
      if (sub._synced) continue;
      try {
        var { data: existSub } = await db.from('user_subscriptions').select('code').eq('code', subCode).maybeSingle();
        if (!existSub) {
          await db.from('user_subscriptions').insert({
            code: subCode, order_id: sub.order_id || '', user_id: sub.user_id || null,
            channel: sub.channel || null,
            starts_at: sub.starts_at || new Date().toISOString(),
            expires_at: sub.expires_at || new Date().toISOString(),
            created_at: sub.created_at || new Date().toISOString()
          });
        }
        sub._synced = true;
      } catch(e) { /* 单条失败不影响其他 */ }
    }
  } catch(e) { /* 整体失败不阻塞 */ }
}

// 每 60 秒尝试同步一次（通过 global 防重，避免 require cache 清除后重复启动）
function startAutoSync() {
  if (global._supabaseSyncTimer) return;
  global._supabaseSyncTimer = setInterval(syncMemToSupabase, 60000);
  syncMemToSupabase(); // 立即尝试一次
  if (global._supabaseSyncTimer.unref) global._supabaseSyncTimer.unref();
}

// 启动自动同步（全局单例）
startAutoSync();

module.exports = {
  getSupabase,
  createFeedback,
  countRecentFeedback,
  getCreditsByCode,
  deductCredit,
  insertCredits,
  activateMonthly,
  isMonthlyActive,
  isMonthlyActiveByUserId,
  getCreditsByOrderId,
  getReportOrder,
  createReportOrder,
  markReportOrderPaid,
  hasPaidReport,
  getPaidReportAccess,
  listPaidReports,
  saveChatHistory,
  trackFreeUsage,
  getFreeUsage,
  // v4.0 用户系统
  getUserByEmail,
  createUser,
  getUserById,
  syncUserData,
  getUserData,
  linkCodeToUser,
  getUserCredits,
  deductCreditByUser,
  getUserChatHistory,
  saveUserChatHistory,
  trackFreeUsageByUser,
  bumpFreeUsageByUser,
  bindPhoneToUser
};
