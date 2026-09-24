const { requireAuth } = require('../lib/auth');
const { getSupabase } = require('../lib/supabase');
const model = require('../js/library-model');
const catalog = require('../books/catalog.json');
const books = new Map(catalog.filter(b => b.availability !== 'reference').map(b => [b.id, require('../books/' + b.id + '.json')]));

// Reading data uses the existing per-user store. Conditional writes prevent
// two devices from silently losing independent bookmark changes.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: '不支持的请求方式' });
  const user = requireAuth(req);
  if (!user) return res.status(401).json({ error: '请先登录' });
  const id = req.method === 'GET' ? req.query?.book : req.body?.book;
  const book = books.get(id);
  if (!book) return res.status(400).json({ error: '书籍不存在' });
  if (req.method === 'POST' && (!req.body.state || typeof req.body.state !== 'object' || JSON.stringify(req.body.state).length > 40000)) return res.status(400).json({ error: '阅读记录格式不正确' });
  try {
    const db = getSupabase();
    if (!db) throw new Error('Storage unavailable');
    const key = 'library_v1:' + id;
    for (let attempt = 0; attempt < 4; attempt++) {
      const read = await db.from('user_data').select('value').eq('user_id', user.uid).eq('key', key).maybeSingle();
      if (read.error) throw read.error;
      const old = read.data ? JSON.parse(read.data.value) : null;
      const state = req.method === 'GET' ? model.normalize(old, book) : model.merge(old, req.body.state, book);
      if (req.method === 'GET') return res.status(200).json({ state });
      const value = JSON.stringify(state);
      if (value === read.data?.value) return res.status(200).json({ state });
      const row = { value, updated_at: new Date().toISOString() };
      if (read.data) {
        const written = await db.from('user_data').update(row).eq('user_id', user.uid).eq('key', key).eq('value', read.data.value).select('value');
        if (written.error) throw written.error;
        if (written.data?.length) return res.status(200).json({ state });
      } else {
        const written = await db.from('user_data').insert({ ...row, user_id: user.uid, key });
        if (!written.error) return res.status(200).json({ state });
        if (written.error.code !== '23505') throw written.error;
      }
    }
    return res.status(409).json({ error: '阅读记录正在更新，请稍后重试' });
  } catch (_) {
    return res.status(503).json({ error: '账号同步暂不可用，本机阅读记录仍可继续使用' });
  }
};
