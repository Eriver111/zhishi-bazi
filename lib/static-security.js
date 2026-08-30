const path = require('path');

const PUBLIC_DIRS = new Set(['css', 'js', 'images', 'fonts', 'promo_animations']);
const PUBLIC_ROOT_FILES = new Set([
  'admin-v2.html', 'admin.html', 'ai-chat.html', 'archives.html', 'channel-admin.html',
  'douyin-promo.html', 'douyin-promo-v2.html', 'douyin-promo-v3.html',
  'face.html', 'fengshui.html', 'fortune.html', 'hepan.html', 'hepan-result.html',
  'index.html', 'liuren.html', 'liuyao.html', 'lr-ai-chat.html', 'meihua.html',
  'paipan.html', 'palm.html', 'pricing.html', 'profile.html', 'result.html',
  'verify.html', 'ziwei.html', 'zw-ai-chat.html',
  'icon-192.png', 'icon-512.png', 'icon.svg', 'manifest.json', 'sw.js'
]);

function resolvePublicFile(root, requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(String(requestPath || '/')); } catch (_) { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\0') || decoded.includes('\\')) return null;
  const parts = decoded.split('/').filter(Boolean);
  if (!parts.length || parts.some(function (part) { return part === '..' || part.startsWith('.'); })) return null;

  const allowed = parts.length === 1
    ? (PUBLIC_ROOT_FILES.has(parts[0]) || /^((promo_)?narration|v_compare_|v3_narration_).+\.mp3$/i.test(parts[0]))
    : PUBLIC_DIRS.has(parts[0]);
  if (!allowed) return null;

  const target = path.resolve(root, '.' + decoded);
  const rootPrefix = path.resolve(root) + path.sep;
  return target.startsWith(rootPrefix) ? target : null;
}

module.exports = { resolvePublicFile };
