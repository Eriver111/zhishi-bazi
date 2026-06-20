// Force Vercel to include ALL static assets - literal requires
(function(){
try{require('./paipan.html')}catch(e){};try{require('./result.html')}catch(e){}
try{require('./hepan.html')}catch(e){};try{require('./hepan-result.html')}catch(e){}
try{require('./ai-chat.html')}catch(e){}
try{require('./css/style.css')}catch(e){};try{require('./css/result.css')}catch(e){}
try{require('./css/hepan.css')}catch(e){};try{require('./css/ai-chat-integration.css')}catch(e){}
try{require('./js/bazi.js')}catch(e){};try{require('./js/bg-animation.js')}catch(e){}
try{require('./js/mo-xing-he.js')}catch(e){};try{require('./js/effects.js')}catch(e){}
try{require('./js/region.js')}catch(e){};try{require('./js/lunar.js')}catch(e){}
try{require('./js/lunar_data.js')}catch(e){};try{require('./js/main.js')}catch(e){}
try{require('./js/result.js')}catch(e){};try{require('./js/paywall.js')}catch(e){}
try{require('./js/hepan-core.js')}catch(e){};try{require('./js/hepan-result.js')}catch(e){}
try{require('./js/hepan-paywall.js')}catch(e){};try{require('./js/ai-chat-integration.js')}catch(e){}
try{require('./js/chat.js')}catch(e){};try{require('./js/app.js')}catch(e){}
try{require('./js/payment.js')}catch(e){}
try{require('./js/vendor/solarlunar.min.js')}catch(e){}
try{require('./js/vendor/solarlunar_browser.js')}catch(e){}
})();

const http=require('http');const fs=require('fs');const path=require('path');
const M={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
try{const e=fs.readFileSync(path.join(__dirname,'.env'),'utf-8').split('\n');e.forEach(l=>{const t=l.trim();if(t&&t[0]!=='#'){const i=t.indexOf('=');if(i>0)process.env[t.slice(0,i).trim()]=t.slice(i+1).trim()}})}catch(_){}
const s=http.createServer(async(req,res)=>{
res.setHeader('Access-Control-Allow-Origin','*');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
let c=200;res.status=x=>{c=x;return res};res.json=d=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(d))};
const qs=(req.url||'').indexOf('?');let pn=qs>=0?req.url.slice(0,qs):req.url;if(pn==='/')pn='/index.html';
if(pn.startsWith('/api/')){const n=pn.slice(5);try{delete require.cache[require.resolve('./api/'+n+'.js')];const h=require('./api/'+n+'.js');req.query={};if(qs>=0)req.url.slice(qs+1).split('&').forEach(p=>{const[k,v]=p.split('=');if(k)req.query[decodeURIComponent(k)]=decodeURIComponent(v||'')});if(req.method==='POST')req.body=await new Promise(o=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{try{o(JSON.parse(b))}catch(_){o({})}})});await h(req,res)}catch(e){res.json({error:e.message})}return}
const fp=__dirname+pn;try{const b=fs.readFileSync(fp);res.writeHead(200,{'Content-Type':M[path.extname(pn).toLowerCase()]||'text/plain'});res.end(b);return}catch(e){}
if(!path.extname(pn)){try{const b=fs.readFileSync(fp+'.html');res.writeHead(200,{'Content-Type':'text/html'});res.end(b);return}catch(e){}}
res.writeHead(404);res.end('404')});s.listen(process.env.PORT||3000,()=>console.log('OK'));
