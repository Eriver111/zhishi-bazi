const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/page-state.js'), 'utf8');
function storage() {
  const values = new Map();
  return { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k), values };
}
function page(local = storage(), session = storage()) {
  const events = {}, window = { addEventListener: (k,fn) => { events[k] = fn; } };
  let now = 100000;
  vm.runInNewContext(source, { window, localStorage: local, sessionStorage: session,
    Date: { now: () => now }, URLSearchParams, location: { pathname: '/result.html', search: '?b=2&a=1' } });
  return { api: window.ZhishiPageState, local, session, events, advance: t => { now += t; } };
}
test('UI state is tab-scoped, bounded and expires after eight hours', () => {
  const p = page();p.api.set('draft', { text: 'synthetic' });
  assert.equal(p.api.get('draft').text, 'synthetic');
  assert.equal(p.local.values.size, 0, 'personal UI state must not enter localStorage');
  assert.equal(page(p.local).api.get('draft'), null, 'a separate tab has no shared draft');
  p.advance(8 * 60 * 60 * 1000);assert.equal(p.api.get('draft'), null);
  for (let i=0;i<24;i++) p.api.set('page'+i,{ i });
  assert.equal(p.api.get('page0'), null);assert.equal(p.api.get('page23').i,23);
});
test('result keys include the full sorted query and never combine different charts', () => {
  const p=page();assert.equal(p.api.pageKey('view'),'view:/result?a=1&b=2');
  p.api.set('view:/result?year=2000',{ tab:'professional' });
  assert.equal(p.api.get('view:/result?year=2001'),null);
});
test('account change clears state in active tabs and invalidates stale back-cache snapshots', () => {
  const p=page();let resets=0;p.api.onReset(()=>resets++);p.api.set('draft',{ text:'old' });
  p.local.setItem('zhishi_ui_epoch','new-account');p.events.storage({ key:'zhishi_ui_epoch' });
  assert.equal(p.api.get('draft'),null);assert.equal(resets,1);
  p.api.set('draft',{text:'new'});p.local.setItem('zhishi_ui_epoch','logged-out');
  p.api.set('draft',{text:'stale pagehide snapshot'});
  assert.equal(p.api.get('draft'),null);assert.equal(resets,2);
  p.events.pageshow();assert.equal(resets,2);
});
test('identity markers from another page invalidate persisted state on fresh navigation', () => {
  const p=page();p.api.set('draft',{text:'old'});
  p.local.setItem('zhishi_ui_epoch','changed-in-profile');
  const next=page(p.local,p.session);assert.equal(next.api.get('draft'),null);
});
test('unavailable, full and malformed storage do not break page interactions', () => {
  const broken = { getItem(){throw Error('disabled');},setItem(){throw Error('full');},removeItem(){throw Error('disabled');} };
  const p=page(broken,broken);assert.doesNotThrow(()=>p.api.set('draft',{text:'x'}));assert.equal(p.api.get('draft'),null);
  const normal=page();normal.session.setItem('zhishi_ui_state','malformed');assert.equal(normal.api.get('draft'),null);
});

const chatHtml=fs.readFileSync(path.join(__dirname,'../ai-chat.html'),'utf8');
test('all three standalone chats load recovery dependencies before the send handler', () => {
  for (const file of ['ai-chat.html','zw-ai-chat.html','lr-ai-chat.html']) {
    const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const state=html.indexOf('src="/js/page-state.js?v=1"');
    const history=html.indexOf('src="js/chat-persistence.js?v=4"');
    const recovery=html.indexOf('src="js/chat-experience.js?v=1"');
    assert.ok(state>=0 && history>state && recovery>history && recovery<html.indexOf('function send(){'),file);
    assert.match(html,/!event.isComposing/);
  }
});
const sendSource=chatHtml.slice(chatHtml.indexOf('function send(){'),chatHtml.indexOf('</script>',chatHtml.indexOf('function send(){')));
function chat(chart, response) {
  const nodes={input:{value:'synthetic question'},sendBtn:{disabled:false},quotaBar:{style:{}}};
  const calls={sent:0,thinking:false,finish:[],messages:[]};
  const context={
    AI:{freeRemaining:2,credits:0,isMonthly:false,isWaiting:false,messages:[],mode:'simple',freeId:'synthetic'},
    document:{getElementById:id=>nodes[id]}, window:{location:{search:''}},URLSearchParams,
    localStorage:{getItem:()=>chart?JSON.stringify(chart):null,setItem(){}},
    addMsg:(role,content)=>calls.messages.push({role,content}),showThinking:()=>{calls.thinking=true;},hideThinking:()=>{calls.thinking=false;},
    currentChatContext:()=>({type:'bazi',data:chart}),ChatPersistence:{decorate(){}},
    ChatExperience:{start(){},finish:failed=>calls.finish.push(failed),request:()=>{calls.sent++;return response();}},
    updateCreditsUI(){},setHistoryButton(){},
  };
  vm.runInNewContext(sendSource,context);
  return {context,nodes,calls};
}
test('missing chart unlocks the composer, settles the loading state and preserves the question for recovery', () => {
  const p=chat(null,()=>Promise.reject(Error('must not send')));p.context.send();
  assert.equal(p.calls.sent,0);assert.equal(p.context.AI.isWaiting,false);assert.equal(p.nodes.sendBtn.disabled,false);
  assert.equal(p.calls.thinking,false);assert.deepEqual(p.calls.finish,[true]);
});
test('repeated send while waiting makes only one request and a failure settles for explicit retry', async () => {
  let reject;const p=chat({birthInfo:{}},()=>new Promise((_,r)=>{reject=r;}));
  p.context.send();p.nodes.input.value='another click';p.context.send();assert.equal(p.calls.sent,1);
  reject(Error('offline'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(p.context.AI.isWaiting,false);assert.equal(p.nodes.sendBtn.disabled,false);assert.deepEqual(p.calls.finish,[true]);
  assert.match(p.calls.messages.at(-1).content,/先查看历史记录/);
});
