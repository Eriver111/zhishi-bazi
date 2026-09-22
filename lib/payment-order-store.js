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

module.exports = { create, get, fulfill, entitlement };
