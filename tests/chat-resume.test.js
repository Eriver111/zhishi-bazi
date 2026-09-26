const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function setup(storage = new Map()) {
  const session = {user:null,token:null};
  const location = {search:'',pathname:'/ai-chat'};
  const window = {Auth:{getUser:()=>session.user,getToken:()=>session.token},dispatchEvent(){}};
  const localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const ctx = {window,localStorage,location,URLSearchParams,Event:class {},setTimeout};
  vm.runInNewContext(source('js/chat-persistence.js'),ctx);
  vm.runInNewContext(source('js/chat-resume.js'),ctx);
  return {api:window.ChatResume,storage,session,location};
}
const chart = {birthInfo:{gender:'female',year:1996},fourPillars:{year:{gan:'丙',zhi:'子'},month:{gan:'己',zhi:'亥'},day:{gan:'庚',zhi:'申'},hour:{gan:'癸',zhi:'未'}}};
const messages = [{role:'user',content:'我该怎么准备下一次面试？'},{role:'ai',content:'先梳理你的项目经历。'}];
function save(s,type='bazi',data=chart) {return s.api.remember({type,data},messages,'simple','conv-test',s.api.scope());}
test('first visit and chart-only visits do not expose a resume entry',()=>{
 const s=setup();assert.equal(s.api.read(),null);
 assert.equal(s.api.remember({type:'bazi',data:chart},[],'simple','',s.api.scope()),false);
 assert.equal(s.api.remember({type:'bazi',data:chart},[messages[0]],'simple','',s.api.scope()),false);
 assert.equal(s.api.read(),null);
});
test('completed chat survives a new page and restores its own chart rather than latest chart storage',()=>{
 const s=setup();assert.equal(save(s),true);const row=s.api.read();
 s.storage.set('ai_chart_data',JSON.stringify({fourPillars:{day:{gan:'甲',zhi:'子'}}}));
 const reopened=setup(s.storage);reopened.location.search='?resume='+row.id;
 assert.equal(reopened.api.resolve().data.fourPillars.day.gan,'庚');
 assert.equal(reopened.api.resolve().messages[0].content,messages[0].content);
 assert.equal(reopened.api.resolve().conversationId,'conv-test');
 assert.equal(reopened.api.href(row),'/ai-chat?resume='+row.id);
});
test('modes have correct destinations and obsolete or cross-mode URLs fail closed',()=>{
 const s=setup();save(s);const old=s.api.read().id;
 save(s,'ziwei',{gender:'female',mingGong:'午'});let row=s.api.read();
 assert.equal(s.api.href(row),'/zw-ai-chat?resume='+row.id);
 s.location.search='?resume='+row.id;assert.equal(s.api.resolve(),null);
 s.location.pathname='/zw-ai-chat.html';assert.equal(s.api.resolve().type,'ziwei');
 s.location.search='?resume='+old;assert.equal(s.api.resolve(),null);
 save(s,'liuren',{type:'liuren',dateInfo:{date:'synthetic'}});assert.match(s.api.href(s.api.read()),/^\/lr-ai-chat\?/);
 save(s,'hepan',{type:'hepan',person1:chart,person2:chart});assert.match(s.api.href(s.api.read()),/^\/ai-chat\?/);
});
test('login, logout, account changes and late replies cannot expose or overwrite another identity',()=>{
 const s=setup();save(s);const guest=s.api.scope();
 s.session.token='synthetic-token';assert.equal(s.api.read(),null);assert.equal(save(s),false);
 s.session.user={id:7};s.storage.set('zhishi_ui_epoch','login-7');assert.equal(s.api.read(),null);
 assert.equal(s.api.remember({type:'bazi',data:chart},messages,'simple','',null),false);
 assert.equal(s.api.remember({type:'bazi',data:chart},messages,'simple','',guest),false);
 save(s);const owner=s.api.scope();s.session.user={id:8};assert.equal(s.api.read(),null);
 assert.equal(s.api.remember({type:'bazi',data:chart},messages,'simple','',owner),false);
 s.session.user=null;s.session.token=null;s.storage.set('zhishi_ui_epoch','logged-out');assert.equal(s.api.read(),null);
});
test('expired, corrupted, mismatched chart snapshots and disabled storage degrade to hidden',()=>{
 const s=setup();save(s);const row=s.api.read();
 for(const changed of [{...row,time:Date.now()-31*86400000},{...row,chartKey:'wrong'},{...row,messages:[null]}, {...row,type:'constructor'}]) {
  s.storage.set(s.api.key,JSON.stringify(changed));assert.equal(s.api.read(),null);
 }
 s.storage.set(s.api.key,'broken');assert.equal(s.api.read(),null);
 const blocked=setup({get(){throw Error('disabled');},set(){throw Error('disabled');}});
 assert.equal(blocked.api.read(),null);assert.equal(save(blocked),false);
});
test('a failed or unfinished turn leaves the previous completed conversation intact',()=>{
 const s=setup();save(s);const previous=s.storage.get(s.api.key);
 assert.equal(s.api.remember({type:'bazi',data:chart},messages.concat({role:'user',content:'正在请求'}),'simple','',s.api.scope()),false);
 assert.equal(s.storage.get(s.api.key),previous);
 const exp=source('js/chat-experience.js');assert.match(exp,/if \(!failed && key && window.ChatResume\)/);
});
test('home hides by default and renders question previews as text, never HTML',()=>{
 const html=source('index.html');assert.match(html, /id="homeChatResume"[^>]*hidden/);
 assert.match(source('css/home-chat-resume.css'),/\[hidden\]\s*\{ display: none !important/);
 assert.match(source('js/home-chat-resume.js'),/textContent = question.content/);
 assert.doesNotMatch(source('js/home-chat-resume.js'),/innerHTML/);
 for(const file of ['index.html','ai-chat.html','zw-ai-chat.html','lr-ai-chat.html','result.html','hepan-result.html'])assert.match(source(file),/chat-resume\.js\?v=1/);
});

test('all standalone chat types can remember restored cloud history without replacing newer visible local messages',()=>{
 for(const name of ['ai-chat.html','zw-ai-chat.html','lr-ai-chat.html']) {
  assert.match(source(name),/if\(\(data.messages\|\|\[\]\).length&&\(force\|\|AI.resumePending\|\|AI.messages.length===0\)\)\{\s+if\(window.ChatResume\) ChatResume.remember/);
 }
});
