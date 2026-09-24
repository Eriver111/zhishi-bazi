// New payment records must be durable; never fall back to a process-local file.
function database() {
  const db = require('./supabase.js').getSupabase();
  if (!db) throw new Error('Payment storage unavailable');
  return db;
}

async function create(order) {
  const { data, error } = await database().from('payment_orders').insert(order).select('*').single();
  if (error || !data) throw new Error('Payment order could not be saved');
  return data;
}

async function get(orderId) {
  const { data, error } = await database().from('payment_orders').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw new Error('Payment order could not be read');
  return data || null;
}

async function fulfill(orderId, appid, amountCents, transactionId) {
  const { data, error } = await database().rpc('fulfill_wechat_payment', {
    p_order_id: orderId, p_appid: appid, p_amount_cents: amountCents, p_transaction_id: transactionId
  });
  if (error || data !== true) throw new Error('Payment fulfillment failed');
}

async function entitlement(order) {
  const table = order.kind === 'monthly' ? 'user_subscriptions' : 'user_credits';
  const { data, error } = await database().from(table).select('*').eq('order_id', order.order_id).single();
  if (error || !data) throw new Error('Payment entitlement unavailable');
  return { code: data.code, credits: order.kind === 'monthly' ? -1 : data.credits,
    _type: order.kind === 'monthly' ? 'monthly' : 'credits' };
}

async function claim(orderId, userId) {
  const { data, error } = await database().rpc('claim_wechat_purchase', {
    p_order_id: orderId, p_user_id: userId
  });
  if (error || !['paid', 'pending', 'unavailable'].includes(data)) throw new Error('Purchase binding unavailable');
  return data;
}

async function hepanReports(userId) {
  const { data, error } = await database().from('payment_orders')
    .select('report_type,report_key,label,paid_at,return_path')
    .eq('user_id', userId).eq('status', 'paid').eq('kind', 'report').eq('report_type', 'hepan')
    .order('paid_at', { ascending: false });
  if (error) throw new Error('Purchase history unavailable');
  return (data || []).map(row => ({ ...row,
    return_path: /^\/hepan-result\.html\?/.test(row.return_path || '') && !/[\r\n\\]/.test(row.return_path)
      ? row.return_path : '/hepan'
  }));
}

module.exports = { create, get, fulfill, entitlement, claim, hepanReports };
