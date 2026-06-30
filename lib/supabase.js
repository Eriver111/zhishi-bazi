/**
 * 数据存储模块 - Supabase + 本地内存回退
 * v3.0: 支持次数包 + 月度会员 + 免费次数追踪
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey &&
      !supabaseUrl.includes('your-project') && supabaseUrl.length > 20) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
      console.warn('Supabase 初始化失败，使用本地内存存储');
    }
  }
  return supabase;
}

// ===== 本地内存回退存储 =====
const memStore = {
  credits: {},
  orderIndex: {},
  subscriptions: {},   // code -> { code, order_id, starts_at, expires_at }
  freeLog: {},         // identifier -> { used_count }
  chatHistory: []
};

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
  return rec;
}

/** 插入新兑换码（次数包） */
async function insertCredits(code, orderId, creditCount) {
  const count = creditCount || parseInt(process.env.QUESTIONS_PER_ORDER) || 5;
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from('user_credits')
      .insert({ code, order_id: orderId, credits: count, total_used: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select().single();
    if (error) return null;
    return data;
  }
  if (memStore.credits[code]) return null;
  const rec = ensureMemDefaults(code, { credits: count, order_id: orderId });
  memStore.orderIndex[orderId] = code;
  return rec;
}

/** 激活月度会员 */
async function activateMonthly(code, orderId, durationDays) {
  const days = durationDays || parseInt(process.env.MONTHLY_DURATION_DAYS) || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400000);

  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from('user_subscriptions')
      .insert({ code, order_id: orderId, starts_at: now.toISOString(), expires_at: expires.toISOString(), created_at: now.toISOString() })
      .select().single();
    if (error) return null;
    return data;
  }
  memStore.subscriptions[code] = { code, order_id: orderId, starts_at: now.toISOString(), expires_at: expires.toISOString() };
  memStore.orderIndex[orderId] = code;
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

/** 检查订单是否已处理 */
async function getCreditsByOrderId(orderId) {
  const db = getSupabase();
  if (db) {
    // 先查次数表
    const { data: d1 } = await db.from('user_credits').select('*').eq('order_id', orderId).single();
    if (d1) return { ...d1, _type: 'credits' };
    // 再查订阅表
    const { data: d2 } = await db.from('user_subscriptions').select('*').eq('order_id', orderId).single();
    if (d2) return { ...d2, credits: -1, _type: 'monthly' };
    return null;
  }
  const code = memStore.orderIndex[orderId];
  if (!code) return null;
  if (memStore.credits[code]) return { ...memStore.credits[code], _type: 'credits' };
  if (memStore.subscriptions[code]) return { ...memStore.subscriptions[code], credits: -1, _type: 'monthly' };
  return null;
}

/** 保存聊天记录 */
async function saveChatHistory(code, role, content) {
  const db = getSupabase();
  if (db) {
    try { await db.from('chat_history').insert({ code, role, content, created_at: new Date().toISOString() }); } catch (e) {}
    return;
  }
  memStore.chatHistory.push({ code, role, content, created_at: new Date().toISOString() });
}

/** 记录免费次数使用（双标识：浏览器ID + 服务端指纹） */
async function trackFreeUsage(clientId, serverFingerprint) {
  const maxFree = parseInt(process.env.FREE_CREDITS_PER_DEVICE) || 2;
  const db = getSupabase();

  // 同时以两个标识记录，取最大值防止绕过
  async function bumpOne(id) {
    if (db) {
      const { data } = await db.from('free_credits_log').select('*').eq('identifier', id).single();
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
  const maxFree = parseInt(process.env.FREE_CREDITS_PER_DEVICE) || 2;
  const db = getSupabase();
  if (db) {
    const { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).single();
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
  if (!db) return;
  try {
    await db.from('user_credits').update({ user_id: userId }).eq('code', code).is('user_id', null);
    await db.from('user_subscriptions').update({ user_id: userId }).eq('code', code).is('user_id', null);
  } catch (e) { /* 忽略 */ }
}

/** 获取用户关联的所有积分 */
async function getUserCredits(userId) {
  const db = getSupabase();
  if (!db) return 0;
  const { data } = await db.from('user_credits').select('credits').eq('user_id', userId);
  if (!data || data.length === 0) return 0;
  return data.reduce(function(sum, r) { return sum + (r.credits || 0); }, 0);
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
    var { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).single();
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
    var { data } = await db.from('free_credits_log').select('*').eq('identifier', identifier).single();
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

module.exports = {
  getSupabase,
  getCreditsByCode,
  deductCredit,
  insertCredits,
  activateMonthly,
  isMonthlyActive,
  isMonthlyActiveByUserId,
  getCreditsByOrderId,
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
  getUserChatHistory,
  saveUserChatHistory,
  trackFreeUsageByUser,
  bumpFreeUsageByUser,
  bindPhoneToUser
};
