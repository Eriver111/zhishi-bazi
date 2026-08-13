// === 崩溃保护：捕获未处理异常，记录日志但不退�?===
process.on('uncaughtException', function(err) {
  try { fs.appendFileSync(path.join(__dirname,'crash.log'), new Date().toISOString()+' uncaughtException: '+err.message+'\n'+err.stack+'\n'); } catch(_) {}
  console.error('[CRASH] uncaughtException:', err.message);
});
process.on('unhandledRejection', function(reason) {
  try { fs.appendFileSync(path.join(__dirname,'crash.log'), new Date().toISOString()+' unhandledRejection: '+(reason&&reason.message||reason)+'\n'); } catch(_) {}
  console.error('[CRASH] unhandledRejection:', reason&&reason.message||reason);
});
// === 内存上限保护：超�?500MB 主动重启 ===
setInterval(function() {
  var mem = process.memoryUsage();
  if (mem.heapUsed > 500 * 1024 * 1024) {
    console.error('[OOM] 内存�?500MB, 主动退出以触发守护进程重启');
    process.exit(1);
  }
}, 30000).unref();

const http=require('http');const fs=require('fs');const path=require('path');
const execSync=require('child_process').execSync;
const M={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.mp4':'video/mp4','.mp3':'audio/mpeg'};
try{const e=fs.readFileSync(path.join(__dirname,'.env'),'utf-8').split('\n');e.forEach(l=>{const t=l.trim();if(t&&t[0]!=='#'){const i=t.indexOf('=');if(i>0){const k=t.slice(0,i).trim();if(process.env[k]===undefined)process.env[k]=t.slice(i+1).trim()}}})}catch(_){}
// .env.local 本地覆盖（不入 git），优先级高于 .env
try{const e=fs.readFileSync(path.join(__dirname,'.env.local'),'utf-8').split('\n');e.forEach(l=>{const t=l.trim();if(t&&t[0]!=='#'){const i=t.indexOf('=');if(i>0){const k=t.slice(0,i).trim();process.env[k]=t.slice(i+1).trim()}}})}catch(_){}
const DEPLOY_SECRET=process.env.DEPLOY_SECRET||'zhishi-deploy-2026';

// 自动部署：每分钟检查一�?GitHub 是否有新 commit，有�?git pull
var _lastPull=Date.now();
function autoPull(){
  try{
    var dir=__dirname;
    // 获取远程最�?commit hash
    var remote=execSync('git ls-remote origin -h refs/heads/main',{cwd:dir,timeout:8000}).toString().trim().split('\t')[0];
    var local=execSync('git rev-parse HEAD',{cwd:dir,timeout:5000}).toString().trim();
    if(remote && local && remote!==local){
      console.log('[autoPull] 检测到更新 '+local.slice(0,7)+' �?'+remote.slice(0,7));
      var out=execSync('git pull origin main 2>&1',{cwd:dir,timeout:30000}).toString();
      console.log('[autoPull] git pull: '+out.trim());
      _lastPull=Date.now();
      // 通知 pm2 重启
      try{ execSync('pm2 restart zhishi 2>&1',{cwd:dir,timeout:5000}); }catch(e){}
      return true;
    }
  }catch(e){ console.error('[autoPull] 失败: '+e.message); }
  return false;
}
// 启动�?10 秒做首次检查，之后�?60 秒检�?
setTimeout(function(){ autoPull(); setInterval(autoPull,60000); },10000);

// ===== 页面浏览统计（内存计数，�?0秒刷入Supabase�?====
var _pvCache = {}; // { 'YYYY-MM-DD|path': count }
var _pvTimer = null;
function flushPV() {
  if (Object.keys(_pvCache).length === 0) return;
  var batch = {};
  for (var k in _pvCache) { batch[k] = _pvCache[k]; _pvCache[k] = 0; }
  try {
    var db = require('./lib/supabase.js').getSupabase();
    if (!db) return;
    var today = new Date().toISOString().slice(0,10);
    var entries = [];
    for (var k in batch) {
      if (batch[k] <= 0) continue;
      var parts = k.split('|');
      entries.push({ date: parts[0], path: parts[1] || '/', count: batch[k] });
    }
    if (entries.length > 0) {
      entries.forEach(function(e) {
        db.from('page_views').upsert({ date: e.date, path: e.path, count: e.count },
          { onConflict: 'date,path' }).then(function(){}).catch(function(){});
      });
    }
  } catch(e) {}
}
function trackPV(path) {
  var today = new Date().toISOString().slice(0,10);
  var p = (path || '/').split('?')[0] || '/';
  // 排除 API 和资源文�?
  if (p.startsWith('/api/') || p.includes('.')) return;
  var key = today + '|' + p;
  _pvCache[key] = (_pvCache[key] || 0) + 1;
}
setTimeout(function() { _pvTimer = setInterval(flushPV, 60000); }, 30000);

const CHANNEL_DOMAINS={'knowbazi.online':'knowbazi','zx.zhishi.online':'zx'};
class RequestBodyTooLargeError extends Error {
  constructor(maxBytes) {
    super('Request body too large');
    this.name = 'RequestBodyTooLargeError';
    this.code = 'REQUEST_BODY_TOO_LARGE';
    this.maxBytes = maxBytes;
  }
}

function drainRequest(req) {
  req.on('error', function() {});
  req.resume();
}

function readRequestBody(req, options) {
  var maxBytes = options && options.maxBytes;
  var declaredLength = Number(req.headers['content-length']);
  if (maxBytes !== undefined
      && Number.isFinite(declaredLength)
      && declaredLength > maxBytes) {
    drainRequest(req);
    return Promise.reject(new RequestBodyTooLargeError(maxBytes));
  }

  return new Promise(function(resolve, reject) {
    var chunks = [];
    var totalBytes = 0;

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
    }

    function rejectOversized() {
      cleanup();
      chunks = [];
      drainRequest(req);
      reject(new RequestBodyTooLargeError(maxBytes));
    }

    function onData(chunk) {
      totalBytes += chunk.length;
      if (maxBytes !== undefined && totalBytes > maxBytes) {
        rejectOversized();
        return;
      }
      chunks.push(chunk);
    }

    function onEnd() {
      cleanup();
      var body = Buffer.concat(chunks, totalBytes).toString('utf8');
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        var parsed = {};
        body.split('&').forEach(function(part) {
          var pair = part.split('=');
          if (pair.length === 2) {
            parsed[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
          }
        });
        resolve(parsed);
      }
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onAborted() {
      cleanup();
      reject(new Error('Request aborted'));
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}
const s=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}

// 渠道检测：根据 Host 头自动标记渠道来�?
var host=req.headers.host||'';
var channel=CHANNEL_DOMAINS[host]||'';
if(channel){
  res.setHeader('Set-Cookie','channel='+channel+'; Path=/; Max-Age=7776000; SameSite=Lax');
}

let c=200, _sent=false;res.status=x=>{c=x;return res};
res.json=d=>{if(_sent)return;_sent=true;res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(d))};
res.send=d=>{if(_sent)return;_sent=true;res.writeHead(c,{'Content-Type':'text/plain'});res.end(String(d))};
// Get original URL from Vercel rewrite header
const origUrl=req.headers['x-original-url']||req.headers['x-now-route']||req.url||'';
let pn=(origUrl.split('?')[0]||'/').replace(/^\/server\.js/,'')||'/';
if(!pn||pn==='/')pn='/index.html';
trackPV(pn);

// API
if(pn.startsWith('/api/')){const n=pn.slice(5);try{delete require.cache[require.resolve('./api/'+n+'.js')];// 同时清除核心依赖缓存，确�?git pull 后生�?
['./lib/supabase.js','./lib/auth.js','./lib/report-identity.js','./lib/payment-contract.js'].forEach(function(d){try{delete require.cache[require.resolve(d)]}catch(e){}});const h=require('./api/'+n+'.js');req.query={};const qs=(req.url||'').indexOf('?');if(qs>=0)req.url.slice(qs+1).split('&').forEach(p=>{const[k,v]=p.split('=');if(k)req.query[decodeURIComponent(k)]=decodeURIComponent(v||'')});if(req.method==='POST')req.body=await readRequestBody(req,pn==='/api/feedback'?{maxBytes:4096}:undefined);// 注入渠道标记�?body
if(channel&&req.body&&!req.body.channel)req.body.channel=channel;
await h(req,res)}catch(e){if(!_sent){if(e&&e.code==='REQUEST_BODY_TOO_LARGE')res.status(413).json({ok:false,error:e.message});else res.json({error:e.message})}}return}
const fp=__dirname+pn;try{let b=fs.readFileSync(fp);let ct=M[path.extname(pn).toLowerCase()]||'text/plain';
// HTML 页面注入渠道持久化脚�?
if(ct==='text/html'&&channel){
  var injectScript='<script>if(!document.cookie.match(/channel=([^;]+)/)){document.cookie="channel='+channel+';path=/;max-age=7776000"}localStorage.setItem("channel","'+channel+'");document.querySelectorAll("a").forEach(function(a){if(!a.href.match(/channel=/)){var s=a.href.indexOf("?")>=0?"&":"?";a.href+=s+"channel='+channel+'"}})</script>';
  b=b.toString().replace('</head>',injectScript+'</head>');
}
res.writeHead(200,{'Content-Type':ct,'Cache-Control':ct==='text/html'?'no-cache':ct==='application/javascript'||ct==='text/css'?'public, max-age=3600':'public, max-age=86400'});res.end(b);return}catch(e){}
if(!path.extname(pn)){try{let b=fs.readFileSync(fp+'.html');if(channel){var injectScript2='<script>if(!document.cookie.match(/channel=([^;]+)/)){document.cookie="channel='+channel+';path=/;max-age=7776000"}localStorage.setItem("channel","'+channel+'");document.querySelectorAll("a").forEach(function(a){if(!a.href.match(/channel=/)){var s=a.href.indexOf("?")>=0?"&":"?";a.href+=s+"channel='+channel+'"}})</script>';b=b.toString().replace('</head>',injectScript2+'</head>')}
res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end(b);return}catch(e){}}
res.writeHead(404);res.end('404')});s.listen(process.env.PORT||3000,()=>console.log('OK'));
// force rebuild 1781971871
