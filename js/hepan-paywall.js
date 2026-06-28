/**
 * 合盘报告付费 v3.0 - QR弹窗 ¥13.9
 */
var _hepanHash='';
function hhp(p1,p2,t){return [p1.dayGan||'',p1.dayZhi||'',p2.dayGan||'',p2.dayZhi||'',t].join('|')}
function hiru(){var s=localStorage.getItem('hepan_rpt');if(!s)return false;try{var d=JSON.parse(s);return d.h===_hepanHash&&d.e>Date.now()}catch(e){return false}}
function hsru(){localStorage.setItem('hepan_rpt',JSON.stringify({h:_hepanHash,e:Date.now()+365*86400000}))}

function initHePanPaywall(p1,p2,relationType){
  _hepanHash=hhp(p1,p2,relationType);
  var secs=['hp-drawer-4','hp-drawer-5','hp-drawer-6','hp-drawer-7'];
  var first=document.getElementById(secs[0]);
  if(!first||document.getElementById('hepanUnified'))return;

  var wrap=document.createElement('div');wrap.id='hepanUnified';
  wrap.style.cssText='position:relative;min-height:300px';
  first.parentNode.insertBefore(wrap,first);
  secs.forEach(function(id){var el=document.getElementById(id);if(el)wrap.appendChild(el)});

  if(hiru()){hunlock();return}
  hinjectQRModal();

  var pw=document.createElement('div');pw.id='hepanPaywall';
  pw.style.cssText='position:absolute;inset:0;background:#080c14;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:10;border-radius:12px;backdrop-filter:blur(8px)';
  pw.innerHTML='<h3 style="color:var(--gold-l);margin:8px 0">完整合盘分析报告</h3><p style="color:var(--tx2);font-size:13px;text-align:center;line-height:1.8">跨盘干支交互 · 核心相处模式<br>未来三年关键节点 · 宜忌指南</p><div style="font-size:30px;font-weight:900;color:var(--gold-l);margin:10px 0">¥13.9</div><button class="submit-btn" onclick="hstartPay()" style="max-width:280px">积分解锁合盘报告</button><p style="color:var(--tx3);font-size:11px;margin-top:8px">一次积分兑换 · 永久查看 · 支持下载</p><div style="margin-top:22px;padding:16px 20px;background:rgba(201,168,76,.1);border:1px dashed var(--bd2);border-radius:12px;text-align:center"><p style="color:var(--gold-l);font-size:15px;font-weight:700;margin-bottom:4px">试试知时AI解读合盘</p><p style="color:var(--gold);font-size:13px;margin-top:6px;cursor:pointer" onclick="if(window._aiOpen)window._aiOpen()">前2次免费 · 深度解读合盘缘分</p></div>';
  wrap.appendChild(pw);
  hautoRestore();
}

function hinjectQRModal(){
  if(document.getElementById('hepanQrModal'))return;
  var m=document.createElement('div');m.id='hepanQrModal';
  m.style.cssText='display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.8);align-items:center;justify-content:center';
  m.innerHTML='<div style="background:var(--card,#0d1525);border:1px solid var(--bd);border-radius:16px;padding:28px 24px;text-align:center;max-width:360px;width:90%;position:relative"><button onclick="document.getElementById(\'hepanQrModal\').style.display=\'none\'" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--tx2);font-size:22px;cursor:pointer">&times;</button><h3 style="color:var(--gold-l);margin-bottom:8px">扫码支付 ¥13.9</h3><div id="hepanQrContainer" style="margin:12px auto;width:200px;height:200px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#333">生成二维码中...</div><p style="color:var(--tx2);font-size:12px;margin:8px 0">支付后自动解锁，请勿关闭页面</p><p id="hepanQrStatus" style="color:var(--tx3);font-size:11px">等待支付...</p><button id="hepanQrRetry" class="submit-btn" style="max-width:260px;display:none;margin-top:8px" onclick="hstartPay()">重新支付</button><button class="submit-btn" style="max-width:260px;margin-top:6px;background:rgba(255,255,255,.05);color:var(--tx);border:1px solid var(--bd)" onclick="hmanualUnlock()">我已付过款，点此解锁</button></div>';
  document.body.appendChild(m);
}

var _hepanTimer=null;

function hstartPay(){
  var modal=document.getElementById('hepanQrModal');if(modal)modal.style.display='flex';
  var status=document.getElementById('hepanQrStatus');if(status)status.textContent='正在生成...';
  var retry=document.getElementById('hepanQrRetry');if(retry)retry.style.display='none';
  var isM=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({money:13.9,name:'合盘完整分析报告'})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){alert(d.error);return}
    localStorage.setItem('hepan_ord',d.out_trade_no);
    if(isM&&d.pay_url){window.location.href=d.pay_url;return}
    var c=document.getElementById('hepanQrContainer');
    if(c&&(d.qrcode||d.pay_url)){c.innerHTML='<img src="'+(d.qrcode||d.pay_url)+'" style="width:200px;height:200px">'}
    if(status)status.textContent='请扫码支付 ¥13.9';
    hpoll(d.out_trade_no);
  }).catch(function(e){if(status)status.textContent='网络错误，请重试';var r=document.getElementById('hepanQrRetry');if(r)r.style.display='block'});
}

function hpoll(oid){
  if(_hepanTimer)clearInterval(_hepanTimer);
  var n=0;var status=document.getElementById('hepanQrStatus');
  _hepanTimer=setInterval(function(){
    n++;if(n>120){clearInterval(_hepanTimer);if(status)status.textContent='支付超时';return}
    if(status&&n%5===0)status.textContent='等待支付... ('+Math.floor(n/2)+'s)';
    fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){
      if(d.paid||d.status==='paid'){clearInterval(_hepanTimer);localStorage.removeItem('hepan_ord');
        var modal=document.getElementById('hepanQrModal');if(modal)modal.style.display='none';hunlock();}
    }).catch(function(){});
  },2000);
}

function hmanualUnlock(){
  var oid=localStorage.getItem('hepan_ord');if(!oid)return;
  fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){
    if(d.paid||d.status==='paid'){clearInterval(_hepanTimer);localStorage.removeItem('hepan_ord');
      var modal=document.getElementById('hepanQrModal');if(modal)modal.style.display='none';hunlock();}
    else{alert('尚未检测到支付，请确认已付款后重试')}
  }).catch(function(){alert('网络错误')});
}

function hunlock(){
  hsru();
  var pw=document.getElementById('hepanPaywall');if(pw)pw.remove();
  ['hp-drawer-4','hp-drawer-5','hp-drawer-6','hp-drawer-7'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hp-open')});
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
  // 登录用户：同步合盘解锁状态到云端
  if(typeof Auth!=='undefined'&&Auth.isLoggedIn()){try{Auth.syncData('hepan_rpt',JSON.stringify({h:_hepanHash,e:Date.now()+365*86400000}));}catch(e){}}
}

function hautoRestore(){var oid=localStorage.getItem('hepan_ord');if(oid)hpoll(oid)}
