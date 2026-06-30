/**
 * /api/deploy - GitHub Webhook 自动部署
 * 收到 GitHub push 事件后执行 git pull
 * 验证 secret 防止恶意调用
 */
const execSync = require('child_process').execSync;
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || 'zhishi-deploy-2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 验证 secret（支持 query ?secret=xxx 或 GitHub webhook signature）
    var secret = (req.query && req.query.secret) || '';
    if (!secret || secret !== DEPLOY_SECRET) {
      return res.status(403).json({ ok: false, error: 'unauthorized' });
    }

    var dir = require('path').join(__dirname, '..');
    var oldHash = '';
    try { oldHash = execSync('git rev-parse HEAD', { cwd: dir, timeout: 5000 }).toString().trim(); } catch (_) {}

    // 先 fetch 再 merge，避免本地落后
    try { execSync('git fetch origin main 2>&1', { cwd: dir, timeout: 15000 }); } catch (_) {}

    var pullOut = '';
    try {
      pullOut = execSync('git pull origin main 2>&1', { cwd: dir, timeout: 30000 }).toString().trim();
    } catch (e) {
      pullOut = 'pull failed: ' + (e.message || '');
    }

    var newHash = '';
    try { newHash = execSync('git rev-parse HEAD', { cwd: dir, timeout: 5000 }).toString().trim(); } catch (_) {}

    var changed = oldHash !== newHash;
    console.log('[deploy] ' + (changed ? ('UPDATED ' + oldHash.slice(0, 7) + ' → ' + newHash.slice(0, 7)) : 'NO CHANGE') + ' | ' + pullOut);

    return res.status(200).json({
      ok: true,
      changed: changed,
      old: oldHash.slice(0, 7),
      new: newHash.slice(0, 7),
      output: pullOut
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
