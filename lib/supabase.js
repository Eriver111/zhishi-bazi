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

module.exports = {
  getSupabase,
  getCreditsByCode,
  deductCredit,
  insertCredits,
  activateMonthly,
  isMonthlyActive,
  getCreditsByOrderId,
  saveChatHistory,
  trackFreeUsage,
  getFreeUsage
};
