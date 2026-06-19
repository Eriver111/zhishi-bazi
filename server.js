/**
 * 本地开发服务器 - 模拟 Vercel serverless 环境
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 加载 .env（简单解析）
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  });
} catch (e) {
  console.log('⚠ 未找到 .env 文件');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(Object.fromEntries(new url.URLSearchParams(body))); }
    });
  });
}

/**
 * 增强 res 对象，提供 Vercel 兼容的 .status() .json() .send() 方法
 */
function enhanceRes(res) {
  res._statusCode = 200;
  res.status = function(code) {
    res._statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.writeHead(res._statusCode || 200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = function(text) {
    res.writeHead(res._statusCode || 200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(text));
    return res;
  };
}

const server = http.createServer(async (req, res) => {
  // CORS + 增强
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  enhanceRes(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const reqUrl = new url.URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // ---- API 路由 ----
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api/', '');
    try {
      // 清除缓存以便开发时热更新
      delete require.cache[require.resolve(`./api/${apiPath}.js`)];
      const handler = require(`./api/${apiPath}.js`);
      req.query = Object.fromEntries(reqUrl.searchParams);
      if (req.method === 'POST') req.body = await parseBody(req);
      await handler(req, res);
    } catch (e) {
      console.error(`API Error [${apiPath}]:`, e.message);
      res.status(404).json({ error: 'API not found: ' + apiPath, detail: e.message });
    }
    return;
  }

  // ---- 静态文件 ----
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, filePath);

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(fullPath));
    } else {
      // 尝试 .html 扩展名
      if (!path.extname(fullPath)) {
        const htmlPath = fullPath + '.html';
        if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fs.readFileSync(htmlPath));
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
    }
  } catch (e) {
    console.error('Static error:', e.message);
    res.writeHead(500);
    res.end('500 Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🧧 八字 AI 网站已启动: http://localhost:${PORT}`);
});
