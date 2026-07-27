/**
 * 报告付费 v3.1 - QR弹窗 + 手动解锁 + AI引导入口
 * 八字排盘结果页付费遮罩
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

  // 先渲染付费内容
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  // 折叠所有板块
  secs.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('drawer-open')});

  var wrap=document.createElement('div');wrap.id='unifiedReport';
  wrap.style.cssText='position:relative;padding-bottom:20px';
  first.parentNode.insertBefore(wrap,first);
  secs.forEach(function(id){var el=document.getElementById(id);if(el)wrap.appendChild(el)});

  if(iru()){unlock();return}
  injectQRModal();

  // 计算付费内容实际高度
  var contentH=0;
  secs.forEach(function(id){var el=document.getElementById(id);if(el)contentH+=el.offsetHeight||160;});

  var pw=document.createElement('div');pw.id='rptPaywall';
  pw.style.cssText='position:absolute;top:0;left:0;right:0;height:'+(contentH||500)+'px;background:linear-gradient(180deg,rgba(14,12,10,.88) 0%,rgba(18,16,12,.94) 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:10;border-radius:12px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)';
  pw.innerHTML='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px">'
    +'<div style="width:48px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin-bottom:24px"></div>'
    +'<h3 style="color:var(--gold-l);font-size:20px;letter-spacing:4px;margin-bottom:12px">完整分析报告</h3>'
    +'<p style="color:var(--tx2);font-size:13px;text-align:center;line-height:2">今年运势 · 婚姻感情 · 财运分析<br>学业分析 · 近5年流年运势</p>'
    +'<div style="font-size:36px;font-weight:900;color:var(--gold-l);margin:16px 0">¥9.9</div>'
    +'<button class="submit-btn" onclick="startRP()" style="max-width:280px;width:100%;padding:14px 32px;font-size:16px;letter-spacing:3px">积分解锁完整报告</button>'
    +'<p style="color:var(--tx3);font-size:11px;margin-top:10px">一次付费 · 永久查看 · 支持下载</p>'
    +'</div>'
    +'<div style="width:100%;padding:20px;background:rgba(24,22,18,.6);border-top:1px solid rgba(180,160,140,.08);text-align:center">'
    +'<p style="color:var(--tx2);font-size:13px;margin-bottom:10px">不想看报告？试试 AI 对话解读</p>'
    +'<a href="/ai-chat.html" style="display:inline-block;padding:10px 28px;background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.25);border-radius:20px;color:var(--gold-l);text-decoration:none;font-size:14px;letter-spacing:2px;font-weight:600;transition:all .3s" onmouseenter="this.style.boxShadow=\'0 0 20px rgba(201,168,76,.15)\'" onmouseleave="this.style.boxShadow=\'none\'">🤖 前2次免费 · 开始对话</a>'
    +'</div>';
  wrap.appendChild(pw);
  autoRestore();
}

function injectQRModal(){
  if(document.getElementById('qrModal'))return;
  var m=document.createElement('div');m.id='qrModal';
  m.style.cssText='display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);align-items:center;justify-content:center';
  m.innerHTML='<div style="background:var(--card,rgba(24,22,18,.95));border:1px solid var(--bd,rgba(180,160,140,.1));border-radius:16px;padding:28px 24px;text-align:center;max-width:360px;width:90%;position:relative;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)"><button onclick="document.getElementById(\'qrModal\').style.display=\'none\'" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--tx2);font-size:22px;cursor:pointer">&times;</button><h3 style="color:var(--gold-l);margin-bottom:8px;letter-spacing:2px">扫码支付 ¥9.9</h3><div id="qrContainer" style="margin:12px auto;width:200px;height:200px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#333">生成二维码中...</div><p style="color:var(--tx2);font-size:12px;margin:8px 0">支付后自动解锁，请勿关闭页面</p><p id="qrStatus" style="color:var(--tx3);font-size:11px">等待支付...</p><button id="qrRetryBtn" class="submit-btn" style="max-width:260px;display:none;margin-top:8px" onclick="startRP()">重新支付</button><button class="submit-btn" style="max-width:260px;margin-top:6px;background:rgba(255,255,255,.04);color:var(--tx);border:1px solid var(--bd)" onclick="manualUnlock()">我已付过款，点此解锁</button></div>';
  document.body.appendChild(m);
}

var _qrTimer=null;

function isMobile(){return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent)}

function startRP(){
  var modal=document.getElementById('qrModal');if(modal)modal.style.display='flex';
  var status=document.getElementById('qrStatus');if(status)status.textContent='正在连接支付...';
  var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='none';
  var container=document.getElementById('qrContainer');
  if(container)container.innerHTML='<p style=color:var(--tx2)>生成支付二维码...</p>';

  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'credit_pack',name:'八字完整分析报告'})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.error){if(status)status.textContent='错误: '+d.error;if(retry)retry.style.display='block';return}
    localStorage.setItem('rpt_ord',d.out_trade_no);
    var payUrl=d.pay_url||'';
    if(isMobile()&&payUrl){
      if(status)status.textContent='正在跳转支付...';
      setTimeout(function(){window.location.href=payUrl},500);
    } else {
      var qrSrc=d.qrcode||'';
      // 仅当 d.pay_url 是真正的支付宝链接时才生成二维码（排除 zpayz API fallback 地址）
      var isValidPayUrl=payUrl&&payUrl.indexOf('mapi.php')<0&&payUrl.indexOf('zpayz.cn')<0;
      if(!qrSrc&&isValidPayUrl) qrSrc='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(payUrl);
      if(container&&qrSrc){
        container.innerHTML='<img id="qrImg" src="'+qrSrc+'" style="width:200px;height:200px"><p id="qrLoading" style="color:var(--tx3);font-size:12px;margin-top:8px">二维码加载中...</p>';
        var retries=0;
        document.getElementById('qrImg').onload=function(){var ld=document.getElementById('qrLoading');if(ld)ld.textContent='';};
        document.getElementById('qrImg').onerror=function(){
          retries++;
          if(retries<=5){
            var delay=retries*2000;
            document.getElementById('qrLoading').textContent='加载失败，'+Math.ceil(delay/1000)+'秒后重试...('+retries+'/5)';
            setTimeout(function(){
              document.getElementById('qrImg').src=qrSrc+(qrSrc.indexOf('?')>=0?'&':'?')+'_r='+Date.now();
            },delay);
          } else {
            container.innerHTML='<p style=color:var(--tx);padding:20px;text-align:center">二维码加载失败<br><span style=font-size:12px;color:var(--tx3)>请用手机浏览器打开此页面支付</span></p>';
          }
        };
      } else if(container){
        container.innerHTML='<p style=color:var(--tx);padding:20px;text-align:center>支付服务暂不可用<br><span style=font-size:12px;color:var(--tx3)>请用手机浏览器打开此页面完成支付</span></p>';
      }
      if(status)status.textContent='请扫码支付 ¥9.9（电脑端可截图扫码）';
    }
    startQRPoll(d.out_trade_no);
  }).catch(function(e){
    if(status)status.textContent='连接失败，请重试';
    if(retry)retry.style.display='block';
  });
}

function startQRPoll(oid){
  if(_qrTimer)clearInterval(_qrTimer);
  var n=0;var status=document.getElementById('qrStatus');
  _qrTimer=setInterval(function(){
    n++;if(n>120){clearInterval(_qrTimer);if(status)status.textContent='支付超时，请点击"重新支付"';var retry=document.getElementById('qrRetryBtn');if(retry)retry.style.display='block';return}
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
  }).catch(function(){alert('网络错误，请稍后重试')});
}

function unlock(){
  sru();
  var pw=document.getElementById('rptPaywall');if(pw)pw.remove();
  var wrap=document.getElementById('unifiedReport');
  if(wrap)wrap.querySelectorAll('.section-drawer').forEach(function(s){s.classList.add('drawer-open')});
  if(typeof renderPaidContent==='function'){try{renderPaidContent()}catch(e){}}
  var b=document.getElementById('downloadBanner');if(b)b.style.display='flex';
  // 登录用户：同步报告解锁状态到云端
  if(typeof Auth!=='undefined'&&Auth.isLoggedIn()){try{Auth.syncData('bazi_rpt',JSON.stringify({h:_baziHash,e:Date.now()+365*86400000}));}catch(e){}}
}

function autoRestore(){var oid=localStorage.getItem('rpt_ord');if(oid)startQRPoll(oid)}
