const http=require('http');const fs=require('fs');const path=require('path');
const execSync=require('child_process').execSync;
const M={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
try{const e=fs.readFileSync(path.join(__dirname,'.env'),'utf-8').split('\n');e.forEach(l=>{const t=l.trim();if(t&&t[0]!=='#'){const i=t.indexOf('=');if(i>0)process.env[t.slice(0,i).trim()]=t.slice(i+1).trim()}})}catch(_){}
const DEPLOY_SECRET=process.env.DEPLOY_SECRET||'zhishi-deploy-2026';

// 自动部署：每分钟检查一次 GitHub 是否有新 commit，有则 git pull
var _lastPull=Date.now();
function autoPull(){
  try{
    var dir=__dirname;
    // 获取远程最新 commit hash
    var remote=execSync('git ls-remote origin -h refs/heads/main',{cwd:dir,timeout:8000}).toString().trim().split('\t')[0];
    var local=execSync('git rev-parse HEAD',{cwd:dir,timeout:5000}).toString().trim();
    if(remote && local && remote!==local){
      console.log('[autoPull] 检测到更新 '+local.slice(0,7)+' → '+remote.slice(0,7));
      var out=execSync('git pull origin main 2>&1',{cwd:dir,timeout:30000}).toString();
      console.log('[autoPull] git pull: '+out.trim());
      _lastPull=Date.now();
      return true;
    }
  }catch(e){ console.error('[autoPull] 失败: '+e.message); }
  return false;
}
// 启动后 10 秒做首次检查，之后每 60 秒检查
setTimeout(function(){ autoPull(); setInterval(autoPull,60000); },10000);

const s=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
let c=200, _sent=false;res.status=x=>{c=x;return res};
res.json=d=>{if(_sent)return;_sent=true;res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(d))};
res.send=d=>{if(_sent)return;_sent=true;res.writeHead(c,{'Content-Type':'text/plain'});res.end(String(d))};
// Get original URL from Vercel rewrite header
const origUrl=req.headers['x-original-url']||req.headers['x-now-route']||req.url||'';
let pn=(origUrl.split('?')[0]||'/').replace(/^\/server\.js/,'')||'/';
if(!pn||pn==='/')pn='/index.html';

// API
if(pn.startsWith('/api/')){const n=pn.slice(5);try{delete require.cache[require.resolve('./api/'+n+'.js')];const h=require('./api/'+n+'.js');req.query={};const qs=(req.url||'').indexOf('?');if(qs>=0)req.url.slice(qs+1).split('&').forEach(p=>{const[k,v]=p.split('=');if(k)req.query[decodeURIComponent(k)]=decodeURIComponent(v||'')});if(req.method==='POST')req.body=await new Promise(o=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{try{o(JSON.parse(b))}catch(_){let p={};b.split('&').forEach(s=>{let kv=s.split('=');if(kv.length===2)p[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1])});o(p)}})});await h(req,res)}catch(e){if(!_sent)res.json({error:e.message})}return}
const fp=__dirname+pn;try{const b=fs.readFileSync(fp);res.writeHead(200,{'Content-Type':M[path.extname(pn).toLowerCase()]||'text/plain'});res.end(b);return}catch(e){}
if(!path.extname(pn)){try{const b=fs.readFileSync(fp+'.html');res.writeHead(200,{'Content-Type':'text/html'});res.end(b);return}catch(e){}}
res.writeHead(404);res.end('404')});s.listen(process.env.PORT||3000,()=>console.log('OK'));
// force rebuild 1781971871
