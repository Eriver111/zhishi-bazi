/**
 * 报告付费 v3.0 - QR弹窗 + 手动解锁 + AI引导入口
 */
var _baziHash='';
function hp(p){return [p.year,p.month,p.day,p.hour,p.gender].join('|')}
function iru(){var s=localStorage.getItem('bazi_rpt');if(!s)return false;try{var d=JSON.parse(s);return d.h===_baziHash&&d.e>Date.now()}catch(e){return false}}
function sru(){localStorage.setItem('bazi_rpt',JSON.stringify({h:_baziHash,e:Date.now()+365*86400000}))}

function initPaywall(bp){
  _baziHash=hp(bp);
  var secs=['thisYearSection','marriageSection','wealthSection','studySection','fortuneSection'];
  var first=document.getElementById(secs[0]);
  if(!first||document.getElementById('unifiedReport'))return;

  // 先渲染付费内容（这样遮罩下面有实际内容）
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  // 然后折叠所有板块
  secs.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('drawer-open')});

  var wrap=document.createElement('div');wrap.id='unifiedReport';
  wrap.style.cssText='position:relative;min-height:300px';
  first.parentNode.insertBefore(wrap,first);
  secs.forEach(function(id){var el=document.getElementById(id);if(el)wrap.appendChild(el)});

  if(iru()){unlock();return}
  injectQRModal();

  var pw=document.createElement('div');pw.id='rptPaywall';
  pw.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(8,12,20,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:10;border-radius:12px;backdrop-filter:blur(8px)';
  pw.innerHTML='<div style="font-size:48px">🔒</div><h3 style="color:var(--gold-l);margin:8px 0">深度命理分析报告</h3><p style="color:var(--tx2);font-size:13px;text-align:center;line-height:1.8">今年运势 · 婚姻感情 · 财运分析<br>学业分析 · 近5年流年运势</p><div style="font-size:30px;font-weight:900;color:var(--gold-l);margin:10px 0">¥9.9</div><button class="submit-btn" onclick="startRP()" style="max-width:280px">🔓 解锁完整报告</button><p style="color:var(--tx3);font-size:11px;margin-top:8px">一次付费 · 永久查看 · 支持下载</p><div style="margin-top:22px;padding:16px 20px;background:rgba(201,168,76,.1);border:1px dashed var(--bd2);border-radius:12px;text-align:center"><p style="color:var(--gold-l);font-size:16px;font-weight:700;margin-bottom:6px">🤖 不想看报告？试试知时AI</p><p style="color:var(--tx);font-size:14px;margin-bottom:4px">基于子平八字+盲派理论，为你深度解读命盘</p><p style="color:var(--gold);font-size:14px;font-weight:600;margin-top:8px;cursor:pointer" onclick="window._aiOpen()">👉 前2次免费 · 点我开始对话</p></div>';
  wrap.appendChild(pw);
  autoRestore();
}

function injectQRModal(){
  if(document.getElementById('qrModal'))return;
  var m=document.createElement('div');m.id='qrModal';
  m.style.cssText='display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.8);align-items:center;justify-content:center';
  m.innerHTML='<div style="background:var(--card,#0d1525);border:1px solid var(--bd);border-radius:16px;padding:28px 24px;text-align:center;max-width:360px;width:90%;position:relative"><button onclick="document.getElementById(\'qrModal\').style.display=\'none\'" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--tx2);font-size:22px;cursor:pointer">&times;</button><h3 style="color:var(--gold-l);margin-bottom:8px">📱 扫码支付 ¥9.9</h3><div id="qrContainer" style="margin:12px auto;width:200px;height:200px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#333">生成二维码中...</div><p style="color:var(--tx2);font-size:12px;margin:8px 0">支付后自动解锁，请勿关闭页面</p><p id="qrStatus" style="color:var(--tx3);font-size:11px">等待支付...</p><button id="qrRetryBtn" class="submit-btn" style="max-width:260px;display:none;margin-top:8px" onclick="startRP()">🔄 重新支付</button><button class="submit-btn" style="max-width:260px;margin-top:6px;background:rgba(255,255,255,.05);color:var(--tx);border:1px solid var(--bd)" onclick="manualUnlock()">我已付过款，点此解锁</button></div>';
  document.body.appendChild(m);
}

var _qrTimer=null;

function startRP(){
  var modal=document.getElementById('qrModal');if(modal)modal.style.display='flex';
  var status=document.getElementById('qrStatus');if(status)status.textContent='正在连接支付...';
  var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='none';

  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({money:9.9,name:'八字完整分析报告'})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){alert(d.error);return}
    localStorage.setItem('rpt_ord',d.out_trade_no);

    // 优先使用 zpayz 返回的支付宝链接直接跳转
    if(d.pay_url && d.pay_url.includes('alipay')){
      window.open(d.pay_url,'_blank');
      if(status)status.textContent='已打开支付页面，支付后自动解锁';
    }
    // 否则显示二维码
    else {
      var qrSrc=d.qrcode||d.pay_url||'';
      if(!qrSrc&&d.pay_url) qrSrc='https://api.quickchart.io/qr?size=220&text='+encodeURIComponent(d.pay_url);
      var c=document.getElementById('qrContainer');
      if(c&&qrSrc) c.innerHTML='<img src="'+qrSrc+'" style="width:200px;height:200px">';
      if(status)status.textContent='请扫码支付 ¥9.9';
    }
    startQRPoll(d.out_trade_no);
  }).catch(function(e){
    if(status)status.textContent='网络错误，请重试';
    var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='block';
  });
}

function startQRPoll(oid){
  if(_qrTimer)clearInterval(_qrTimer);
  var n=0;var status=document.getElementById('qrStatus');
  _qrTimer=setInterval(function(){
    n++;if(n>120){clearInterval(_qrTimer);if(status)status.textContent='支付超时';var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='block';return}
    if(status&&n%5===0)status.textContent='等待支付... ('+Math.floor(n/2)+'s)';
    fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){
      if(d.paid||d.status==='paid'){clearInterval(_qrTimer);localStorage.removeItem('rpt_ord');
        var modal=document.getElementById('qrModal');if(modal)modal.style.display='none';unlock();}
    }).catch(function(){});
  },2000);
}

function manualUnlock(){
  var oid=localStorage.getItem('rpt_ord');if(!oid)return;
  fetch('/api/check-order?out_trade_no='+oid).then(function(r){return r.json()}).then(function(d){
    if(d.paid||d.status==='paid'){clearInterval(_qrTimer);localStorage.removeItem('rpt_ord');
      var modal=document.getElementById('qrModal');if(modal)modal.style.display='none';unlock();}
    else{alert('尚未检测到支付，请确认已付款后重试')}
  }).catch(function(){alert('网络错误')});
}

function unlock(){
  sru();
  var pw=document.getElementById('rptPaywall');if(pw)pw.remove();
  var wrap=document.getElementById('unifiedReport');
  if(wrap)wrap.querySelectorAll('.section-drawer').forEach(function(s){s.classList.add('drawer-open')});
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
}

function autoRestore(){var oid=localStorage.getItem('rpt_ord');if(oid)startQRPoll(oid)}
