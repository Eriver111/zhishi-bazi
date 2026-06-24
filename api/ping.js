module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const diag = {
    ok: true, time: new Date().toISOString(),
    su_url: process.env.SUPABASE_URL ? 'set' : 'MISSING',
    su_key: process.env.SUPABASE_KEY ? 'set(len='+(process.env.SUPABASE_KEY||'').length+')' : 'MISSING',
    site: process.env.SITE_URL || 'MISSING',
  };
  try {
    const { getSupabase } = require('../lib/supabase.js');
    const db = getSupabase();
    if (db) {
      const { data, error } = await db.from('user_credits').select('code').limit(1);
      diag.db_ok = !error;
      diag.db_msg = error ? error.message : 'connected, rows='+(data?data.length:0);
    } else {
      diag.db_ok = false;
      diag.db_msg = 'getSupabase returned null';
    }
  } catch(e) {
    diag.db_ok = false;
    diag.db_msg = e.message;
  }
  res.status(200).json(diag);
};
